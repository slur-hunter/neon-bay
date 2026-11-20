// Pedestrians: people strolling the sidewalk edges who scatter when a car
// or a sprinting player comes close, and who can be knocked flat by a punch.

import * as THREE from 'three';
import { makeSeeded, pick } from './rng.js';
import { GRID } from './city.js';

const SHIRTS = [0xe8e8e8, 0x2f7de1, 0xff8c1a, 0x37c978, 0xd23c6b, 0x6b5ce7, 0x3a3f46, 0xf2c200];
const SKINS = [0xf2c89b, 0xc98d5f, 0x8a5a3b, 0xe8b98a];

export function createCrowd(scene) {
  const rnd = makeSeeded(4451);
  const list = [];

  for (let i = 0; i < 14; i++) {
    const group = new THREE.Group();
    const shirt = pick(rnd, SHIRTS);
    const skin = pick(rnd, SKINS);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 });
    const torsoMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.32), legMat);
    legs.position.y = 0.4;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.75, 0.38), torsoMat);
    torso.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skinMat);
    head.position.y = 1.8;
    for (const part of [legs, torso, head]) {
      part.castShadow = true;
      group.add(part);
    }
    scene.add(group);

    // Start on a block edge (a sidewalk) and walk along it.
    const bx = pick(rnd, GRID.blocks);
    const bz = pick(rnd, GRID.blocks);
    const horizontal = rnd() < 0.5;
    const edge = rnd() < 0.5 ? -19 : 19;
    const start = (rnd() * 2 - 1) * 19;
    const ped = {
      group,
      pos: new THREE.Vector3(
        horizontal ? bx + start : bx + edge,
        0,
        horizontal ? bz + edge : bz + start,
      ),
      yaw: 0,
      speed: 1.2 + rnd() * 0.8,
      horizontal,
      axis: horizontal ? 'x' : 'z',
      dir: rnd() < 0.5 ? 1 : -1,
      blockX: bx,
      blockZ: bz,
      down: 0,
      fleeing: false,
      bob: rnd() * 6,
    };
    ped.yaw = ped.horizontal ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
    group.position.copy(ped.pos);
    group.rotation.y = ped.yaw;
    list.push(ped);
  }

  function update(dt, playerPos, playerSpeed) {
    for (const ped of list) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.group.rotation.x = 0;
          ped.group.position.y = 0;
        }
        continue;
      }
      // Flee when the player is close and moving fast.
      const dx = ped.pos.x - playerPos.x;
      const dz = ped.pos.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      ped.fleeing = dist < 7 && playerSpeed > 8;
      let vx = 0;
      let vz = 0;
      if (ped.fleeing && dist > 0.01) {
        vx = (dx / dist) * 3.2;
        vz = (dz / dist) * 3.2;
        ped.yaw = Math.atan2(vx, vz);
      } else if (ped.axis === 'x') {
        vx = ped.dir * ped.speed;
        ped.yaw = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        vz = ped.dir * ped.speed;
        ped.yaw = ped.dir > 0 ? 0 : Math.PI;
      }
      ped.pos.x += vx * dt;
      ped.pos.z += vz * dt;
      // Turn around at the ends of the block edge.
      if (ped.axis === 'x') {
        if (ped.pos.x > ped.blockX + 19) ped.dir = -1;
        if (ped.pos.x < ped.blockX - 19) ped.dir = 1;
      } else {
        if (ped.pos.z > ped.blockZ + 19) ped.dir = -1;
        if (ped.pos.z < ped.blockZ - 19) ped.dir = 1;
      }
      ped.bob += dt * 8;
      ped.group.position.set(ped.pos.x, Math.abs(Math.sin(ped.bob)) * 0.05, ped.pos.z);
      ped.group.rotation.y = ped.yaw;
    }
  }

  function knockDown(ped, fromPos) {
    const dx = ped.pos.x - fromPos.x;
    const dz = ped.pos.z - fromPos.z;
    const d = Math.hypot(dx, dz) || 1;
    ped.pos.x += (dx / d) * 2.2;
    ped.pos.z += (dz / d) * 2.2;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.3;
    ped.down = 1.2;
  }

  return { list, update, knockDown };
}
