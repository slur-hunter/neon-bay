// pedestrians.js — people walking the sidewalks. They stroll block edges, turn at
// corners, and scatter when a fast car comes close.
import * as THREE from 'three';
import { CITY } from './city.js';

const SHIRTS = [0xe8e8e8, 0x2f7de1, 0xff8c1a, 0x37c978, 0xd23c6b, 0x6b5ce7, 0x3a3f46, 0xf2c200];
const SKINS = [0xf2c89b, 0xc98d5f, 0x8a5a3b, 0xe8b98a];

export function createPedestrians(scene, city) {
  const list = [];
  let seed = 4242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  function makePed() {
    const group = new THREE.Group();
    const skin = SKINS[Math.floor(rnd() * SKINS.length)];
    const shirt = SHIRTS[Math.floor(rnd() * SHIRTS.length)];
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.8, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 }),
    );
    legs.position.y = 0.4;
    legs.castShadow = true;
    group.add(legs);
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.75, 0.38),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 }),
    );
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }),
    );
    head.position.y = 1.8;
    head.castShadow = true;
    group.add(head);
    scene.add(group);

    // Start on a block edge (sidewalk), walking along it.
    const bx = CITY.blockCenters[Math.floor(rnd() * 5)];
    const bz = CITY.blockCenters[Math.floor(rnd() * 5)];
    const edge = Math.floor(rnd() * 4);
    let x = bx; let z = bz; let dir = 0;
    if (edge === 0) { x = bx - CITY.block / 2 + 2; z = bz + (rnd() - 0.5) * (CITY.block - 8); dir = rnd() < 0.5 ? 0 : Math.PI; }
    if (edge === 1) { x = bx + CITY.block / 2 - 2; z = bz + (rnd() - 0.5) * (CITY.block - 8); dir = rnd() < 0.5 ? 0 : Math.PI; }
    if (edge === 2) { z = bz - CITY.block / 2 + 2; x = bx + (rnd() - 0.5) * (CITY.block - 8); dir = rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
    if (edge === 3) { z = bz + CITY.block / 2 - 2; x = bx + (rnd() - 0.5) * (CITY.block - 8); dir = rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }

    const ped = {
      group, pos: new THREE.Vector3(x, 0, z), yaw: dir,
      speed: 1.1 + rnd() * 0.9, edge, blockX: bx, blockZ: bz,
      fleeing: false, bobPhase: rnd() * 6,
    };
    group.position.copy(ped.pos);
    group.rotation.y = ped.yaw;
    list.push(ped);
    return ped;
  }

  for (let i = 0; i < 14; i++) makePed();

  function update(dt, playerPos, playerSpeed) {
    for (const ped of list) {
      // Flee when the player barrels toward them in a car.
      const dx = ped.pos.x - playerPos.x;
      const dz = ped.pos.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      ped.fleeing = d < 7 && playerSpeed > 8;
      let speed = ped.speed;
      let yaw = ped.yaw;
      if (ped.fleeing) {
        speed = 3.2;
        yaw = Math.atan2(dx, dz);
      } else {
        // Walk along the block edge; turn around at the ends.
        const halfEdge = CITY.block / 2 - 3;
        if (ped.edge === 0 || ped.edge === 1) {
          if (ped.pos.z > ped.blockZ + halfEdge) ped.yaw = Math.PI;
          if (ped.pos.z < ped.blockZ - halfEdge) ped.yaw = 0;
          yaw = ped.yaw;
        } else {
          if (ped.pos.x > ped.blockX + halfEdge) ped.yaw = -Math.PI / 2;
          if (ped.pos.x < ped.blockX - halfEdge) ped.yaw = Math.PI / 2;
          yaw = ped.yaw;
        }
      }
      ped.yaw = yaw;
      ped.pos.x += Math.sin(yaw) * speed * dt;
      ped.pos.z += Math.cos(yaw) * speed * dt;
      ped.bobPhase += dt * 8;
      ped.group.position.set(ped.pos.x, Math.abs(Math.sin(ped.bobPhase)) * 0.05, ped.pos.z);
      ped.group.rotation.y = yaw;
    }
  }

  // Knock a pedestrian down (punch): they fall over and get back up after a while.
  function knockDown(ped, fromPos) {
    const dx = ped.pos.x - fromPos.x;
    const dz = ped.pos.z - fromPos.z;
    const d = Math.max(0.1, Math.hypot(dx, dz));
    ped.pos.x += (dx / d) * 2.2;
    ped.pos.z += (dz / d) * 2.2;
    ped.group.rotation.x = -Math.PI / 2;
    setTimeout(() => { ped.group.rotation.x = 0; }, 1200);
  }

  return { list, update, knockDown };
}
