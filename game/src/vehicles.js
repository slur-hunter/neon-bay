// vehicles.js — cars: parked cars facing along their street, traffic driving
// its lanes, and the car Rico steals and drives. dt-based physics throughout.
import * as THREE from 'three';
import { collideBuildings, clampToCity, CITY } from './city.js';

const PAINT = [0xd23c2e, 0x2f7de1, 0xf2c200, 0x37c978, 0x8b5cf6, 0xe8e8e8, 0x222831, 0xff8c1a];

export function buildCarMesh(color, isPolice) {
  const car = new THREE.Group();

  const paint = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x1a1d24 : color,
    roughness: 0.35,
    metalness: 0.5,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  car.add(body);

  const glass = new THREE.MeshStandardMaterial({
    color: isPolice ? 0xf2f2f2 : 0x18202c,
    roughness: 0.25,
    metalness: 0.6,
  });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.0), glass);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  car.add(cabin);

  if (isPolice) {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
    const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), doorMat);
    leftDoor.position.set(-1.01, 0.6, 0.3);
    car.add(leftDoor);
    const rightDoor = leftDoor.clone();
    rightDoor.position.x = 1.01;
    car.add(rightDoor);
  }

  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const wheel = new THREE.Mesh(tyreGeo, tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    car.add(wheel);
  }

  const beamMat = new THREE.MeshStandardMaterial({
    color: 0xfff6c9, emissive: 0xffedb0, emissiveIntensity: 0.9,
  });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), beamMat);
    lamp.position.set(x, 0.6, 2.12);
    car.add(lamp);
  }
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xdd2222, emissive: 0xaa1111, emissiveIntensity: 0.8,
  });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), tailMat);
    lamp.position.set(x, 0.6, -2.12);
    car.add(lamp);
  }

  // Police light bar: red left, blue right, flashing by time.
  let bar = null;
  if (isPolice) {
    bar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }),
    );
    red.position.set(-0.45, 1.5, -0.2);
    bar.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 }),
    );
    blue.position.set(0.45, 1.5, -0.2);
    bar.add(blue);
    bar.userData = { red, blue };
    car.add(bar);
  }

  car.userData.lightBar = bar;
  return car;
}

export function createVehicles(scene, city) {
  const all = [];
  let seed = 777;
  const pick = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  function spawn(x, z, yaw, color, isPolice, kind) {
    const mesh = buildCarMesh(color, isPolice);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
    const car = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      yaw,
      speed: 0,
      color,
      isPolice,
      kind,
      radius: 2.0,
      steer: 0,
      lane: 0,
      axis: 'x',
      dir: 1,
    };
    all.push(car);
    return car;
  }

  // Parked cars along street edges, always facing along their street.
  const spots = [
    { x: 24, z: -30, yaw: Math.PI / 2 },
    { x: 24, z: 30, yaw: -Math.PI / 2 },
    { x: -36, z: 90, yaw: Math.PI / 2 },
    { x: 96, z: -90, yaw: -Math.PI / 2 },
    { x: -24, z: -90, yaw: Math.PI / 2 },
    { x: 36, z: 150, yaw: Math.PI / 2 },
    { x: -96, z: 30, yaw: -Math.PI / 2 },
    { x: 144, z: 30, yaw: Math.PI / 2 },
    { x: 84, z: 90, yaw: -Math.PI / 2 },
    { x: -144, z: -30, yaw: Math.PI / 2 },
  ];
  const parked = spots.map((s) =>
    spawn(s.x, s.z, s.yaw, PAINT[Math.floor(pick() * PAINT.length)], false, 'parked'));

  // Traffic: straight down a lane, wrapping at the city edge.
  const traffic = [];
  for (let i = 0; i < 8; i++) {
    const axis = i % 2 === 0 ? 'x' : 'z';
    const street = CITY.streetCenters[Math.floor(pick() * CITY.streetCenters.length)];
    const lane = (pick() < 0.5 ? -1 : 1) * 3.5;
    const dir = pick() < 0.5 ? 1 : -1;
    const along = (pick() * 2 - 1) * (CITY.half - 10);
    const x = axis === 'x' ? along : street + lane;
    const z = axis === 'x' ? street + lane : along;
    const yaw = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = spawn(x, z, yaw, PAINT[Math.floor(pick() * PAINT.length)], false, 'traffic');
    car.axis = axis;
    car.dir = dir;
    car.lane = lane;
    car.speed = 7 + pick() * 5;
    car.street = street;
    traffic.push(car);
  }

  function updateTraffic(dt) {
    for (const car of traffic) {
      if (car.axis === 'x') {
        car.pos.x += car.dir * car.speed * dt;
        if (car.pos.x > CITY.half) car.pos.x = -CITY.half;
        if (car.pos.x < -CITY.half) car.pos.x = CITY.half;
      } else {
        car.pos.z += car.dir * car.speed * dt;
        if (car.pos.z > CITY.half) car.pos.z = -CITY.half;
        if (car.pos.z < -CITY.half) car.pos.z = CITY.half;
      }
      car.mesh.position.copy(car.pos);
    }
  }

  // Player-driven car physics. input: {f,b,l,r,brake}. dt-scaled everywhere.
  function driveCar(car, dt, input) {
    const accel = 14;
    const topSpeed = 26;
    const topReverse = 9;
    if (input.f) car.speed += accel * dt;
    if (input.b) car.speed -= accel * 0.7 * dt;
    if (input.brake) car.speed -= Math.sign(car.speed) * 22 * dt;
    if (!input.f && !input.b) car.speed -= Math.sign(car.speed) * 5 * dt;
    if (Math.abs(car.speed) < 0.2 && !input.f && !input.b) car.speed = 0;
    car.speed = Math.max(-topReverse, Math.min(topSpeed, car.speed));

    const wantSteer = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    car.steer += (wantSteer - car.steer) * Math.min(1, dt * 8);
    const grip = Math.min(1, Math.abs(car.speed) / 8);
    car.yaw += car.steer * 1.9 * grip * Math.sign(car.speed) * dt;

    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    collideBuildings(car.pos, car.radius, city.buildings);
    clampToCity(car.pos, city.bounds - 2);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
  }

  function nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of all) {
      if (car.kind === 'traffic') continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  return { cars: all, parked, traffic, updateTraffic, driveCar, nearestCar, makeCar: spawn };
}
