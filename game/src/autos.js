// Cars: a mesh builder plus the parked and traffic fleets. A car faces +Z
// when its yaw is 0, so its forward is (sin(yaw), 0, cos(yaw)).

import * as THREE from 'three';
import { makeSeeded, pick } from './rng.js';
import { collideBuildings, clampToCity, GRID } from './city.js';

export const CAR_COLORS = [0xd23c2e, 0x2f7de1, 0xf2c200, 0x37c978, 0x8b5cf6, 0xe8e8e8, 0x222831, 0xff8c1a];

export function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x1a1d24 : color,
    roughness: 0.35,
    metalness: 0.5,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), paint);
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
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
  }

  const headMat = new THREE.MeshStandardMaterial({ color: 0xffedb0, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xaa1111, emissiveIntensity: 0.8 });
  for (const hx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), headMat);
    head.position.set(hx, 0.6, 2.12);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), tailMat);
    tail.position.set(hx, 0.6, -2.12);
    group.add(tail);
  }

  let lightBar = null;
  if (isPolice) {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
    for (const dx of [-1.01, 1.01]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), doorMat);
      door.position.set(dx, 0.6, 0.3);
      group.add(door);
    }
    lightBar = new THREE.Group();
    const redMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff2222, emissiveIntensity: 2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0000cc, emissive: 0x2244ff, emissiveIntensity: 2 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), redMat);
    red.position.x = -0.45;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), blueMat);
    blue.position.x = 0.45;
    lightBar.add(red, blue);
    lightBar.position.y = 1.5;
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }
  group.userData.lightBar = lightBar;
  return group;
}

// Parked spots: [x, z, yaw] on street centres, facing along the street.
const PARKED_SPOTS = [
  [28, -14, Math.PI], [28, 42, 0], [-28, 84, Math.PI / 2], [84, -56, -Math.PI / 2],
  [-84, -28, Math.PI / 2], [140, 28, 0], [-140, -84, Math.PI], [56, 140, -Math.PI / 2],
  [-56, 28, Math.PI], [112, -28, 0],
];

export function createAutos(scene, city) {
  const rnd = makeSeeded(9917);
  const cars = [];
  const parked = [];
  const traffic = [];

  function registerCar(mesh, kind) {
    const car = {
      mesh,
      pos: mesh.position,
      yaw: 0,
      speed: 0,
      kind,
      radius: 2.0,
      isPolice: false,
    };
    cars.push(car);
    return car;
  }

  for (const [x, z, yaw] of PARKED_SPOTS) {
    const mesh = buildCarMesh(pick(rnd, CAR_COLORS), false);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
    const car = registerCar(mesh, 'parked');
    car.yaw = yaw;
    parked.push(car);
  }

  // Traffic: 8 cars cruising the streets, alternating axes.
  for (let i = 0; i < 8; i++) {
    const alongX = i % 2 === 0;
    const street = pick(rnd, GRID.streets);
    const lane = chance(rnd, 0.5) ? 3.5 : -3.5;
    const dir = chance(rnd, 0.5) ? 1 : -1;
    const mesh = buildCarMesh(pick(rnd, CAR_COLORS), false);
    const start = range(rnd, -140, 140);
    if (alongX) {
      mesh.position.set(start, 0, street + lane);
      mesh.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      mesh.position.set(street + lane, 0, start);
      mesh.rotation.y = dir > 0 ? 0 : Math.PI;
    }
    scene.add(mesh);
    const car = registerCar(mesh, 'traffic');
    car.yaw = mesh.rotation.y;
    car.speed = range(rnd, 7, 12);
    car.axis = alongX ? 'x' : 'z';
    car.dir = dir;
    traffic.push(car);
  }

  function makeCar(x, z, yaw, color, isPolice) {
    const mesh = buildCarMesh(color, isPolice);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
    const car = registerCar(mesh, isPolice ? 'police' : 'parked');
    car.yaw = yaw;
    car.isPolice = isPolice;
    return car;
  }

  function updateTraffic(dt) {
    for (const car of traffic) {
      const step = car.speed * car.dir * dt;
      if (car.axis === 'x') car.pos.x += step;
      else car.pos.z += step;
      const half = city.bounds;
      if (car.pos.x > half) car.pos.x = -half;
      if (car.pos.x < -half) car.pos.x = half;
      if (car.pos.z > half) car.pos.z = -half;
      if (car.pos.z < -half) car.pos.z = half;
      car.mesh.position.copy(car.pos);
    }
  }

  function driveCar(car, dt, input) {
    const accel = 14;
    const maxSpeed = 26;
    const maxReverse = 9;
    if (input.f) car.speed += accel * dt;
    else if (input.b) car.speed -= (car.speed > 0.5 ? 22 : 10) * dt;
    else {
      const drag = 5 * dt;
      car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
    }
    car.speed = Math.max(-maxReverse, Math.min(maxSpeed, car.speed));
    const steer = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    const grip = Math.min(1, Math.abs(car.speed) / 8);
    car.yaw += steer * 1.9 * grip * Math.sign(car.speed) * dt;
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    const before = { x: car.pos.x, z: car.pos.z };
    collideBuildings(car.pos, car.radius, city.buildings);
    clampToCity(car.pos, city.bounds);
    if (car.pos.x !== before.x || car.pos.z !== before.z) car.speed *= 0.5;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
  }

  function nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.kind === 'traffic' || car.isPolice) continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  return { cars, parked, traffic, updateTraffic, driveCar, nearestCar, makeCar };
}

function chance(rnd, p) {
  return rnd() < p;
}

function range(rnd, low, high) {
  return low + rnd() * (high - low);
}
