// missions.js — the story: four jobs to pay off a $1,500 debt to loan shark Sal Vane.
// A beacon marks the target in the world, on the minimap, and in the HUD.
import * as THREE from 'three';

const MISSION_DEFS = [
  {
    title: 'Job 1 — Dock Pickup',
    text: 'Sal Vane left a package on the north pier. Go get it. The docks are marked in gold.',
    target: 'pier',
    reward: 200,
  },
  {
    title: 'Job 2 — Bank Drop',
    text: 'Take the package to the bank tower downtown. No detours, no cops.',
    target: 'bank',
    reward: 350,
  },
  {
    title: 'Job 3 — Shake the Heat',
    text: 'Sal’s boys tipped off the cops. Lose the heat, then reach the hideout in the south-west.',
    target: 'hideout',
    reward: 500,
    forceWanted: 2,
  },
  {
    title: 'Job 4 — The Last Run',
    text: 'One last case to the Sunset Marina warehouse. Finish this and the debt is paid.',
    target: 'marina',
    reward: 800,
  },
];

export class Missions {
  constructor(scene, city, game) {
    this.scene = scene;
    this.city = city;
    this.game = game;
    this.index = 0;
    this.done = false;
    this.beacon = this.buildBeacon();
    this.scene.add(this.beacon);
    this.markerLight = new THREE.PointLight(0xffd23e, 60, 40);
    this.scene.add(this.markerLight);
    this.placeBeacon();
  }

  buildBeacon() {
    const g = new THREE.Group();
    g.name = 'missionBeacon';
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 20;
    g.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    ring.name = 'ring';
    g.add(ring);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    diamond.position.y = 6;
    diamond.name = 'diamond';
    g.add(diamond);
    return g;
  }

  current() {
    return MISSION_DEFS[this.index] || null;
  }

  targetPos() {
    const def = this.current();
    if (!def) return null;
    const city = this.city;
    if (def.target === 'pier') return city.pierPos;
    if (def.target === 'bank') return city.bankPos;
    if (def.target === 'hideout') return city.hideoutPos;
    return city.marinaPos;
  }

  placeBeacon() {
    const pos = this.targetPos();
    if (!pos) { this.beacon.visible = false; this.markerLight.visible = false; return; }
    this.beacon.visible = true;
    this.markerLight.visible = true;
    this.beacon.position.set(pos.x, 0, pos.z);
    this.markerLight.position.set(pos.x, 6, pos.z);
    const def = this.current();
    if (def && def.forceWanted) this.game.setWanted(def.forceWanted);
  }

  update(dt, playerPos, time) {
    const diamond = this.beacon.getObjectByName('diamond');
    if (diamond) {
      diamond.rotation.y += dt * 1.5;
      diamond.position.y = 6 + Math.sin(time * 2) * 0.5;
    }
    const ring = this.beacon.getObjectByName('ring');
    if (ring) {
      const s = 1 + Math.sin(time * 3) * 0.08;
      ring.scale.set(s, s, 1);
    }
    const def = this.current();
    if (!def || this.done) return;
    const pos = this.targetPos();
    const d = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
    if (def.target === 'hideout' && this.game.wanted > 0) return; // lose the heat first
    if (d < 5) this.complete(def);
  }

  complete(def) {
    this.game.money += def.reward;
    this.game.addScore(def.reward);
    this.game.effects.burst(this.targetPos(), 0xffd23e, 40);
    this.game.audio.chime();
    this.game.hud.showBanner('MISSION COMPLETE', def.title + '  ·  +$' + def.reward);
    this.game.hud.showToast('Sal Vane: “Good. ' + (this.index + 1) + ' of 4 jobs done.”');
    this.index += 1;
    this.game.save.write();
    if (this.index >= MISSION_DEFS.length) {
      this.done = true;
      this.beacon.visible = false;
      this.markerLight.visible = false;
      this.game.hud.showBanner('DEBT PAID', 'Neon Bay is yours now, Rex. Free roam — enjoy the sunset.');
      this.game.hud.showToast('All four jobs complete. The $1,500 debt is paid.');
    } else {
      this.placeBeacon();
    }
  }

  objectiveText() {
    const def = this.current();
    if (!def) return 'Debt paid. Free roam — Neon Bay is yours.';
    if (def.target === 'hideout' && this.game.wanted > 0) {
      return def.title + ' — LOSE THE COPS FIRST (' + this.game.wanted + '★), then reach the hideout.';
    }
    return def.title + ' — ' + def.text;
  }

  // Apply a save file: skip to the mission the player had reached.
  applySave(save) {
    if (!save) return;
    this.index = Math.max(0, Math.min(save.missionIndex || 0, MISSION_DEFS.length));
    this.done = this.index >= MISSION_DEFS.length;
    if (this.done) {
      this.beacon.visible = false;
      this.markerLight.visible = false;
    } else {
      this.placeBeacon();
    }
  }
}
