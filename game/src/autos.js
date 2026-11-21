// Cars: a mesh builder, parked stealables, traffic, and police cruisers.
// Player cars are BRIGHT (red, yellow, teal) so the car reads on the road.
// Each car carries live damage (0-100) fed by real collisions and rams.
import * as THREE from 'three';
import { makeRng, range, pick } from './rng.js';

const BRIGHT_PAINT = [0xe02020, 0xffc21a, 0x18b8c8, 0xff7a1a, 0x7ae018, 0xf2f2f2];

export function buildCarMesh(paint, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x1a1a22 : paint, roughness: 0.35, metalness: 0.45,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.1), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x18202c, roughness: 0.15, metalness: 0.6,
  });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.0), cabinMat);
  cabin.position.set(0, 1.08, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  if (isPolice) {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), doorMat);
    doorL.position.set(-0.96, 0.55, 0.1);
    g.add(doorL);
    const doorR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), doorMat);
    doorR.position.set(0.96, 0.55, 0.1);
    g.add(doorR);
  }
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.6,
  });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    h.position.set(hx, 0.55, 2.06);
    g.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2020, emissive: 0xcc0000, emissiveIntensity: 1.4,
  });
  for (const tx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    t.position.set(tx, 0.55, -2.06);
    g.add(t);
  }
  let barL = null;
  let barR = null;
  if (isPolice) {
    barL = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 3 })
    );
    barL.position.set(-0.35, 1.42, -0.25);
    g.add(barL);
    barR = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x0022ff, emissiveIntensity: 3 })
    );
    barR.position.set(0.35, 1.42, -0.25);
    g.add(barR);
  }
  return { group: g, barL, barR };
}

export function buildAutos(scene, seed, collide, clampPos) {
  const rng = makeRng(seed + 7);
  const parked = [];
  const traffic = [];

  // Parked stealables along the streets, bright paint, nose to the kerb.
  for (const s of [-175, -105, -35, 35, 105, 175]) {
    for (let t = -140; t <= 140; t += 56) {
      if (rng() < 0.35) continue;
      const along = rng() < 0.5;
      const x = along ? t + range(rng, -8, 8) : s + pick(rng, [-5.5, 5.5]);
      const z = along ? s + pick(rng, [-5.5, 5.5]) : t + range(rng, -8, 8);
      const yaw = along ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const paint = pick(rng, BRIGHT_PAINT);
      const mesh = buildCarMesh(paint, false);
      mesh.group.position.set(x, 0, z);
      mesh.group.rotation.y = yaw;
      scene.add(mesh.group);
      parked.push({
        mesh, x, z, yaw, paint, damage: 0, stealable: true, police: false,
      });
    }
  }

  // Traffic cars drive the streets on fixed loops, not stealable.
  const lanes = [-175, -105, -35, 35, 105, 175];
  for (let i = 0; i < 10; i++) {
    const horizontal = i % 2 === 0;
    const street = pick(rng, lanes);
    const paint = pick(rng, BRIGHT_PAINT);
    const mesh = buildCarMesh(paint, false);
    scene.add(mesh.group);
    traffic.push({
      mesh, horizontal, street,
      t: range(rng, -175, 175),
      speed: range(rng, 7, 12) * (rng() < 0.5 ? 1 : -1),
      damage: 0, stealable: false, police: false,
    });
  }

  function stepTraffic(dt) {
    for (const car of traffic) {
      car.t += car.speed * dt;
      if (car.t > 185) car.t = -185;
      if (car.t < -185) car.t = 185;
      const off = car.speed > 0 ? 3.4 : -3.4;
      if (car.horizontal) {
        car.mesh.group.position.set(car.t, 0, car.street + off);
        car.mesh.group.rotation.y = car.speed > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.mesh.group.position.set(car.street + off, 0, car.t);
        car.mesh.group.rotation.y = car.speed > 0 ? 0 : Math.PI;
      }
    }
  }

  // Nearest stealable parked car to a point (for E to steal).
  function nearestStealable(x, z) {
    let best = null;
    let bestD = 1e9;
    for (const car of parked) {
      if (!car.stealable) continue;
      const dx = car.x - x;
      const dz = car.z - z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return { car: best, dist: bestD };
  }

  // Drive one car: accel, brake, reverse, steering that scales with speed,
  // building collision (with real damage), city clamp.
  function driveCar(car, dt, keys, collideFn, clampFn) {
    const top = 34;
    if (keys.w) car.v = Math.min(top, car.v + 26 * dt);
    else if (keys.s) car.v = Math.max(-10, car.v - 22 * dt);
    else car.v *= Math.max(0, 1 - 1.6 * dt);
    if (keys.space) car.v *= Math.max(0, 1 - 4 * dt);
    const steer = (keys.a ? 1 : 0) - (keys.d ? 1 : 0);
    const spd = Math.abs(car.v);
    const turn = steer * 1.9 * Math.min(1, spd / 9) * (car.v >= 0 ? 1 : -1);
    car.yaw += turn * dt;
    const nx = car.x + Math.sin(car.yaw) * car.v * dt;
    const nz = car.z + Math.cos(car.yaw) * car.v * dt;
    const [cx, cz] = collideFn(nx, nz, 1.6);
    if ((cx !== nx || cz !== nz) && spd > 4) {
      car.damage = Math.min(100, car.damage + spd * 0.35);
      car.v *= 0.4;
    }
    const [kx, kz] = clampFn(cx, cz);
    car.x = kx;
    car.z = kz;
    car.mesh.group.position.set(car.x, 0, car.z);
    car.mesh.group.rotation.y = car.yaw;
    return car.damage;
  }

  function makeDriven(parkedCar) {
    parkedCar.stealable = false;
    parkedCar.v = 0;
    return parkedCar;
  }

  return { parked, traffic, stepTraffic, nearestStealable, driveCar, makeDriven };
}
