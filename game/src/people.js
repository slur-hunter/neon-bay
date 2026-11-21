// Pedestrians: real people walking the sidewalks who flee when a car speeds
// near them, and fall over when punched (then get back up).
import * as THREE from 'three';
import { Rng } from './rng.js';
import { PITCH, CITY_LIMIT } from './city.js';

const SHIRTS = [0x3fa7d6, 0xe23b2e, 0xf2c230, 0x7ec850, 0xe07b26, 0xc86dd6, 0xf2f2f2, 0x2ea88a];
const SKINS = [0xd9a077, 0xb07a4f, 0x8a5a34, 0xe8b98d];

function makePedMesh(shirt, skin) {
  const g = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f45, roughness: 0.9 });
  const legGeo = new THREE.BoxGeometry(0.16, 0.75, 0.16);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.11, 0.38, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.11, 0.38, 0);
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.62, 0.28),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 }),
  );
  torso.position.y = 1.06;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }),
  );
  head.position.y = 1.55;
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.8 }),
  );
  cap.position.y = 1.73;
  g.add(legL, legR, torso, head, cap);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { group: g, legL, legR };
}

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(4242);
    this.list = [];
    for (let i = 0; i < 20; i++) {
      const mesh = makePedMesh(this.rng.pick(SHIRTS), this.rng.pick(SKINS));
      this.scene.add(mesh.group);
      const p = this.city.streetPoint();
      // nudge onto a sidewalk edge
      const onXStreet = Math.abs(p.x % PITCH) < 1;
      const x = onXStreet ? p.x + this.rng.pick([-10, 10]) : p.x;
      const z = onXStreet ? p.z : p.z + this.rng.pick([-10, 10]);
      this.list.push({
        mesh,
        x,
        z,
        yaw: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.1, 1.9),
        state: 'walk',
        timer: 0,
        tx: x,
        tz: z,
        bob: this.rng.range(0, Math.PI * 2),
      });
      this.pickTarget(this.list[this.list.length - 1]);
    }
  }

  pickTarget(p) {
    // a nearby point on a sidewalk: offset from a street centreline
    const s = this.city.streetPoint();
    const onXStreet = Math.abs(s.x % PITCH) < 1;
    p.tx = onXStreet ? s.x + this.rng.pick([-10, 10]) : s.x;
    p.tz = onXStreet ? s.z : s.z + this.rng.pick([-10, 10]);
    p.tx = Math.max(-CITY_LIMIT, Math.min(CITY_LIMIT, p.tx));
    p.tz = Math.max(-CITY_LIMIT, Math.min(CITY_LIMIT, p.tz));
  }

  update(dt, playerPos, playerSpeed, frozen) {
    for (const p of this.list) {
      if (p.state === 'down') {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.state = 'walk';
          p.mesh.group.rotation.x = 0;
          p.mesh.group.position.y = 0;
        }
        continue;
      }
      if (frozen) continue;
      // flee from a speeding car
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (playerSpeed > 7 && d < 10) {
        p.state = 'flee';
        p.timer = 2;
      }
      if (p.state === 'flee') {
        p.timer -= dt;
        const a = Math.atan2(p.x - playerPos.x, p.z - playerPos.z);
        p.x += Math.sin(a) * 3.6 * dt;
        p.z += Math.cos(a) * 3.6 * dt;
        p.yaw = a;
        if (p.timer <= 0) p.state = 'walk';
      } else {
        const dx = p.tx - p.x;
        const dz = p.tz - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.5) {
          this.pickTarget(p);
        } else {
          const want = Math.atan2(dx, dz);
          let diff = want - p.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          p.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
          p.x += Math.sin(p.yaw) * p.speed * dt;
          p.z += Math.cos(p.yaw) * p.speed * dt;
        }
      }
      p.x = Math.max(-CITY_LIMIT, Math.min(CITY_LIMIT, p.x));
      p.z = Math.max(-CITY_LIMIT, Math.min(CITY_LIMIT, p.z));
      p.bob += dt * 7;
      p.mesh.group.position.set(p.x, Math.abs(Math.sin(p.bob)) * 0.04, p.z);
      p.mesh.group.rotation.y = p.yaw;
      p.mesh.legL.rotation.x = Math.sin(p.bob) * 0.5;
      p.mesh.legR.rotation.x = -Math.sin(p.bob) * 0.5;
    }
  }

  // Place a pedestrian at an exact spot for a staged shot.
  placeAt(i, x, z, yaw) {
    const p = this.list[i % this.list.length];
    p.x = x;
    p.z = z;
    p.yaw = yaw;
    p.tx = x;
    p.tz = z;
    p.state = 'walk';
    p.mesh.group.position.set(x, 0, z);
    p.mesh.group.rotation.set(0, yaw, 0);
    return p;
  }

  knockDown(p) {
    if (p.state === 'down') return;
    p.state = 'down';
    p.timer = 3;
    p.mesh.group.rotation.x = -Math.PI / 2;
    p.mesh.group.position.y = 0.35;
  }

  nearest(x, z, maxD = 3) {
    let best = null;
    let bestD = maxD;
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best ? { ped: best, dist: bestD } : null;
  }
}
