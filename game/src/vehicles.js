// Cars: a mesh builder, parked stealable cars, ambient traffic, and the
// player car's driving physics. Damage is fed by real collisions.
import * as THREE from 'three';
import { Rng } from './rng.js';
import { PITCH } from './city.js';

export const PAINTS = [0xe23b2e, 0xf2c230, 0x2ea88a, 0xe07b26, 0x3fa7d6, 0xf2f2f2, 0x7ec850];

export function makeCarMesh(color, police = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: police ? 0x16161f : color,
    roughness: 0.35,
    metalness: 0.4,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.15, metalness: 0.6 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), cabinMat);
  cabin.position.set(0, 1.05, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 1.4 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), lightMat);
    h.position.set(x, 0.62, 2.12);
    g.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1010, emissive: 0xff2020, emissiveIntensity: 1.2 });
  for (const x of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    t.position.set(x, 0.62, -2.12);
    g.add(t);
  }
  let barL = null;
  let barR = null;
  if (police) {
    // white doors
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
    for (const x of [-0.96, 0.96]) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 1.7), doorMat);
      d.position.set(x, 0.6, -0.2);
      g.add(d);
    }
    const barGeo = new THREE.BoxGeometry(0.5, 0.16, 0.3);
    barL = new THREE.Mesh(
      barGeo,
      new THREE.MeshStandardMaterial({ color: 0xdd1020, emissive: 0xff1020, emissiveIntensity: 2 }),
    );
    barL.position.set(-0.32, 1.38, -0.25);
    g.add(barL);
    barR = new THREE.Mesh(
      barGeo,
      new THREE.MeshStandardMaterial({ color: 0x1040dd, emissive: 0x2040ff, emissiveIntensity: 2 }),
    );
    barR.position.set(0.32, 1.38, -0.25);
    g.add(barR);
  }
  return { group: g, wheels, barL, barR };
}

// The car the player drives. Yaw 0 faces +Z; forward = (sin yaw, cos yaw).
export class PlayerCar {
  constructor(scene, mesh) {
    this.scene = scene;
    this.mesh = mesh;
    this.pos = { x: 0, z: 0 };
    this.yaw = 0;
    this.speed = 0;
    this.damage = 0;
    this.steer = 0;
  }

  place(x, z, yaw) {
    this.pos.x = x;
    this.pos.z = z;
    this.yaw = yaw;
    this.speed = 0;
    this.sync();
  }

  sync() {
    this.mesh.group.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.group.rotation.y = this.yaw;
  }

  // input: {fwd, back, left, right} booleans. Returns collision speed (0 if none).
  drive(dt, input, city) {
    const accel = 13;
    const maxFwd = 27;
    const maxRev = -8;
    if (input.fwd) this.speed += accel * dt;
    if (input.back) this.speed -= (this.speed > 0.5 ? 22 : 9) * dt;
    if (!input.fwd && !input.back) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    }
    this.speed = Math.max(maxRev, Math.min(maxFwd, this.speed));
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 10);
    const grip = Math.min(Math.abs(this.speed) / 6, 1);
    this.yaw += this.steer * 1.7 * dt * grip * (this.speed >= 0 ? 1 : -1);
    const before = { x: this.pos.x, z: this.pos.z };
    this.pos.x += Math.sin(this.yaw) * this.speed * dt;
    this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    const hit = city.collideCircle(this.pos, 1.7);
    let crash = 0;
    if (hit) {
      crash = Math.abs(this.speed);
      if (crash > 3) this.damage = Math.min(100, this.damage + crash * 0.35);
      this.speed *= 0.35;
      // stop dead against the wall instead of sliding along it forever
      if (crash > 8) this.speed = 0;
    }
    this.sync();
    return crash;
  }
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(777);
    this.parked = [];
    this.movers = [];
    this.spawnParked();
    this.spawnMovers();
  }

  spawnParked() {
    const spots = [];
    // one car always sits near the spawn corner so the first steal is close
    spots.push({ x: -5.5, z: 48, yaw: 0.15 });
    for (let i = 0; i < 25; i++) {
      const p = this.city.streetPoint();
      // pull to a street edge, facing along the street
      const alongStreet = Math.abs(p.x % PITCH) < 1;
      const edge = alongStreet ? { x: p.x + (this.rng.chance(0.5) ? -5.5 : 5.5), z: p.z, yaw: this.rng.chance(0.5) ? 0 : Math.PI } : { x: p.x, z: p.z + (this.rng.chance(0.5) ? -5.5 : 5.5), yaw: this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
      spots.push(edge);
    }
    for (const s of spots) {
      const mesh = makeCarMesh(this.rng.pick(PAINTS), false);
      mesh.group.position.set(s.x, 0, s.z);
      mesh.group.rotation.y = s.yaw;
      this.scene.add(mesh.group);
      this.parked.push({ mesh, x: s.x, z: s.z, yaw: s.yaw, damage: 0 });
    }
  }

  spawnMovers() {
    for (let i = 0; i < 10; i++) {
      const axis = this.rng.chance(0.5) ? 'x' : 'z';
      const lane = this.rng.pick([-3, -2, -1, 0, 1, 2, 3]) * PITCH + (this.rng.chance(0.5) ? -2.6 : 2.6);
      const along = this.rng.range(-180, 180);
      const dir = this.rng.chance(0.5) ? 1 : -1;
      const mesh = makeCarMesh(this.rng.pick(PAINTS), false);
      this.scene.add(mesh.group);
      this.movers.push({
        mesh,
        axis,
        lane,
        along,
        dir,
        speed: this.rng.range(6, 10),
        yaw: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
      });
    }
  }

  update(dt, frozen) {
    if (frozen) return;
    for (const m of this.movers) {
      m.along += m.dir * m.speed * dt;
      if (m.along > 195) m.along = -195;
      if (m.along < -195) m.along = 195;
      const x = m.axis === 'x' ? m.along : m.lane;
      const z = m.axis === 'x' ? m.lane : m.along;
      m.mesh.group.position.set(x, 0, z);
      m.mesh.group.rotation.y = m.yaw;
    }
  }

  // Place a mover at an exact spot for a staged shot (and freeze it there).
  placeMover(i, x, z, yaw) {
    const m = this.movers[i % this.movers.length];
    m.mesh.group.position.set(x, 0, z);
    m.mesh.group.rotation.y = yaw;
    m.axis = 'x';
    m.lane = z;
    m.along = x;
    m.dir = 0;
    m.speed = 0;
    m.yaw = yaw;
    return m;
  }

  // Place a parked car at an exact spot for a staged shot.
  placeParked(i, x, z, yaw) {
    const p = this.parked[i % this.parked.length];
    p.x = x;
    p.z = z;
    p.yaw = yaw;
    p.mesh.group.position.set(x, 0, z);
    p.mesh.group.rotation.y = yaw;
    return p;
  }

  nearestParked(x, z, maxD = 60) {
    let best = null;
    let bestD = maxD;
    for (const p of this.parked) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best ? { car: best, dist: bestD } : null;
  }

  removeParked(car) {
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
  }

  addParked(car) {
    this.parked.push(car);
  }
}
