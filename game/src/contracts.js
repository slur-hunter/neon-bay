// Neon Bay v7 — the four jobs. Rico owes $1,200 to Vinnie "The Ledger" Marlow;
// each job pays part of it off. Markers sit on street corners so a walker or a
// driver can reach them.
import * as THREE from 'three';

export const CONTRACTS = [
  {
    id: 1, title: 'Job 1 — The Pickup', pay: 200,
    text: 'Pick up the package at the corner of 2nd & Palm. $200.',
    story: 'Rico grabs the package. One down — the Ledger is watching.',
    speaker: 'VINNIE “THE LEDGER” MARLOW',
    pos: [23, -23],
  },
  {
    id: 2, title: 'Job 2 — The Drop', pay: 300,
    text: 'Deliver the package to the docks on the south-west corner. $300.',
    story: 'Drop made. Vinnie counts the bills and nods. Two to go.',
    speaker: 'VINNIE “THE LEDGER” MARLOW',
    pos: [-69, 69],
  },
  {
    id: 3, title: 'Job 3 — The Getaway', pay: 300,
    text: 'The heat is on. Reach the safehouse on the north-east corner. $300.',
    story: 'Rico slips into the safehouse. The sirens fade. One last job.',
    speaker: 'RICO',
    pos: [69, -69],
  },
  {
    id: 4, title: 'Job 4 — The Payoff', pay: 400,
    text: "Drive to Vinnie's office on the east side and settle the debt. $400.",
    story: "Debt paid. Neon Bay is Rico's again — free roam, no more jobs.",
    speaker: 'VINNIE “THE LEDGER” MARLOW',
    pos: [115, 23],
  },
];

export function createContracts(scene) {
  const markers = [];
  for (const c of CONTRACTS) {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 7, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35 }),
    );
    beam.position.y = 3.5;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.16, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xffe45e, emissive: 0xffc400, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    group.add(beam, ring);
    group.position.set(c.pos[0], 0, c.pos[1]);
    group.visible = false;
    scene.add(group);
    markers.push({ group, ring });
  }

  const jobs = {
    defs: CONTRACTS,
    index: 0,
    done: false,
    total() { return CONTRACTS.length; },
    current() { return CONTRACTS[this.index] || null; },
    nextTitle() {
      if (this.done) return 'DEBT PAID';
      const next = CONTRACTS[this.index + 1];
      return next ? next.title : 'DEBT PAID';
    },
    markerPos() {
      const c = this.current();
      return c ? new THREE.Vector3(c.pos[0], 0, c.pos[1]) : null;
    },
    showCurrent() {
      markers.forEach((m, i) => { m.group.visible = i === this.index && !this.done; });
    },
    reset(index) {
      this.index = index;
      this.done = index >= CONTRACTS.length;
      this.showCurrent();
    },
    update(dt, playerPos) {
      const c = this.current();
      if (!c) return null;
      const dx = playerPos.x - c.pos[0];
      const dz = playerPos.z - c.pos[1];
      if (Math.hypot(dx, dz) < 4) {
        this.index += 1;
        if (this.index >= CONTRACTS.length) this.done = true;
        this.showCurrent();
        return c;
      }
      return null;
    },
    spin(dt) {
      // Only the ring spins, never the whole marker.
      markers.forEach((m, i) => {
        if (m.group.visible) m.ring.rotation.z += dt * 1.5;
      });
    },
  };
  jobs.showCurrent();
  return jobs;
}
