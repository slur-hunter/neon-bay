// Pedestrians: people walking the sidewalk edges who flee when the player
// speeds near them. A punch knocks one down; it recovers after a moment.
// Punching a pedestrian does NOT raise wanted (that is only for police cars).
import * as THREE from 'three';
import { makeRng, range, pick } from './rng.js';

const SHIRTS = [0x3fa7d6, 0xe8e8e8, 0xffd21a, 0x8a5fd6, 0x2e8b57, 0xe86a92, 0xff8a3c];

export function buildCrowd(scene, seed, collide, clampPos) {
  const rng = makeRng(seed + 21);
  const people = [];
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.8 });

  for (let i = 0; i < 26; i++) {
    const shirtMat = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.75 });
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.36), shirtMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skinMat);
    head.position.y = 1.62;
    g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.26), pantsMat);
    legL.position.set(-0.16, 0.34, 0);
    g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.26), pantsMat);
    legR.position.set(0.16, 0.34, 0);
    g.add(legR);
    const x = range(rng, -170, 170);
    const z = range(rng, -170, 170);
    g.position.set(x, 0, z);
    scene.add(g);
    people.push({
      group: g, x, z,
      dir: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.2, 2.4),
      down: 0, downT: 0, bob: range(rng, 0, 6),
      legL, legR,
    });
  }

  function step(dt, playerPos, playerSpeed) {
    for (const p of people) {
      if (p.downT > 0) {
        p.downT -= dt;
        p.group.rotation.x = -Math.PI / 2 + 0.25;
        p.group.position.y = 0.25;
        if (p.downT <= 0) {
          p.group.rotation.x = 0;
          p.group.position.y = 0;
        }
        continue;
      }
      const dx = p.x - playerPos.x;
      const dz = p.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      let sp = p.speed;
      let heading = p.dir;
      if (d < 12 && playerSpeed > 6) {
        // Flee away from the fast player.
        heading = Math.atan2(dx, dz);
        sp = 5.5;
      }
      const nx = p.x + Math.sin(heading) * sp * dt;
      const nz = p.z + Math.cos(heading) * sp * dt;
      const [cx, cz] = collide(nx, nz, 0.5);
      const [kx, kz] = clampPos(cx, cz);
      p.x = kx;
      p.z = kz;
      p.dir = heading;
      p.bob += dt * sp * 3.2;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = heading;
      p.legL.rotation.x = Math.sin(p.bob) * 0.5;
      p.legR.rotation.x = -Math.sin(p.bob) * 0.5;
    }
  }

  // Knock down the nearest pedestrian within range and roughly in front.
  function knockDown(px, pz, facingYaw, rangeMax) {
    let best = null;
    let bestD = 1e9;
    for (const p of people) {
      if (p.downT > 0) continue;
      const dx = p.x - px;
      const dz = p.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > rangeMax) continue;
      const ang = Math.atan2(dx, dz);
      let diff = ang - facingYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.9) continue;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      best.downT = 2.2;
      best.down = 1;
    }
    return best !== null;
  }

  return { people, step, knockDown };
}
