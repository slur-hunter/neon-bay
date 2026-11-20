// Neon Bay v7 — pedestrians. People strolling the sidewalk edges of the blocks,
// who hurry away when Rico speeds past them, and can be knocked flat by a punch.
import * as THREE from 'three';
import { makeSeededRandom, pickFrom } from './seed.js';
import { GRID } from './metropolis.js';

const SHIRTS = [0xe8e8e8, 0x2f7de1, 0xff8c1a, 0x37c978, 0xd23c6b, 0x6b5ce7, 0x3a3f46, 0xf2c200, 0xc96a2e];
const SKINS = [0xf2c89b, 0xc98d5f, 0x8a5a3b, 0xe8b98a];

export function createSidewalk(scene, city) {
  const rnd = makeSeededRandom(777);
  const list = [];

  for (let i = 0; i < 14; i++) {
    const bx = pickFrom(rnd, GRID.blockCenters);
    const bz = pickFrom(rnd, GRID.blockCenters);
    const edge = Math.floor(rnd() * 4); // which side of the block
    const half = GRID.blockSize / 2 - 1;
    let x, z, dir;
    if (edge === 0) { x = bx - half + rnd() * GRID.blockSize; z = bz - half; dir = 1; }
    else if (edge === 1) { x = bx - half + rnd() * GRID.blockSize; z = bz + half; dir = -1; }
    else if (edge === 2) { x = bx - half; z = bz - half + rnd() * GRID.blockSize; dir = 1; }
    else { x = bx + half; z = bz - half + rnd() * GRID.blockSize; dir = -1; }
    const horizontal = edge < 2;

    const group = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: pickFrom(rnd, SHIRTS), roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: pickFrom(rnd, SKINS), roughness: 0.7 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.32), new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 }));
    legs.position.y = 0.4;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.75, 0.38), shirt);
    torso.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
    head.position.y = 1.8;
    for (const m of [legs, torso, head]) { m.castShadow = true; group.add(m); }
    group.position.set(x, 0, z);
    scene.add(group);

    list.push({
      group, legs, torso,
      pos: new THREE.Vector3(x, 0, z),
      bx, bz, edge, horizontal, dir,
      speed: 1.2 + rnd() * 0.8,
      phase: rnd() * 6,
      downUntil: 0,
      radius: 0.5,
    });
  }

  function update(dt, playerPos, playerSpeed, now) {
    for (const p of list) {
      if (now < p.downUntil) continue; // flat on the ground, recovering
      if (p.group.rotation.x !== 0) p.group.rotation.x = 0; // back on its feet
      // Flee when Rico is close and moving fast.
      const dx = p.pos.x - playerPos.x;
      const dz = p.pos.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      let vx = 0, vz = 0;
      if (d < 7 && playerSpeed > 8) {
        const flee = 3.2;
        vx = (dx / (d || 1)) * flee;
        vz = (dz / (d || 1)) * flee;
      } else if (p.horizontal) {
        vx = p.dir * p.speed;
      } else {
        vz = p.dir * p.speed;
      }
      p.pos.x += vx * dt;
      p.pos.z += vz * dt;
      // Turn around at the ends of the block edge.
      const half = GRID.blockSize / 2 - 1;
      if (p.horizontal) {
        if (p.pos.x > p.bx + half) { p.pos.x = p.bx + half; p.dir = -1; }
        if (p.pos.x < p.bx - half) { p.pos.x = p.bx - half; p.dir = 1; }
      } else {
        if (p.pos.z > p.bz + half) { p.pos.z = p.bz + half; p.dir = -1; }
        if (p.pos.z < p.bz - half) { p.pos.z = p.bz - half; p.dir = 1; }
      }
      p.phase += dt * 8;
      p.group.position.set(p.pos.x, Math.abs(Math.sin(p.phase)) * 0.05, p.pos.z);
      const heading = p.horizontal ? (vx >= 0 ? Math.PI / 2 : -Math.PI / 2) : (vz >= 0 ? 0 : Math.PI);
      p.group.rotation.y = heading;
      p.legs.rotation.x = Math.sin(p.phase) * 0.4;
    }
  }

  function knockDown(ped, fromPos, now) {
    const dx = ped.pos.x - fromPos.x;
    const dz = ped.pos.z - fromPos.z;
    const d = Math.hypot(dx, dz) || 1;
    ped.pos.x += (dx / d) * 2.2;
    ped.pos.z += (dz / d) * 2.2;
    ped.group.position.set(ped.pos.x, 0, ped.pos.z);
    ped.group.rotation.x = -Math.PI / 2; // falls over
    ped.downUntil = now + 1.2;
  }

  return { list, update, knockDown };
}
