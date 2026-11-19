// Neon Bay — missions.js: the five-job story chain from the fixer Mara.
// One clear job: give the player a reason to cross the city, and pay them for it.
import * as THREE from 'three';
import { LANDMARKS } from './city.js';

const JOBS = [
  {
    name: 'First Errand',
    brief: 'Pick up my package at the docks. No questions, no shortcuts.',
    target: () => LANDMARKS.docks,
    reward: 300,
  },
  {
    name: 'Getaway Driver',
    brief: 'Steal any car and bring it to my hideout, north-east corner. Fast.',
    target: () => LANDMARKS.hideout,
    reward: 600,
    needsCar: true,
  },
  {
    name: 'Collector',
    brief: 'Pick up the cash at the shop, then drop it with my contact in the park.',
    target: () => LANDMARKS.shop,
    reward: 800,
    stages: 2,
  },
  {
    name: 'Heat',
    brief: 'Make some noise. Get to three stars, then lose the heat and walk away clean.',
    target: () => LANDMARKS.plaza,
    reward: 1000,
    stages: 2,
  },
  {
    name: 'The Spire Job',
    brief: 'The bank at the Spire plaza. Three guards. Take the cash, then lose them at the island.',
    target: () => LANDMARKS.bank,
    reward: 2500,
    stages: 3,
  },
];

/** Builds the gold beacon that marks the current objective in the world. */
function buildBeacon(scene) {
  const group = new THREE.Group();
  group.name = 'mission-beacon';
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), beamMat);
  beam.position.y = 30;
  group.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.4, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  group.add(ring);
  scene.add(group);
  return { group, ring, beamMat, ringMat };
}

/** Runs the job chain, the beacon and Mara's messages. */
export function createMissions(scene, G) {
  const beacon = buildBeacon(scene);
  let index = 0;
  let stage = 0;
  let done = false;
  let objective = 'Meet Mara. Your first job is waiting.';
  let target = null;

  function setTarget(v) {
    target = v;
    if (v) {
      beacon.group.position.set(v.x, 0, v.z);
      beacon.group.visible = true;
    } else {
      beacon.group.visible = false;
    }
  }

  function startJob(i) {
    const job = JOBS[i];
    stage = 0;
    setTarget(job.target());
    objective = `Job ${i + 1}/5 — ${job.name}: ${job.brief}`;
    G.hud.toast(`<span class="mara">MARA:</span> ${job.brief} <b>$${job.reward}</b> when it is done.`);
    if (G.audio) G.audio.jingle();
  }

  function completeJob() {
    const job = JOBS[index];
    G.money += job.reward;
    G.hud.banner(`${job.name} DONE`, `+$${job.reward} — Mara is pleased.`);
    if (G.audio) G.audio.jingle();
    if (G.save) G.save.save();
    index += 1;
    if (index >= JOBS.length) {
      done = true;
      setTarget(null);
      objective = 'Neon Bay Legend — all five jobs done. The city is yours. Free roam.';
      G.hud.toast('<span class="mara">MARA:</span> Five for five. You run this city now, legend.');
      return;
    }
    startJob(index);
  }

  function playerPos() {
    return G.player.inCar && G.drivenCar ? G.drivenCar.pos : G.player.pos;
  }

  return {
    get index() { return index; },
    get done() { return done; },
    get target() { return target; },
    get objective() { return objective; },
    beacon,
    /** Restores the chain from a save (job index only). */
    restore(jobIndex) {
      index = Math.min(jobIndex, JOBS.length - 1);
      if (index >= JOBS.length) { done = true; setTarget(null); return; }
      startJob(index);
    },
    start() { startJob(0); },
    update(dt) {
      // Pulse the beacon ring so it reads from across the city.
      const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.18;
      beacon.ring.scale.set(pulse, pulse, 1);
      beacon.beamMat.opacity = 0.32 + Math.sin(performance.now() * 0.003) * 0.1;
      if (done || !target) return;
      const job = JOBS[index];
      const p = playerPos();
      const dist = Math.hypot(p.x - target.x, p.z - target.z);

      if (index === 3) {
        // Heat: stage 0 is reaching three stars, stage 1 is losing them.
        if (stage === 0) {
          objective = `Job 4/5 — Heat: reach ★★★ (steal a car, punch, shoot), then lose the heat.`;
          setTarget(null);
          if (G.police.stars >= 3) {
            stage = 1;
            G.hud.toast('<span class="mara">MARA:</span> Three stars. Now disappear. Lay low until the heat dies.');
          }
        } else if (G.police.stars === 0) {
          completeJob();
        }
        return;
      }

      if (index === 4) {
        // The Spire Job: reach the bank, beat the guards, grab the cash, reach the island.
        if (stage === 0 && dist < 9) {
          stage = 1;
          G.combat.spawnGuards();
          G.hud.toast('<span class="mara">MARA:</span> Three guards. Deal with them, then grab the cash.');
          objective = 'Job 5/5 — The Spire Job: take down the three bank guards.';
        } else if (stage === 1) {
          if (G.combat.guardsAlive() === 0) {
            stage = 2;
            setTarget(LANDMARKS.bank);
            objective = 'Job 5/5 — The Spire Job: grab the cash at the bank door.';
          }
        } else if (stage === 2 && dist < 6) {
          stage = 3;
          G.police.addWanted(2, G.time);
          setTarget(LANDMARKS.island);
          G.hud.toast('<span class="mara">MARA:</span> Cash grabbed. Four stars. Lose them at the island.');
          objective = 'Job 5/5 — The Spire Job: escape to the island and lose the heat.';
        } else if (stage === 3 && dist < 12) {
          completeJob();
        }
        return;
      }

      if (job.stages === 2 && index === 2) {
        // Collector: shop first, then the park.
        if (stage === 0 && dist < 6) {
          stage = 1;
          setTarget(LANDMARKS.park);
          objective = 'Job 3/5 — Collector: cash in hand. Drop it with my contact in the park.';
          G.hud.toast('<span class="mara">MARA:</span> Got it. Now the park, north-west. My contact is waiting.');
        } else if (stage === 1 && dist < 6) {
          completeJob();
        }
        return;
      }

      const need = job.needsCar ? 10 : 6;
      if (job.needsCar && !G.player.inCar) {
        objective = `Job ${index + 1}/5 — ${job.name}: steal a car first (walk up and press E), then drive to the gold beacon.`;
        return;
      }
      if (dist < need) completeJob();
    },
  };
}
