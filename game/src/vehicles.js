// createVehicles builds cars: the player car, traffic that follows the roads,
// parked cars to steal, and police cars. One clear job: everything with wheels.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

const ROAD_LINES = [-180, -140, -100, -60, -20, 20, 60, 100, 140, 180];

export function makeCar(color, kind) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x0e1a24 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0e });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    group.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    h.position.set(hx, 0.7, 2.22);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const tx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    t.position.set(tx, 0.7, -2.22);
    group.add(t);
  }
  let lightBar = null;
  if (kind === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.4;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.75, -0.2);
    lightBar.userData.red = red;
    lightBar.userData.blue = blue;
    group.add(lightBar);
  }
  return { group, wheels, lightBar, kind, color };
}

export function createVehicles(scene, city, seed) {
  const rng = mulberry32(seed + 77);
  const cars = [];
  const trafficColors = [0xc0392b, 0x2980b9, 0xf39c12, 0x8e44ad, 0x16a085, 0xd5dbdb, 0x2c3e50, 0xe67e22];

  function addCar(color, kind, x, z, heading) {
    const car = makeCar(color, kind);
    car.pos = new THREE.Vector3(x, 0, z);
    car.heading = heading;
    car.speed = 0;
    car.steer = 0;
    car.group.position.copy(car.pos);
    car.group.rotation.y = heading;
    scene.add(car.group);
    cars.push(car);
    return car;
  }

  // parked cars along the roads, ready to steal
  const parkedSpots = [
    [26, -14, 0], [26, 66, 0], [-34, 26, Math.PI], [66, -34, Math.PI / 2],
    [-66, 106, -Math.PI / 2], [106, 146, 0], [-146, -66, Math.PI], [146, -106, Math.PI / 2],
  ];
  const parked = [];
  for (const [x, z, h] of parkedSpots) {
    const car = addCar(trafficColors[Math.floor(rng() * trafficColors.length)], 'parked', x, z, h);
    parked.push(car);
  }

  // traffic cars driving the road grid
  const traffic = [];
  for (let i = 0; i < 10; i++) {
    const horizontal = rng() < 0.5;
    const road = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const along = -160 + rng() * 320;
    const heading = horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = addCar(trafficColors[Math.floor(rng() * trafficColors.length)], 'traffic',
      horizontal ? along : road + 3, horizontal ? road + 3 : along, heading);
    car.cruise = 10 + rng() * 5;
    car.speed = car.cruise;
    traffic.push(car);
  }

  function driveTraffic(car, dt) {
    // move along the current heading; at the next grid line, pick a turn
    const step = car.speed * dt;
    const nx = car.pos.x + Math.sin(car.heading) * step;
    const nz = car.pos.z + Math.cos(car.heading) * step;
    car.pos.x = nx;
    car.pos.z = nz;
    // when crossing a grid line, pick straight or a turn
    const axis = Math.abs(Math.sin(car.heading)) > 0.5 ? 'x' : 'z';
    const along = axis === 'x' ? car.pos.x : car.pos.z;
    const lines = ROAD_LINES;
    for (const r of lines) {
      const before = axis === 'x' ? car.pos.x - Math.sin(car.heading) * step : car.pos.z - Math.cos(car.heading) * step;
      const after = along;
      if ((before < r && after >= r) || (before > r && after <= r)) {
        const roll = rng();
        if (roll < 0.6) {
          // straight on, snap to the lane
          if (axis === 'x') car.pos.z = Math.round(car.pos.z / 40) * 40 + 3;
          else car.pos.x = Math.round(car.pos.x / 40) * 40 + 3;
        } else {
          // turn left or right onto the crossing road
          const turn = roll < 0.8 ? Math.PI / 2 : -Math.PI / 2;
          car.heading += turn;
          if (axis === 'x') car.pos.z = r + 3 * Math.sign(Math.cos(car.heading));
          else car.pos.x = r + 3 * Math.sign(Math.sin(car.heading));
        }
        break;
      }
    }
    if (Math.abs(car.pos.x) > 195 || Math.abs(car.pos.z) > 195) {
      car.heading += Math.PI;
      car.pos.x = Math.max(-190, Math.min(190, car.pos.x));
      car.pos.z = Math.max(-190, Math.min(190, car.pos.z));
    }
    city.collide(car.pos, 1.6);
  }

  return {
    cars,
    parked,
    traffic,
    addCar,
    nearestCar(pos, maxDist, kinds) {
      let best = null;
      let bestD = maxDist;
      for (const car of cars) {
        if (kinds && !kinds.includes(car.kind)) continue;
        const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      return best;
    },
    drivePlayer(car, dt, keys) {
      const accel = (keys['KeyW'] || keys['ArrowUp'] ? 22 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 16 : 0);
      const braking = keys['Space'];
      car.speed += accel * dt;
      if (braking) car.speed *= Math.max(0, 1 - dt * 3);
      car.speed -= car.speed * 0.35 * dt;
      car.speed = Math.max(-12, Math.min(46, car.speed));
      const steerInput = (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
      const steerTarget = steerInput * 0.55 * Math.min(1, Math.abs(car.speed) / 10);
      car.steer += (steerTarget - car.steer) * Math.min(1, dt * 6);
      car.heading += car.steer * (car.speed / 12) * dt * (car.speed >= 0 ? 1 : -1);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.pos.x = Math.max(-235, Math.min(235, car.pos.x));
      car.pos.z = Math.max(-235, Math.min(235, car.pos.z));
      if (city.collide(car.pos, 1.6)) car.speed *= 0.55;
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading;
      for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;
      return Math.abs(car.speed) > 30 && Math.abs(car.steer) > 0.3;
    },
    update(dt) {
      for (const car of traffic) {
        driveTraffic(car, dt);
        car.group.position.copy(car.pos);
        car.group.rotation.y = car.heading;
        for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;
      }
      // traffic cars nudge apart when they overlap
      for (let i = 0; i < traffic.length; i++) {
        for (let j = i + 1; j < traffic.length; j++) {
          const a = traffic[i];
          const b = traffic[j];
          const dx = b.pos.x - a.pos.x;
          const dz = b.pos.z - a.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 4.5 && d > 0.01) {
            const push = (4.5 - d) / 2;
            a.pos.x -= (dx / d) * push;
            a.pos.z -= (dz / d) * push;
            b.pos.x += (dx / d) * push;
            b.pos.z += (dz / d) * push;
          }
        }
      }
    },
  };
}
