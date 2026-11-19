// Neon Bay — vehicles.js: cars to steal and drive, plus the traffic that fills the streets.
// One clear job: build cars, drive the traffic, and run the player's driving physics.
import * as THREE from 'three';
import { CITY, isWalkable, resolveCollision, mulberry32 } from './city.js';

const CAR_COLORS = [0xd83a3a, 0x3a6fd8, 0xe8c33a, 0x3ad8a0, 0xd8d8d8, 0x2c2c30, 0xd87a3a, 0x8a5fd8, 0x4de8ff, 0xff5da2];
const TOP_SPEED = 46;
const REVERSE_SPEED = 12;

/** Builds one low-poly car from boxes and cylinders. */
export function buildCarMesh(color, isPolice) {
  const car = new THREE.Group();
  car.name = isPolice ? 'police-car' : 'car';
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x182430, roughness: 0.15, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  car.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    car.add(wheel);
    wheels.push(wheel);
  }

  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a8, emissiveIntensity: 1.2 });
  for (const hx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    head.position.set(hx, 0.72, 2.22);
    car.add(head);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xd81f2a, emissive: 0xd81f2a, emissiveIntensity: 0.9 });
  for (const tx of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(tx, 0.72, -2.22);
    car.add(tail);
  }

  let lightBar = null;
  if (isPolice) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }));
    red.position.x = -0.32;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2 }));
    blue.position.x = 0.32;
    bar.add(red); bar.add(blue);
    bar.position.set(0, 1.55, -0.25);
    car.add(bar);
    lightBar = { red: red.material, blue: blue.material };
  }
  return { group: car, wheels, lightBar };
}

/** Makes one car object in the world. */
function makeCar(scene, x, z, heading, color, kind, isPolice) {
  const { group, wheels, lightBar } = buildCarMesh(color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    mesh: group, wheels, lightBar,
    pos: new THREE.Vector3(x, 0, z),
    heading, speed: 0, kind, isPolice: !!isPolice,
    steer: 0, route: null, routeIndex: 0, cruise: 0,
  };
}

/** Repaints a car's body a new colour (the body is the first mesh of the group). */
export function repaint(car, hex) {
  const body = car.mesh.children[0];
  if (body && body.material && body.material.color) body.material.color.setHex(hex);
}

