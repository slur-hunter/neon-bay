// Cars: a mesh builder, parked cars (stealable), traffic movers (driving
// along streets) and the driving model. Every car carries a live damage
// value fed by real collisions and police rams.
import * as THREE from 'three';
import { mulberry32, pick, clamp, dist2 } from './rng.js';
import { STREET_LINES, STREET_HALF } from './city.js';

const PAINTS = [0x2fae5f, 0xe84a3a, 0xffc93c, 0x2f9ae8, 0xff7a1f, 0xf2f2f2, 0x9a4ae8];

export function makeCarMesh(color, police) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: police ? 0x16161e : color, roughness: 0.35, metalness: 0.55,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.2, metalness: 0.6 }),
  );
  cabin.position.set(0, 1.1, -0.25);
  group.add(body, cabin);
  if (police) {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), doorMat);
      door.position.set(s * 1.01, 0.6, 0.1);
      group.add(door);
    }
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    group.add(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    h.position.set(s * 0.62, 0.62, 2.22);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    t.position.set(s * 0.62, 0.62, -2.22);
    group.add(t);
  }
  let barL = null;
  let barR = null;
  if (police) {
    const barBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.14, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.5 }),
    );
    barBase.position.set(0, 1.44, 0.1);
    group.add(barBase);
    barL = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.2, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    barL.position.set(-0.33, 1.54, 0.1);
    barR = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.2, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2050ff }),
    );
    barR.position.set(0.33, 1.54, 0.1);
    group.add(barL, barR);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, barL, barR };
}

export function makeVehicles(scene, city) {
  const rng = mulberry32(4242);
  const parked = [];
  const movers = [];

  function addParked(x, z, color) {
    const { group } = makeCarMesh(color ?? pick(rng, PAINTS), false);
    group.position.set(x, 0, z);
    group.rotation.y = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    scene.add(group);
    const car = { group, x, z, yaw: group.rotation.y, parked: true, damage: 0, speed: 0 };
    parked.push(car);
    return car;
  }

  function addMover(x, z, dir, color) {
    const { group } = makeCarMesh(color ?? pick(rng, PAINTS), false);
    group.position.set(x, 0, z);
    group.rotation.y = dir;
    scene.add(group);
    const car = {
      group, x, z, yaw: dir, parked: false, damage: 0,
      speed: 0, frozen: false, dir, lane: Math.round(x / 60) * 60,
    };
    movers.push(car);
    return car;
  }

  // Deterministic parked cars along streets, one always near the spawn
  // corner so the first steal is easy to reach.
  addParked(5, 28, 0x2fae5f);
  for (let i = 0; i < 14; i++) {
    const street = pick(rng, STREET_LINES);
    const along = Math.floor((rng() * 5 - 2)) * 60 + (rng() < 0.5 ? 24 : -24);
    const side = rng() < 0.5 ? 5.5 : -5.5;
    if (rng() < 0.5) addParked(street + side, along);
    else addParked(along, street + side);
  }
  // Ambient traffic driving the grid.
  for (let i = 0; i < 10; i++) {
    const street = pick(rng, STREET_LINES);
    const along = (Math.floor(rng() * 6) - 3) * 60;
    const dir = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    if (rng() < 0.5) addMover(street + (rng() < 0.5 ? 3 : -3), along, dir);
    else addMover(along, street + (rng() < 0.5 ? 3 : -3), dir);
    movers[movers.length - 1].speed = 7 + rng() * 4;
  }

  function nearestStealable(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of parked) {
      if (c.taken) continue;
      const d = dist2(x, z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // Drive one car: acceleration, speed-scaled steering, building
  // collision, city clamp. Returns nothing; the car object is updated.
  function driveCar(car, input, dt, city) {
    const maxFwd = 26;
    const maxRev = 8;
    if (input.f > 0) car.speed += 15 * dt;
    else if (input.f < 0) car.speed -= 12 * dt;
    else car.speed -= Math.sign(car.speed) * 6 * dt;
    if (input.brake) car.speed -= Math.sign(car.speed) * 22 * dt;
    if (Math.abs(car.speed) < 0.15 && input.f === 0) car.speed = 0;
    car.speed = clamp(car.speed, -maxRev, maxFwd);
    const steerScale = clamp(1 - Math.abs(car.speed) / 30, 0.22, 1);
    // D (input.s > 0) turns right: yaw decreases (forward = sin/cos yaw).
    car.yaw -= input.s * 0.62 * steerScale * dt * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
    const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
    const hit = city.collide(nx, nz, 1.7);
    if (hit.x !== nx || hit.z !== nz) {
      car.damage = clamp(car.damage + Math.abs(car.speed) * 0.35, 0, 100);
      car.speed *= 0.4;
    }
    const cl = city.clampPos(hit.x, hit.z);
    car.x = cl.x;
    car.z = cl.z;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.yaw;
  }

  function stepMovers(dt, city) {
    for (const m of movers) {
      if (m.frozen) continue;
      const nx = m.x + Math.sin(m.yaw) * m.speed * dt;
      const nz = m.z + Math.cos(m.yaw) * m.speed * dt;
      const cl = city.clampPos(nx, nz);
      if (cl.x !== nx || cl.z !== nz) {
        // reached the city edge: turn around on the same street
        m.yaw += Math.PI;
        m.x = cl.x;
        m.z = cl.z;
      } else {
        m.x = nx;
        m.z = nz;
      }
      const fixed = city.collide(m.x, m.z, 1.7);
      m.x = fixed.x;
      m.z = fixed.z;
      m.group.position.set(m.x, 0, m.z);
      m.group.rotation.y = m.yaw;
    }
  }

  return { parked, movers, addParked, addMover, nearestStealable, driveCar, stepMovers };
}
