// Neon Bay v7 — vehicles. Procedural car meshes (civilian + police), parked cars
// to steal, traffic that cruises the streets, and arcade driving.
import * as THREE from 'three';
import { makeSeededRandom, pickFrom } from './seed.js';
import { GRID, collideSolids, clampToBounds } from './metropolis.js';

const PAINT = [0xd23c2e, 0x2f7de1, 0xf2c200, 0x37c978, 0x8b5cf6, 0xe8e8e8, 0x222831, 0xff8c1a, 0x3aa7a3];

// Parked (stealable) cars: [x, z, heading]. Headings point along their street.
const PARKED_SPOTS = [
  [30, -23, Math.PI / 2], [ -30, 23, -Math.PI / 2], [69, -69, Math.PI / 2],
  [-69, 69, -Math.PI / 2], [23, 115, 0], [-23, -115, Math.PI],
  [115, 69, -Math.PI / 2], [-115, -69, Math.PI / 2], [30, 69, Math.PI / 2],
  [-30, -69, -Math.PI / 2],
];

export function buildCarMesh(color, isPolice) {
  const bodyColor = isPolice ? 0x1a1d24 : color;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.0),
    new THREE.MeshStandardMaterial({ color: isPolice ? 0xf2f2f2 : 0x18202c, roughness: 0.25, metalness: 0.6 }),
  );
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    group.add(w);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  for (const sx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), headMat);
    h.position.set(sx, 0.6, 2.12);
    group.add(h);
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.18, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xaa1111, emissiveIntensity: 0.8 }),
    );
    t.position.set(sx, 0.6, -2.12);
    group.add(t);
  }
  let lightBar = null;
  if (isPolice) {
    // White door panels.
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
    for (const sx of [-1.01, 1.01]) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), doorMat);
      d.position.set(sx, 0.6, 0.3);
      group.add(d);
    }
    lightBar = new THREE.Group();
    const redMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff2222, emissiveIntensity: 2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0000cc, emissive: 0x2222ff, emissiveIntensity: 2 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), redMat);
    red.position.x = -0.45;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), blueMat);
    blue.position.x = 0.45;
    lightBar.add(red, blue);
    lightBar.position.y = 1.5;
    lightBar.userData = { red: redMat, blue: blueMat };
    group.add(lightBar);
  }
  group.userData.lightBar = lightBar;
  return group;
}

export function createTraffic(scene, city) {
  const rnd = makeSeededRandom(4242);
  const cars = [];
  const parked = [];
  const traffic = [];

  function register(mesh, kind, pos, yaw) {
    const car = { mesh, pos, yaw, speed: 0, isPolice: false, kind, radius: 2.0, steer: 0 };
    mesh.position.set(pos.x, 0, pos.z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
    cars.push(car);
    return car;
  }

  for (const [x, z, yaw] of PARKED_SPOTS) {
    const mesh = buildCarMesh(pickFrom(rnd, PAINT), false);
    const car = register(mesh, 'parked', new THREE.Vector3(x, 0, z), yaw);
    parked.push(car);
  }

  // Traffic: 8 cars cruising streets, alternating axis.
  for (let i = 0; i < 8; i++) {
    const axisX = i % 2 === 0;
    const street = pickFrom(rnd, GRID.streetCenters);
    const lane = (rnd() < 0.5 ? -1 : 1) * 3.5;
    const dir = rnd() < 0.5 ? -1 : 1;
    const along = (rnd() * 2 - 1) * (GRID.half - 10);
    const pos = axisX
      ? new THREE.Vector3(along, 0, street + lane)
      : new THREE.Vector3(street + lane, 0, along);
    const yaw = axisX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const mesh = buildCarMesh(pickFrom(rnd, PAINT), false);
    const car = register(mesh, 'traffic', pos, yaw);
    car.speed = 7 + rnd() * 5;
    car.axisX = axisX;
    car.dir = dir;
    traffic.push(car);
  }

  function updateTraffic(dt) {
    for (const car of traffic) {
      if (car.axisX) car.pos.x += car.dir * car.speed * dt;
      else car.pos.z += car.dir * car.speed * dt;
      const lim = GRID.half;
      if (car.axisX && Math.abs(car.pos.x) > lim) car.pos.x = -Math.sign(car.pos.x) * lim;
      if (!car.axisX && Math.abs(car.pos.z) > lim) car.pos.z = -Math.sign(car.pos.z) * lim;
      car.mesh.position.copy(car.pos);
    }
  }

  // Arcade driving for the car Rico is in. input: {f, b, l, r, brake}.
  function driveCar(car, dt, input) {
    const ACCEL = 14, MAX_FWD = 26, MAX_REV = 9, BRAKE = 22, COAST = 5;
    if (input.f) car.speed += ACCEL * dt;
    if (input.b) car.speed -= ACCEL * 0.7 * dt;
    if (input.brake) car.speed -= Math.sign(car.speed) * BRAKE * dt;
    if (!input.f && !input.b) {
      const d = COAST * dt;
      car.speed = Math.abs(car.speed) <= d ? 0 : car.speed - Math.sign(car.speed) * d;
    }
    car.speed = Math.max(-MAX_REV, Math.min(MAX_FWD, car.speed));
    const steer = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    car.steer += (steer - car.steer) * Math.min(1, dt * 8);
    const grip = Math.min(1, Math.abs(car.speed) / 8);
    car.yaw += car.steer * 1.9 * grip * Math.sign(car.speed) * dt;
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    const before = car.pos.clone();
    collideSolids(car.pos, car.radius, city.solids);
    clampToBounds(car.pos, city.bounds);
    if (!car.pos.equals(before)) car.speed *= 0.4; // scrub speed on a wall
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
  }

  function nearestStealable(pos, maxDist) {
    let best = null, bestD = maxDist;
    for (const car of cars) {
      if (car.kind === 'traffic') continue;
      if (car.kind === 'police') continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function makeCar(x, z, yaw, color, isPolice) {
    const mesh = buildCarMesh(color, isPolice);
    return register(mesh, isPolice ? 'police' : 'civilian', new THREE.Vector3(x, 0, z), yaw);
  }

  return { cars, parked, traffic, updateTraffic, driveCar, nearestStealable, makeCar };
}
