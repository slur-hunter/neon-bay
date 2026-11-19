// vehicles.js — car meshes, traffic that loops around blocks, parked cars,
// and the driving model for the player's car.
import * as THREE from 'three';
import { BLOCK_LINES, HALF, PITCH, ROAD_LINES } from './city.js';

const CAR_COLORS = [0xd43d2a, 0x2a7ad4, 0xe8c33a, 0x3fae6a, 0xe8e8e8, 0x222226, 0x8a4fd4, 0xe07840];

export function makeCarMesh(color, isPolice) {
  const g = new THREE.Group();
  g.name = isPolice ? 'policeCar' : 'car';
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.25, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    h.position.set(hx, 0.7, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const tx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    t.position.set(tx, 0.7, -2.22);
    g.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.42;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2060ff }));
    blue.position.x = 0.42;
    bar.add(red); bar.add(blue);
    bar.position.set(0, 1.72, -0.2);
    bar.name = 'lightbar';
    bar.userData.red = red;
    bar.userData.blue = blue;
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.42), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    stripe.position.y = 0.55;
    g.add(stripe);
  }
  return g;
}

function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

export class Vehicles {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.traffic = [];
    this.parked = [];
    this.buildTraffic();
    this.buildParked();
  }

  buildTraffic() {
    for (let i = 0; i < 10; i++) {
      const blockX = BLOCK_LINES[Math.floor(this.rng() * BLOCK_LINES.length)];
      const blockZ = BLOCK_LINES[Math.floor(this.rng() * BLOCK_LINES.length)];
      const color = CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)];
      const mesh = makeCarMesh(color, false);
      this.scene.add(mesh);
      const car = {
        mesh, color, isTraffic: true, isPolice: false,
        speed: 6 + this.rng() * 4,
        blockX, blockZ,
        leg: Math.floor(this.rng() * 4),
        heading: 0,
      };
      // place it on its loop right away
      const wp = this.loopWaypoint(car, 0);
      mesh.position.set(wp.x, 0, wp.z);
      this.traffic.push(car);
    }
  }

  // Corners of the road loop around one block, driven clockwise.
  loopCorners(blockX, blockZ) {
    const o = PITCH / 2; // 26: the road centre around the block
    return [
      { x: blockX - o, z: blockZ - o },
      { x: blockX + o, z: blockZ - o },
      { x: blockX + o, z: blockZ + o },
      { x: blockX - o, z: blockZ + o },
    ];
  }

  loopWaypoint(car, ahead) {
    const corners = this.loopCorners(car.blockX, car.blockZ);
    const from = corners[car.leg % 4];
    const to = corners[(car.leg + 1) % 4];
    const t = ahead ? 1 : 0;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    // right-hand lane: offset 3 units to the right of the direction of travel
    const dx = to.x - from.x, dz = to.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    const rx = -dz / len, rz = dx / len;
    return { x: x + rx * 3, z: z + rz * 3 };
  }

  buildParked() {
    // Parked cars sit parallel to their street, facing along it — never crosswise.
    const spots = [
      { road: 26, along: 8, axis: 'x', dir: 1 },
      { road: 26, along: -40, axis: 'x', dir: -1 },
      { road: -26, along: 60, axis: 'x', dir: 1 },
      { road: 78, along: -90, axis: 'x', dir: -1 },
      { road: -78, along: 30, axis: 'x', dir: 1 },
      { road: 26, along: 100, axis: 'z', dir: 1 },
      { road: -26, along: -70, axis: 'z', dir: -1 },
      { road: 78, along: -20, axis: 'z', dir: 1 },
    ];
    for (const s of spots) {
      const color = CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)];
      const mesh = makeCarMesh(color, false);
      this.scene.add(mesh);
      let x, z, heading;
      if (s.axis === 'x') {
        x = s.along; z = s.road + (s.dir > 0 ? 4 : -4);
        heading = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = s.road + (s.dir > 0 ? 4 : -4); z = s.along;
        heading = s.dir > 0 ? 0 : Math.PI;
      }
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
      this.parked.push({ mesh, color, isParked: true, isTraffic: false, isPolice: false, heading, speed: 0 });
    }
  }

  // The parked car nearest the spawn point, used by the live test and shot 2.
  spawnCar() {
    let best = null, bestD = 1e9;
    for (const c of this.parked) {
      const d = Math.hypot(c.mesh.position.x - 0, c.mesh.position.z - 30);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  nearestCar(pos, maxDist, includeTraffic) {
    let best = null, bestD = maxDist;
    const list = includeTraffic ? this.parked.concat(this.traffic) : this.parked;
    for (const c of list) {
      if (c.taken) continue;
      const d = Math.hypot(c.mesh.position.x - pos.x, c.mesh.position.z - pos.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // Drive the player's car: W accelerates, S brakes/reverses, A/D steer, Space brakes.
  // All motion is dt-scaled so it is frame-rate independent.
  drive(car, input, dt) {
    const topSpeed = 30;
    if (input.forward) car.speed += 22 * dt;
    if (input.back) car.speed -= 26 * dt;
    if (input.brake) car.speed -= 40 * dt * Math.sign(car.speed || 1);
    if (!input.forward && !input.back) {
      const drag = 8 * dt;
      if (Math.abs(car.speed) <= drag) car.speed = 0;
      else car.speed -= Math.sign(car.speed) * drag;
    }
    car.speed = Math.max(-9, Math.min(topSpeed, car.speed));
    const steerAmount = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    if (Math.abs(car.speed) > 0.2) {
      const turn = steerAmount * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed);
      car.heading += turn;
    }
    const f = forwardOf(car.heading);
    car.mesh.position.x += f.x * car.speed * dt;
    car.mesh.position.z += f.z * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    this.city.collideCircle(car.mesh.position, 2.2);
    this.city.clampToCity(car.mesh.position, -2);
    // bump traffic cars out of the way instead of passing through them
    for (const other of this.traffic) {
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 4.4) {
        const push = (4.4 - d) / 2;
        other.mesh.position.x += (dx / d) * push;
        other.mesh.position.z += (dz / d) * push;
        car.speed *= 0.92;
      }
    }
  }

  update(dt, playerCar) {
    for (const car of this.traffic) {
      if (car === playerCar) continue;
      const target = this.loopWaypoint(car, 1);
      const p = car.mesh.position;
      const dx = target.x - p.x, dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const slow = dist < 6 ? 0.55 : 1;
      const f = forwardOf(car.heading);
      p.x += f.x * car.speed * slow * dt;
      p.z += f.z * car.speed * slow * dt;
      car.mesh.rotation.y = car.heading;
      if (dist < 1.6) car.leg = (car.leg + 1) % 4;
    }
  }
}

export { HALF, ROAD_LINES };
