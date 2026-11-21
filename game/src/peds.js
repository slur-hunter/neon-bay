// Pedestrians: people walking sidewalk edges who flee when the player
// speeds near them. A punch knocks one down; it gets back up after a moment.
import * as THREE from 'three';
import { mulberry32, pick, range, clamp, dist2 } from './rng.js';
import { STREET_LINES } from './city.js';

const SHIRTS = [0x2fae5f, 0xff7a1f, 0x2f9ae8, 0xe84a8a, 0xf2e6c9, 0x8a5ae8, 0x3fbf9a];

export function makePeds(scene, city) {
  const rng = mulberry32(777);
  const list = [];

  function buildMesh(shirtColor) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2e2e38, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a06f, roughness: 0.8 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.26), pants);
    legL.position.set(-0.13, 0.36, 0);
    const legR = legL.clone();
    legR.position.x = 0.13;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.66, 0.34), shirt);
    torso.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
    head.position.y = 1.58;
    g.add(legL, legR, torso, head);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.userData.legL = legL;
    g.userData.legR = legR;
    return g;
  }

  function placeAt(x, z, shirtColor) {
    const g = buildMesh(shirtColor ?? pick(rng, SHIRTS));
    g.position.set(x, 0, z);
    scene.add(g);
    const ped = {
      group: g, x, z, yaw: rng() * Math.PI * 2,
      speed: 0, frozen: true, down: false, downTimer: 0, phase: rng() * 6,
    };
    list.push(ped);
    return ped;
  }

  // Ambient walkers: pick a random sidewalk edge and a slow stroll.
  for (let i = 0; i < 22; i++) {
    const street = pick(rng, STREET_LINES);
    const along = (Math.floor(rng() * 6) - 3) * 60 + range(rng, -20, 20);
    const side = rng() < 0.5 ? 9.5 : -9.5;
    const ped = rng() < 0.5
      ? placeAt(street + side, along)
      : placeAt(along, street + side);
    ped.frozen = false;
    ped.speed = 0.9 + rng() * 0.7;
    ped.yaw = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  }

  function step(dt, playerX, playerZ, playerSpeed) {
    for (const p of list) {
      if (p.down) {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          p.down = false;
          p.group.rotation.x = 0;
          p.group.position.y = 0;
        }
        continue;
      }
      if (p.frozen) continue;
      // Flee: if the player is close and fast, run away from them.
      const d = dist2(p.x, p.z, playerX, playerZ);
      let dir = p.yaw;
      let sp = p.speed;
      if (d < 7 && playerSpeed > 6) {
        dir = Math.atan2(p.x - playerX, p.z - playerZ);
        sp = 3.2;
        p.yaw = dir;
      }
      const nx = p.x + Math.sin(dir) * sp * dt;
      const nz = p.z + Math.cos(dir) * sp * dt;
      const fixed = city.collide(nx, nz, 0.4);
      const cl = city.clampPos(fixed.x, fixed.z);
      p.x = cl.x;
      p.z = cl.z;
      p.phase += dt * 7;
      p.group.position.set(p.x, Math.abs(Math.sin(p.phase)) * 0.04, p.z);
      p.group.rotation.y = p.yaw;
      p.group.userData.legL.rotation.x = Math.sin(p.phase) * 0.4;
      p.group.userData.legR.rotation.x = -Math.sin(p.phase) * 0.4;
    }
  }

  function knockDown(ped) {
    ped.down = true;
    ped.downTimer = 3;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.3;
  }

  function nearestInFront(x, z, yaw, maxD) {
    let best = null;
    let bestD = maxD;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    for (const p of list) {
      if (p.down) continue;
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.55) continue; // must be roughly in front
      bestD = d;
      best = p;
    }
    return best;
  }

  return { list, placeAt, step, knockDown, nearestInFront };
}
