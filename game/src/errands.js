// Jobs and progression: four jobs that pay off Rico's $1,200 debt to
// Vinnie "The Ledger" Marlow. Completing a job pays money, adds RP, lifts
// rank, and raises standing in the district where the job sits. Every
// number the HUD shows comes from here, never typed in.
import * as THREE from 'three';

export const JOBS = [
  {
    title: 'The Pickup', pay: 200, x: 48, z: 48,
    text: 'Pick up the package at the corner of 48th and Harbor.',
    story: 'Rico grabs the package. One down, the Ledger is watching.',
    speaker: 'VINNIE "THE LEDGER" MARLOW',
  },
  {
    title: 'The Drop', pay: 300, x: -72, z: 96,
    text: 'Deliver the package to the docks before the heat arrives.',
    story: 'Drop made. Vinnie counts the bills and nods. Two to go.',
    speaker: 'VINNIE "THE LEDGER" MARLOW',
  },
  {
    title: 'The Getaway', pay: 300, x: 96, z: -72,
    text: 'Reach the safehouse while the sirens are on you.',
    story: 'Rico slips into the safehouse. The sirens fade. One last job.',
    speaker: 'RICO',
  },
  {
    title: 'The Payoff', pay: 400, x: -48, z: -48,
    text: 'Drive to Vinnie\u2019s office and settle the debt.',
    story: 'Debt paid. Neon Bay is Rico\u2019s again, free roam, no more jobs.',
    speaker: 'VINNIE "THE LEDGER" MARLOW',
  },
];

const RANKS = [
  { at: 0, letter: 'D' },
  { at: 100, letter: 'C' },
  { at: 250, letter: 'B' },
  { at: 450, letter: 'A' },
  { at: 700, letter: 'S' },
];

export function makeErrands(scene, districtAt) {
  // Gold marker beam + spinning ring at the current job's spot.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffc94d, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 26, 12, 1, true), beamMat);
  beam.position.y = 13;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.3, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  scene.add(beam, ring);

  const state = {
    index: 0,
    money: 0,
    rp: 0,
    done: 0,
    banner: '',
    bannerT: 0,
  };
  const rankFor = (rp) => {
    let letter = 'D';
    for (const r of RANKS) if (rp >= r.at) letter = r.letter;
    return letter;
  };
  return {
    state,
    job: () => JOBS[Math.min(state.index, JOBS.length - 1)],
    nextTitle: () => (state.index + 1 < JOBS.length ? JOBS[state.index + 1].title : 'Free roam'),
    rank: () => rankFor(state.rp),
    // Standing is the player's reputation in Neon Bay: it rises 25 points
    // with every completed job, shown beside the district they are in.
    standingHere: () => state.done * 25,
    districtHere: (x, z) => districtAt(x, z),
    placeMarker() {
      const j = JOBS[Math.min(state.index, JOBS.length - 1)];
      beam.position.x = j.x; beam.position.z = j.z;
      ring.position.x = j.x; ring.position.z = j.z;
      beam.visible = state.index < JOBS.length;
      ring.visible = state.index < JOBS.length;
    },
    update(dt, t) {
      ring.rotation.z += dt * 1.4;
      beam.material.opacity = 0.28 + Math.sin(t * 2.2) * 0.09;
      if (state.bannerT > 0) state.bannerT -= dt;
    },
    tryComplete(px, pz) {
      if (state.index >= JOBS.length) return false;
      const j = JOBS[state.index];
      if (Math.hypot(px - j.x, pz - j.z) > 6) return false;
      state.money += j.pay;
      state.rp += Math.round(j.pay / 2) + 25;
      state.done += 1;
      state.banner = `MISSION COMPLETE — ${j.title} +$${j.pay}`;
      state.bannerT = 4;
      state.index += 1;
      this.placeMarker();
      return true;
    },
  };
}
