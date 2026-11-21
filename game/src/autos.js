// Cars: a mesh builder, parked stealable cars, traffic, and driving.
// Every car carries a damage value fed by real collisions and rams.
import * as THREE from 'three';
import { CITY_HALF, STREET_AT } from './city.js';

const PAINTS = [0xc23b2e, 0x2e6fc2, 0xd8a13b, 0x3aa17a, 0x8a4fd0, 0xd8d8d8, 0x2a2a33];

export function makeCarMesh(color, police) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2433, roughness: 0.1, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.1, -0.25);
  g.add(body, cabin);
  if (police) {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.3 });
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.9), doorMat);
    doorL.position.set(-1.01, 0.6, 0);
    const doorR = doorL.clone();
    doorR.position.x = 1.01;
    g.add(doorL, doorR);
  }
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat);
    h.position.set(hx, 0.62, 2.16);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tailMat);
    t.position.set(hx, 0.62, -2.16);
    g.add(t);
  }
  let barL = null, barR = null;
  if (police) {
    barL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    barL.position.set(-0.35, 1.45, -0.25);
    barR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    barR.position.set(0.35, 1.45, -0.25);
    g.add(barL, barR);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, barL, barR };
}

export function buildAutos(scene, rng, collide) {
  const parked = [];
  const traffic = [];
  // Parked cars along street edges, stealable.
  for (let k = 0; k < 26; k++) {
    const s = rng.pick(STREET_AT);
    const along = rng.range(-CITY_HALF + 14, CITY_HALF - 14);
    const horiz = rng.chance(0.5);
    const x = horiz ? along : s + (rng.chance(0.5) ? 5.2 : -5.2);
    const z = horiz ? s + (rng.chance(0.5) ? 5.2 : -5.2) : along;
    const yaw = horiz ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const { group } = makeCarMesh(rng.pick(PAINTS), false);
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    scene.add(group);
    parked.push({ group, x, z, yaw, speed: 0, damage: 0, stolen: false });
  }
  // Traffic cars driving the streets.
  for (let k = 0; k < 14; k++) {
    const s = rng.pick(STREET_AT);
    const horiz = rng.chance(0.5);
    const lane = rng.chance(0.5) ? 2.6 : -2.6;
    const x = horiz ? rng.range(-CITY_HALF + 10, CITY_HALF - 10) : s + lane;
    const z = horiz ? s + lane : rng.range(-CITY_HALF + 10, CITY_HALF - 10);
    const dir = rng.chance(0.5) ? 1 : -1;
    const yaw = horiz ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const { group } = makeCarMesh(rng.pick(PAINTS), false);
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    scene.add(group);
    traffic.push({
      group, x, z, yaw, horiz, street: s, lane, dir,
      speed: rng.range(7, 11), damage: 0,
    });
  }
  return {
    parked, traffic,
    nearestStealable(x, z) {
      let best = null, bd = 1e9;
      for (const c of parked) {
        if (c.stolen) continue;
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bd) { bd = d; best = c; }
      }
      return bd < 5 ? best : null;
    },
    updateTraffic(dt) {
      for (const c of traffic) {
        if (c.horiz) c.x += c.dir * c.speed * dt;
        else c.z += c.dir * c.speed * dt;
        if (c.x > CITY_HALF - 6) c.x = -CITY_HALF + 6;
        if (c.x < -CITY_HALF + 6) c.x = CITY_HALF - 6;
        if (c.z > CITY_HALF - 6) c.z = -CITY_HALF + 6;
        if (c.z < -CITY_HALF + 6) c.z = CITY_HALF - 6;
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.yaw;
      }
    },
  };
}

// Arcade driving for the car the player stole.
export function driveCar(car, input, dt, collide) {
  const maxF = 26, maxR = 9, accel = 16, brake = 30;
  if (input.forward) car.speed += accel * dt;
  if (input.back) car.speed -= (car.speed > 0.5 ? brake : accel * 0.55) * dt;
  if (!input.forward && !input.back) car.speed -= Math.sign(car.speed) * 6 * dt;
  if (Math.abs(car.speed) < 0.15 && !input.forward && !input.back) car.speed = 0;
  car.speed = Math.max(-maxR, Math.min(maxF, car.speed));
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerScale = Math.min(1, Math.abs(car.speed) / 8) * 1.9;
  car.yaw += steer * steerScale * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
  const fixed = collide(nx, nz, 2.2);
  if (Math.hypot(fixed.x - nx, fixed.z - nz) > 0.01 && Math.abs(car.speed) > 4) {
    car.damage = Math.min(100, car.damage + Math.abs(car.speed) * 0.35);
    car.speed *= 0.45;
  }
  car.x = fixed.x; car.z = fixed.z;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.yaw;
}
