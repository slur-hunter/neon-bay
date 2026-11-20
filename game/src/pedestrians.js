// pedestrians.js — people strolling the sidewalks. They walk their block's
// edges, turn at the corners, and scatter when a fast car bears down on them.
import * as THREE from 'three';
import { CITY } from './city.js';

const TOPS = [0xe8e8e8, 0x2f7de1, 0xff8c1a, 0x37c978, 0xd23c6b, 0x6b5ce7, 0x3a3f46, 0xf2c200];
const SKINS = [0xf2c89b, 0xc98d5f, 0x8a5a3b, 0xe8b98a];

export function createPedestrians(scene, city) {
  const crowd = [];
  let seed = 4242;
  const pick = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  function makePerson() {
    const figure = new THREE.Group();
    const skinTone = SKINS[Math.floor(pick() * SKINS.length)];
    const shirtTone = TOPS[Math.floor(pick() * TOPS.length)];

    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.8, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 }),
    );
    legs.position.y = 0.4;
    legs.castShadow = true;
    figure.add(legs);
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.75, 0.38),
      new THREE.MeshStandardMaterial({ color: shirtTone, roughness: 0.85 }),
    );
    torso.position.y = 1.15;
    torso.castShadow = true;
    figure.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.7 }),
    );
    head.position.y = 1.8;
    head.castShadow = true;
    figure.add(head);
    scene.add(figure);

    // Start on a block edge (a sidewalk), walking along it.
    const bx = CITY.blockCenters[Math.floor(pick() * 5)];
    const bz = CITY.blockCenters[Math.floor(pick() * 5)];
    const edge = Math.floor(pick() * 4);
    let x = bx;
    let z = bz;
    let dir = 0;
    if (edge === 0) { x = bx - CITY.block / 2 + 2; z = bz + (pick() - 0.5) * (CITY.block - 8); dir = pick() < 0.5 ? 0 : Math.PI; }
    if (edge === 1) { x = bx + CITY.block / 2 - 2; z = bz + (pick() - 0.5) * (CITY.block - 8); dir = pick() < 0.5 ? 0 : Math.PI; }
    if (edge === 2) { z = bz - CITY.block / 2 + 2; x = bx + (pick() - 0.5) * (CITY.block - 8); dir = pick() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
    if (edge === 3) { z = bz + CITY.block / 2 - 2; x = bx + (pick() - 0.5) * (CITY.block - 8); dir = pick() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }

    const person = {
      group: figure,
      pos: new THREE.Vector3(x, 0, z),
      yaw: dir,
      speed: 1.1 + pick() * 0.9,
      edge,
      blockX: bx,
      blockZ: bz,
      fleeing: false,
      bobPhase: pick() * 6,
    };
    figure.position.copy(person.pos);
    figure.rotation.y = person.yaw;
    crowd.push(person);
    return person;
  }

  for (let i = 0; i < 14; i++) makePerson();

  function update(dt, playerPos, playerSpeed) {
    for (const person of crowd) {
      const dx = person.pos.x - playerPos.x;
      const dz = person.pos.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      person.fleeing = d < 7 && playerSpeed > 8;
      let pace = person.speed;
      let heading = person.yaw;
      if (person.fleeing) {
        pace = 3.2;
        heading = Math.atan2(dx, dz);
      } else {
        // Walk the block edge; turn around at its ends.
        const end = CITY.block / 2 - 3;
        if (person.edge === 0 || person.edge === 1) {
          if (person.pos.z > person.blockZ + end) person.yaw = Math.PI;
          if (person.pos.z < person.blockZ - end) person.yaw = 0;
          heading = person.yaw;
        } else {
          if (person.pos.x > person.blockX + end) person.yaw = -Math.PI / 2;
          if (person.pos.x < person.blockX - end) person.yaw = Math.PI / 2;
          heading = person.yaw;
        }
      }
      person.yaw = heading;
      person.pos.x += Math.sin(heading) * pace * dt;
      person.pos.z += Math.cos(heading) * pace * dt;
      person.bobPhase += dt * 8;
      person.group.position.set(
        person.pos.x,
        Math.abs(Math.sin(person.bobPhase)) * 0.05,
        person.pos.z,
      );
      person.group.rotation.y = heading;
    }
  }

  // Knock a pedestrian down (a punch): they fall over, then get back up.
  function knockDown(person, fromPos) {
    const dx = person.pos.x - fromPos.x;
    const dz = person.pos.z - fromPos.z;
    const d = Math.max(0.1, Math.hypot(dx, dz));
    person.pos.x += (dx / d) * 2.2;
    person.pos.z += (dz / d) * 2.2;
    person.group.rotation.x = -Math.PI / 2;
    setTimeout(() => { person.group.rotation.x = 0; }, 1200);
  }

  return { list: crowd, update, knockDown };
}
