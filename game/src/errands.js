// The four jobs: Rico owes Vinnie "The Ledger" Marlow $1,200, and four
// deliveries pay it off. Each job has a marker on a street corner that the
// player can reach on foot or by car.

import * as THREE from 'three';

export const JOBS = [
  {
    id: 1,
    title: 'Job 1 — The Pickup',
    pay: 200,
    text: 'Pick up the package at the corner of 2nd & Palm. $200.',
    story: 'Rico grabs the package. One down — the Ledger is watching.',
    speaker: 'VINNIE “THE LEDGER” MARLOW',
    pos: [28, -28],
  },
  {
    id: 2,
    title: 'Job 2 — The Drop',
    pay: 300,
    text: 'Deliver the package to the docks on the south-west corner. $300.',
    story: 'Drop made. Vinnie counts the bills and nods. Two to go.',
    speaker: 'VINNIE “THE LEDGER” MARLOW',
    pos: [-84, 84],
  },
  {
    id: 3,
    title: 'Job 3 — The Getaway',
    pay: 300,
    text: 'The heat is on. Reach the safehouse on the north-east corner. $300.',
    story: 'Rico slips into the safehouse. The sirens fade. One last job.',
    speaker: 'RICO',
    pos: [-28, 140],
  },
  {
    id: 4,
    title: 'Job 4 — The Payoff',
    pay: 400,
    text: "Drive to Vinnie's office on the east side and settle the debt. $400.",
    story: "Debt paid. Neon Bay is Rico's again — free roam, no more jobs.",
    speaker: 'VINNIE “THE LEDGER” MARLOW',
    pos: [84, -84],
  },
];

export function createErrands(scene) {
  const markers = [];
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f,
    transparent: true,
    opacity: 0.35,
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe45e,
    transparent: true,
    opacity: 0.9,
  });

  const rings = [];
  for (const job of JOBS) {
    const marker = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 16), beamMat);
    beam.position.y = 3.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.16, 10, 28), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    marker.add(beam, ring);
    marker.position.set(job.pos[0], 0, job.pos[1]);
    marker.visible = false;
    scene.add(marker);
    markers.push(marker);
    rings.push(ring);
  }

  const errands = {
    defs: JOBS,
    index: 0,
    done: false,
    markers,
  };

  errands.current = function current() {
    return JOBS[errands.index] ?? null;
  };

  errands.total = function total() {
    return JOBS.length;
  };

  errands.nextTitle = function nextTitle() {
    if (errands.done) return 'DEBT PAID';
    const next = JOBS[errands.index + 1];
    return next ? next.title : 'DEBT PAID';
  };

  errands.markerPos = function markerPos() {
    const job = errands.current();
    return job ? { x: job.pos[0], z: job.pos[1] } : null;
  };

  errands.showCurrent = function showCurrent() {
    markers.forEach((marker, i) => {
      marker.visible = !errands.done && i === errands.index;
    });
  };

  errands.reset = function reset(index) {
    errands.index = index;
    errands.done = index >= JOBS.length;
    errands.showCurrent();
  };

  // Returns the completed job when the player reaches the marker, else null.
  errands.update = function update(dt, playerPos) {
    const ring = rings[errands.index];
    if (ring) ring.rotation.z += dt * 1.5;
    if (errands.done) return null;
    const job = JOBS[errands.index];
    const d = Math.hypot(playerPos.x - job.pos[0], playerPos.z - job.pos[1]);
    if (d > 4) return null;
    errands.index += 1;
    if (errands.index >= JOBS.length) errands.done = true;
    errands.showCurrent();
    return job;
  };

  errands.showCurrent();
  return errands;
}
