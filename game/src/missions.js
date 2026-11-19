// missions.js — Rico's debt: four jobs for Vinnie "The Ledger" Marlow. Markers
// sit on sidewalk corners just outside their buildings, so a car or a walker can
// actually reach them.
import * as THREE from 'three';

const MISSION_DEFS = [
  {
    id: 1, title: 'Job 1 — The Pickup', pay: 200,
    text: 'Pick up the package at the corner of 2nd & Palm. $200.',
    story: 'Rico grabs the package. One down — the Ledger is watching.',
    pos: [38, -22],
  },
  {
    id: 2, title: 'Job 2 — The Drop', pay: 300,
    text: 'Deliver the package to the docks on the south-west corner. $300.',
    story: 'Drop made. Vinnie counts the bills and nods. Two to go.',
    pos: [-98, 98],
  },
  {
    id: 3, title: 'Job 3 — The Getaway', pay: 300,
    text: 'The heat is on. Reach the safehouse on the north-east corner. $300.',
    story: 'Rico slips into the safehouse. The sirens fade. One last job.',
    pos: [-38, 82],
  },
  {
    id: 4, title: 'Job 4 — The Payoff', pay: 400,
    text: 'Drive to Vinnie\u2019s office on the east side and settle the debt. $400.',
    story: 'Debt paid. Neon Bay is Rico\u2019s again — free roam, no more jobs.',
    pos: [98, -38],
  },
];

export function createMissions(scene) {
  const markers = [];
  const markerMat = new THREE.MeshStandardMaterial({
    color: 0xffd23f, emissive: 0xffb300, emissiveIntensity: 1.6, transparent: true, opacity: 0.85,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffe45e, emissive: 0xffc400, emissiveIntensity: 1.2, transparent: true, opacity: 0.9,
  });

  for (const def of MISSION_DEFS) {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 16, 1, true), markerMat);
    beam.position.y = 3.5;
    group.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.16, 8, 28), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    group.add(ring);
    group.position.set(def.pos[0], 0, def.pos[1]);
    group.visible = false;
    scene.add(group);
    markers.push({ def, group, ring });
  }

  const missions = {
    defs: MISSION_DEFS,
    index: 0,
    done: false,
    markers,
  };

  missions.current = function () {
    return MISSION_DEFS[Math.min(missions.index, MISSION_DEFS.length - 1)];
  };

  missions.markerPos = function () {
    const def = missions.current();
    return { x: def.pos[0], z: def.pos[1] };
  };

  missions.showCurrent = function () {
    markers.forEach((m, i) => { m.group.visible = (i === missions.index && !missions.done); });
  };

  missions.reset = function (index) {
    missions.index = index || 0;
    missions.done = false;
    missions.showCurrent();
  };

  // Returns the completed mission def when the player reaches the marker, else null.
  missions.update = function (dt, playerPos) {
    if (missions.done) return null;
    const def = missions.current();
    const d = Math.hypot(playerPos.x - def.pos[0], playerPos.z - def.pos[1]);
    // Marker ring spins while it waits.
    const marker = markers[missions.index];
    if (marker) marker.ring.rotation.z += dt * 1.5;
    if (d < 4) {
      const done = def;
      missions.index += 1;
      if (missions.index >= MISSION_DEFS.length) missions.done = true;
      missions.showCurrent();
      return done;
    }
    return null;
  };

  missions.showCurrent();
  return missions;
}
