// Pedestrians: people walking the sidewalk edges who flee when the player
// speeds near them, and can be knocked down by a punch.
import * as THREE from 'three';
import { CITY_HALF, STREET_AT } from './city.js';

const SHIRTS = [0xd84a2f, 0x3aa17a, 0xd8a13b, 0x8a4fd0, 0xe8e8e8, 0x2f6fb2, 0x7a5a3a];

function makePedMesh(shirt) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pants = new THREE.MeshLambertMaterial({ color: 0x33333d });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), pants);
  legL.position.set(-0.12, 0.36, 0);
  const legR = legL.clone(); legR.position.x = 0.12;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), shirtMat);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.58;
  g.add(legL, legR, torso, head);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, legL, legR };
}

export function buildCrowd(scene, rng) {
  const peds = [];
  for (let k = 0; k < 22; k++) {
    const s = rng.pick(STREET_AT);
    const along = rng.range(-CITY_HALF + 10, CITY_HALF - 10);
    const horiz = rng.chance(0.5);
    const x = horiz ? along : s + (rng.chance(0.5) ? 9.5 : -9.5);
    const z = horiz ? s + (rng.chance(0.5) ? 9.5 : -9.5) : along;
    const { group, legL, legR } = makePedMesh(rng.pick(SHIRTS));
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      group, legL, legR, x, z,
      dir: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.4),
      flee: 0, down: 0, bob: rng.range(0, 6),
    });
  }
  return {
    peds,
    update(dt, px, pz, playerSpeed) {
      for (const p of peds) {
        if (p.down > 0) {
          p.down -= dt;
          p.group.rotation.x = p.down > 0.2 ? -Math.PI / 2 : 0;
          p.group.position.y = p.down > 0.2 ? 0.35 : 0;
          continue;
        }
        const d = Math.hypot(p.x - px, p.z - pz);
        if (d < 9 && playerSpeed > 6) p.flee = 1.6;
        if (p.flee > 0) {
          p.flee -= dt;
          const a = Math.atan2(p.x - px, p.z - pz);
          p.dir = a;
          p.x += Math.sin(a) * 4.5 * dt;
          p.z += Math.cos(a) * 4.5 * dt;
        } else {
          p.x += Math.sin(p.dir) * p.speed * dt;
          p.z += Math.cos(p.dir) * p.speed * dt;
          if (Math.abs(p.x) > CITY_HALF - 4 || Math.abs(p.z) > CITY_HALF - 4) p.dir += Math.PI;
          if (rng.chance(dt * 0.12)) p.dir += rng.range(-1.2, 1.2);
        }
        p.x = Math.max(-CITY_HALF + 3, Math.min(CITY_HALF - 3, p.x));
        p.z = Math.max(-CITY_HALF + 3, Math.min(CITY_HALF - 3, p.z));
        p.bob += dt * 9;
        const swing = Math.sin(p.bob) * 0.5;
        p.legL.rotation.x = swing;
        p.legR.rotation.x = -swing;
        p.group.position.set(p.x, 0, p.z);
        p.group.rotation.y = p.dir;
      }
    },
    knockDown(x, z, range) {
      let hit = null;
      for (const p of peds) {
        if (p.down > 0) continue;
        if (Math.hypot(p.x - x, p.z - z) < range) { hit = p; break; }
      }
      if (hit) hit.down = 2.2;
      return hit;
    },
  };
}
