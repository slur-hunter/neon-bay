// Missions: four jobs that pay off Rico's $1,200 debt to Vinnie.
// RP accrues from job pay (+25 per completion); rank is derived from RP.
// Standing is PER-DISTRICT: 25 per job completed in the current district.
// Jobs 1 and 2 both sit in Marina, so after job 1 the Marina standing is 25.
import * as THREE from 'three';

export const JOBS = [
  {
    title: 'The Pickup', pay: 200, district: 'Marina',
    text: 'Pick up the package at the corner of 48th and Harbour.',
    story: 'Rico grabs the package. One down — the Ledger is watching.',
    speaker: 'VINNIE "THE LEDGER" MARLOW',
    marker: [-35, -60],
  },
  {
    title: 'The Drop', pay: 300, district: 'Marina',
    text: 'Deliver the package to the docks before the heat arrives.',
    story: 'Drop made. Vinnie counts the bills and nods. Two to go.',
    speaker: 'VINNIE "THE LEDGER" MARLOW',
    marker: [-105, -140],
  },
  {
    title: 'The Getaway', pay: 300, district: 'Harbour',
    text: 'Reach the safehouse while the heat is on.',
    story: 'Rico slips into the safehouse. The sirens fade. One last job.',
    speaker: 'RICO',
    marker: [105, -140],
  },
  {
    title: 'The Payoff', pay: 400, district: 'Old Town',
    text: "Drive to Vinnie's office and settle the debt.",
    story: "Debt paid. Neon Bay is Rico's again — free roam, no more jobs.",
    speaker: 'VINNIE "THE LEDGER" MARLOW',
    marker: [-105, 140],
  },
];

export function rankFor(rp) {
  if (rp >= 1000) return 'S';
  if (rp >= 500) return 'A';
  if (rp >= 250) return 'B';
  if (rp >= 100) return 'C';
  return 'D';
}

export function buildErrands(scene) {
  // Gold marker beam + spinning ring at the current job's position.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffc93c, transparent: true, opacity: 0.45,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 42, 12, 1, true), beamMat);
  beam.position.y = 21;
  scene.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd21a });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 8, 28), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  scene.add(ring);

  const state = {
    index: 0,
    money: 0,
    rp: 0,
    doneByDistrict: {},
    banner: '',
    bannerT: 0,
  };

  function current() {
    return JOBS[Math.min(state.index, JOBS.length - 1)];
  }
  function nextTitle() {
    if (state.index + 1 < JOBS.length) return JOBS[state.index + 1].title;
    return 'Free roam';
  }
  function standingHere(district) {
    return (state.doneByDistrict[district] || 0) * 25;
  }
  function rank() {
    return rankFor(state.rp);
  }

  function placeMarker() {
    const job = current();
    beam.position.set(job.marker[0], 21, job.marker[1]);
    ring.position.set(job.marker[0], 0.35, job.marker[1]);
    beam.visible = true;
    ring.visible = true;
  }

  // Completing a job: pay, RP, per-district standing, banner, advance.
  function tryComplete(px, pz) {
    if (state.index >= JOBS.length) return false;
    const job = JOBS[state.index];
    const d = Math.hypot(px - job.marker[0], pz - job.marker[1]);
    if (d > 6) return false;
    state.money += job.pay;
    state.rp += Math.round(job.pay / 2) + 25;
    state.doneByDistrict[job.district] = (state.doneByDistrict[job.district] || 0) + 1;
    state.banner = `MISSION COMPLETE — ${job.title} +$${job.pay}`;
    state.bannerT = 4;
    state.index += 1;
    if (state.index < JOBS.length) placeMarker();
    else {
      beam.visible = false;
      ring.visible = false;
    }
    return true;
  }

  function step(dt, time) {
    ring.rotation.z += dt * 1.4;
    ring.position.y = 0.35 + Math.sin(time * 2) * 0.12;
    if (state.bannerT > 0) state.bannerT -= dt;
  }

  function setForShot(index, money, rp, doneMap) {
    state.index = index;
    state.money = money;
    state.rp = rp;
    state.doneByDistrict = { ...(doneMap || {}) };
    state.banner = '';
    state.bannerT = 0;
    placeMarker();
  }

  function showBanner(text, seconds) {
    state.banner = text;
    state.bannerT = seconds;
  }

  return {
    state, JOBS, current, nextTitle, standingHere, rank, placeMarker,
    tryComplete, step, setForShot, showBanner, beam, ring,
  };
}