/** Spawns the traffic, the parked cars and the driving model. */
export function createVehicles(scene, city) {
  const rng = mulberry32(777);
  const cars = [];
  const traffic = [];
  const parked = [];

  // Ten traffic cars, each looping a rectangle of streets around one block.
  for (let i = 0; i < 10; i += 1) {
    const bx = CITY.blocks[Math.floor(rng() * CITY.blocks.length)];
    const bz = CITY.blocks[Math.floor(rng() * CITY.blocks.length)];
    const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const car = makeCar(scene, bx - 16, bz - 16 + rng() * 4, 0, color, 'traffic', false);
    car.route = [
      [bx - 16, bz - 16], [bx + 16, bz - 16], [bx + 16, bz + 16], [bx - 16, bz + 16],
    ];
    car.routeIndex = Math.floor(rng() * 4);
    car.cruise = 8 + rng() * 4;
    car.speed = car.cruise;
    cars.push(car); traffic.push(car);
  }

  // Eight parked cars along street edges, ready to be stolen.
  // Each faces along its street: east-west streets take ±PI/2, north-south 0/PI.
  const parkSpots = [
    [24, -16, Math.PI / 2], [-40, 16, -Math.PI / 2], [80, -48, Math.PI / 2], [-112, 48, -Math.PI / 2],
    [48, 80, 0], [-16, -80, Math.PI], [112, 16, Math.PI / 2], [-80, -112, 0],
  ];
  for (const [x, z, h] of parkSpots) {
    const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const car = makeCar(scene, x, z, h, color, 'parked', false);
    cars.push(car); parked.push(car);
  }

  function syncMesh(car) {
    car.mesh.position.set(car.pos.x, 0, car.pos.z);
    car.mesh.rotation.y = car.heading;
    const spin = (car.speed * 0.016) / 0.38;
    for (const w of car.wheels) w.rotation.x += spin;
  }

  return {
    cars, traffic, parked,
    /** The nearest car the player can steal (parked or slow traffic). */
    nearestStealable(pos) {
      let best = null, bestD = 4.5;
      for (const car of cars) {
        if (car.kind === 'player') continue;
        const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
        if (d < bestD) { best = car; bestD = d; }
      }
      return best;
    },
    /** Arcade driving for the car the player is in. */
    drive(car, dt, input, fx) {
      const accel = input.forward ? 24 : 0;
      const brake = input.back ? 34 : 0;
      car.speed += accel * dt;
      car.speed -= brake * dt;
      if (!input.forward && !input.back) car.speed -= car.speed * 0.9 * dt;
      if (car.speed > TOP_SPEED) car.speed = TOP_SPEED;
      if (car.speed < -REVERSE_SPEED) car.speed = -REVERSE_SPEED;
      const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      const steerTarget = steerInput * 0.55 * Math.min(1, Math.abs(car.speed) / 12 + 0.25);
      car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
      const dir = car.speed >= 0 ? 1 : -1;
      car.heading += car.steer * (car.speed / 14) * dir * dt * 1.6;
      const fx2 = Math.sin(car.heading), fz = Math.cos(car.heading);
      let nx = car.pos.x + fx2 * car.speed * dt;
      let nz = car.pos.z + fz * car.speed * dt;
      if (!isWalkable(nx, nz)) { nx = car.pos.x; nz = car.pos.z; car.speed *= 0.4; }
      const fixed = resolveCollision(nx, nz, 2.0, city.colliders);
      if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) {
        if (Math.abs(car.speed) > 14 && fx) fx.sparks(car.pos.x, 1, car.pos.z, 10);
        car.speed *= 0.55;
      }
      car.pos.set(fixed.x, 0, fixed.z);
      // Skid dust when turning hard at speed.
      if (Math.abs(car.steer) > 0.4 && Math.abs(car.speed) > 18 && fx) {
        fx.dust(car.pos.x - fx2 * 1.6, 0.4, car.pos.z - fz * 1.6, 2);
      }
      syncMesh(car);
    },
    /** Chase camera: close behind the car, low, looking ahead. */
    updateCamera(camera, car, dt) {
      const back = 8.5;
      const tx = car.pos.x - Math.sin(car.heading) * back;
      const tz = car.pos.z - Math.cos(car.heading) * back;
      const ty = 3.4;
      const k = Math.min(1, dt * 5);
      camera.position.x += (tx - camera.position.x) * k;
      camera.position.y += (ty - camera.position.y) * k;
      camera.position.z += (tz - camera.position.z) * k;
      camera.lookAt(car.pos.x + Math.sin(car.heading) * 6, 1.4, car.pos.z + Math.cos(car.heading) * 6);
    },
    update(dt, G) {
      // Traffic: follow the loop, slow for the car ahead.
      for (const car of traffic) {
        if (car.kind !== 'traffic') continue;
        const wp = car.route[car.routeIndex];
        const dx = wp[0] - car.pos.x, dz = wp[1] - car.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3) {
          car.routeIndex = (car.routeIndex + 1) % car.route.length;
          continue;
        }
        const want = Math.atan2(dx, dz);
        let diff = want - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += diff * Math.min(1, dt * 2.2);
        // Slow down for a car directly ahead.
        let blocked = false;
        for (const other of cars) {
          if (other === car) continue;
          const ox = other.pos.x - car.pos.x, oz = other.pos.z - car.pos.z;
          const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
          const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
          if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
        }
        const target = blocked ? 0 : car.cruise;
        car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        syncMesh(car);
      }
      void G;
    },
  };
}
