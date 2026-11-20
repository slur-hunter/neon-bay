// missions.js — Rico's debt: four jobs for Vinnie "The Ledger" Marlow.
// Markers sit on sidewalk corners just outside their buildings, so a car or
// a walker can actually reach them.
import * as THREE from 'three';

const MISSION_DEFS = [
  {
    id: 1,
    title: 'Job 1 — The Pickup',
    pay: 200,
    text: 'Pick up the package at the corner of 2nd & Palm. $200.',
    story: 'Rico grabs the package. One down — the Ledger is watching.',
    pos: [38, -22],
  },
  {
    id: 2,
    title: 'Job 2 — The Drop',
    pay: 300,
    text: 'Deliver the package to the docks on the south-west corner. $300.',
    story: 'Drop made. Vinnie counts the bills and nods. Two to go.',
    pos: [-98, 98],
  },
  {
    id: 3,
    title: 'Job 3 — The Getaway',
    pay: 300,
    text: 'The heat is on. Reach the safehouse on the north-east corner. $300.',
    story: 'Rico slips into the safehouse. The sirens fade. One last job.',
    pos: [-38, 82],
  },
  {
    id: 4,
    title: 'Job 4 — The Payoff',
    pay: 400,
    text: 'Drive to Vinnie\u2019s office on the east side and settle the debt. $400.',
    story: 'Debt paid. Neon Bay is Rico\u2019s again — free roam, no more jobs.',
    pos: [98, -38],
  },
];

export function createMissions(scene) {
  const beacons = [];
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0xffd23f, emissive: 0xffb300, emissiveIntensity: 1.6,
    transparent: true, opacity: 0.85,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffe45e, emissive: 0xffc400, emissiveIntensity: 1.2,
    transparent: true, opacity: 0.9,
  });

  for (const def of MISSION_DEFS) {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 16, 1, true), beamMat);
    beam.position.y = 3.5;
    group.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.16, 8, 28), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    group.add(ring);
    group.position.set(def.pos[0], 0, def.pos[1]);
    group.visible = false;
    scene.add(group);
    beacons.push({ def, group, ring });
  }

  const jobs = {
    defs: MISSION_DEFS,
    index: 0,
    done: false,
    markers: beacons,
  };

  jobs.current = function now() {
    return MISSION_DEFS[Math.min(jobs.index, MISSION_DEFS.length - 1)];
  };

  jobs.markerPos = function where() {
    const def = jobs.current();
    return { x: def.pos[0], z: def.pos[1] };
  };

  jobs.showCurrent = function reveal() {
    beacons.forEach((m, i) => { m.group.visible = (i === jobs.index && !jobs.done); });
  };

  jobs.reset = function restart(index) {
    jobs.index = index || 0;
    jobs.done = false;
    jobs.showCurrent();
  };

  // How many jobs the debt holds, and the title of the one after this.
  jobs.total = function count() {
    return MISSION_DEFS.length;
  };

  jobs.nextTitle = function after() {
    if (jobs.done || jobs.index + 1 >= MISSION_DEFS.length) return 'DEBT PAID';
    return MISSION_DEFS[jobs.index + 1].title;
  };

  // Returns the completed mission def when the player reaches the marker.
  jobs.update = function step(dt, playerPos) {
    if (jobs.done) return null;
    const def = jobs.current();
    const d = Math.hypot(playerPos.x - def.pos[0], playerPos.z - def.pos[1]);
    // The marker ring spins while it waits.
    const marker = beacons[jobs.index];
    if (marker) marker.ring.rotation.z += dt * 1.5;
    if (d < 4) {
      const finished = def;
      jobs.index += 1;
      if (jobs.index >= MISSION_DEFS.length) jobs.done = true;
      jobs.showCurrent();
      return finished;
    }
    return null;
  };

  jobs.showCurrent();
  return jobs;
}
