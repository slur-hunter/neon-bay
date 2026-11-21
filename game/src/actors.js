// Everything that moves: Rico on foot, the cars to steal and drive, the traffic,
// the pedestrians and the police cruisers. Each actor is a small group of boxes with
// a real position, speed and heading the game and the HUD both read.
import { CARS, CRUISERS, PED_SHIRTS, PLAYER_CAR, WORLD } from './config.js';
import { clamp, pick } from './util.js';

const THREE = globalThis.THREE;

function makePerson(shirtColour, skinColour = 0xe8b98a, capColour = 0xffd23e, pantsColour = 0x2d3436) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColour });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColour });
  const skin = new THREE.MeshLambertMaterial({ color: skinColour });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.72;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: capColour }));
  cap.position.y = 1.98;
  group.add(cap);
  for (const side of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.24), pants);
    leg.position.set(side, 0.31, 0);
    group.add(leg);
  }
  return group;
}

function makeCar(colour, isCruiser = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colour });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshLambertMaterial({ color: isCruiser ? 0xffffff : 0x1c2733 }),
  );
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
  }
  if (isCruiser) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.24), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.24), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.3;
    bar.add(red);
    bar.add(blue);
    bar.position.set(0, 1.48, -0.2);
    bar.userData.red = red;
    bar.userData.blue = blue;
    group.add(bar);
    group.userData.lightBar = bar;
  }
  return group;
}

export function createActors(scene, random) {
  // Rico: a bright cyan jacket, white trousers and a red cap, so he reads as the
  // player at a glance and never blends in with the pedestrians.
  const player = {
    mesh: makePerson(0x00b8d4, 0xe8b98a, 0xe63946, 0xf2f2f8),
    x: WORLD.strandX,
    z: 12,
    heading: Math.PI,
    speed: 0,
    onFoot: true,
    car: null,
    walkPhase: 0,
  };
  player.mesh.position.set(player.x, 0, player.z);
  scene.add(player.mesh);

  // Parked cars along the Strand and the side streets, one of them Rico's Sting GT.
  const parked = [];
  const spots = [
    { x: WORLD.strandX - 5.2, z: -8, heading: Math.PI },
    { x: WORLD.strandX + 5.2, z: 76, heading: 0 },
    { x: WORLD.strandX - 5.2, z: 52, heading: Math.PI },
    { x: 8 - 3.2, z: -44, heading: Math.PI / 2 },
    { x: -12 + 3.2, z: 44, heading: -Math.PI / 2 },
    { x: WORLD.strandX + 5.2, z: -52, heading: 0 },
  ];
  spots.forEach((spot, i) => {
    const spec = i === 0 ? PLAYER_CAR : pick(random, CARS);
    const mesh = makeCar(spec.colour);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.heading;
    scene.add(mesh);
    parked.push({ mesh, x: spot.x, z: spot.z, heading: spot.heading, name: spec.name, colour: spec.colour, condition: spec.condition, speed: 0, taken: false });
  });

  // Traffic: cars that loop the Strand and the side streets.
  const traffic = [];
  for (let i = 0; i < 14; i += 1) {
    const spec = pick(random, CARS);
    const mesh = makeCar(spec.colour);
    const lane = random() < 0.5 ? WORLD.strandX - 3.4 : WORLD.strandX + 3.4;
    const heading = lane < WORLD.strandX ? Math.PI : 0;
    const x = random() < 0.75 ? lane : pick(random, [8 - 2.4, 8 + 2.4, -12 - 2.4, -12 + 2.4]);
    const z = -140 + random() * 260;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    traffic.push({ mesh, x, z, heading, speed: 7 + random() * 5, lane });
  }

  // Pedestrians on the sidewalks of the Strand.
  const peds = [];
  for (let i = 0; i < 22; i += 1) {
    const mesh = makePerson(pick(random, PED_SHIRTS));
    const side = random() < 0.5 ? WORLD.strandX - 8.6 : WORLD.strandX + 8.6;
    const x = side + (random() - 0.5) * 1.6;
    const z = -140 + random() * 260;
    const heading = random() < 0.5 ? 0 : Math.PI;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    peds.push({ mesh, x, z, heading, speed: 1 + random() * 0.8, down: false, timer: 0 });
  }

  // Police cruisers, named, with flashing light bars. They start parked out of
  // sight; the police module shows them only while they are active.
  const cruisers = CRUISERS.map((name, i) => {
    const mesh = makeCar(0x14161c, true);
    const x = WORLD.strandX + (i % 2 === 0 ? -4 : 4);
    const z = 12 + (i - 1.5) * 14;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.PI;
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, name, x, z, heading: Math.PI, speed: 0, role: 'RESPONDING', distance: 99, active: false };
  });

  function nearestParked(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of parked) {
      if (car.taken) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  return {
    player,
    parked,
    traffic,
    peds,
    cruisers,
    nearestParked,

    /** Move Rico on foot toward a heading; returns nothing, the HUD reads the state. */
    walkPlayer(dt, forward, strafe, turn) {
      player.heading += turn * dt * 2.4;
      const moveX = Math.sin(player.heading) * forward + Math.cos(player.heading) * strafe;
      const moveZ = Math.cos(player.heading) * forward - Math.sin(player.heading) * strafe;
      const length = Math.hypot(moveX, moveZ) || 1;
      const speed = 5.2;
      player.x = clamp(player.x + (moveX / length) * speed * dt * (forward || strafe ? 1 : 0), WORLD.westEnd + 4, WORLD.oceanX0 - 16);
      player.z = clamp(player.z + (moveZ / length) * speed * dt * (forward || strafe ? 1 : 0), WORLD.northEnd + 6, WORLD.southEnd - 6);
      player.walkPhase += dt * 9 * (forward || strafe ? 1 : 0);
      player.mesh.position.set(player.x, 0, player.z);
      player.mesh.rotation.y = player.heading;
      player.mesh.position.y = Math.abs(Math.sin(player.walkPhase)) * 0.06;
    },

    /** Drive the car Rico is in; steering follows the car's heading. */
    drivePlayer(dt, throttle, steer, brake) {
      const car = player.car;
      if (!car) return;
      car.speed = clamp(car.speed + throttle * 14 * dt - (brake ? 22 * dt : 0) - car.speed * 0.25 * dt, -6, 26);
      car.heading += steer * dt * 1.9 * clamp(car.speed / 8, -1, 1);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.x = clamp(car.x, WORLD.westEnd + 4, WORLD.oceanX0 - 16);
      car.z = clamp(car.z, WORLD.northEnd + 6, WORLD.southEnd - 6);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
    },

    enterCar(car) {
      car.taken = true;
      player.car = car;
      player.onFoot = false;
      player.mesh.visible = false;
    },

    exitCar() {
      const car = player.car;
      if (!car) return;
      player.car = null;
      player.onFoot = true;
      player.mesh.visible = true;
      player.x = car.x - 3;
      player.z = car.z + 1;
      player.mesh.position.set(player.x, 0, player.z);
    },

    stepTraffic(dt) {
      for (const car of traffic) {
        car.z += (car.heading === 0 ? -1 : 1) * car.speed * dt;
        if (car.z < WORLD.northEnd) car.z = WORLD.southEnd - 4;
        if (car.z > WORLD.southEnd) car.z = WORLD.northEnd + 4;
        car.mesh.position.set(car.x, 0, car.z);
      }
    },

    stepPeds(dt) {
      for (const ped of peds) {
        if (ped.down) {
          ped.timer -= dt;
          if (ped.timer <= 0) {
            ped.down = false;
            ped.mesh.rotation.x = 0;
            ped.mesh.position.y = 0;
          }
          continue;
        }
        ped.z += (ped.heading === 0 ? -1 : 1) * ped.speed * dt;
        if (ped.z < WORLD.northEnd + 4) ped.heading = 0;
        if (ped.z > WORLD.southEnd - 4) ped.heading = Math.PI;
        ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.z * 2)) * 0.03, ped.z);
        ped.mesh.rotation.y = ped.heading;
      }
    },

    /** A punch next to a pedestrian knocks them down and never raises wanted. */
    punchNear(x, z) {
      for (const ped of peds) {
        if (!ped.down && Math.hypot(ped.x - x, ped.z - z) < 2.2) {
          ped.down = true;
          ped.timer = 4;
          ped.mesh.rotation.x = Math.PI / 2 - 0.2;
          ped.mesh.position.y = 0.4;
          return 'ped';
        }
      }
      for (const cruiser of cruisers) {
        if (cruiser.active && Math.hypot(cruiser.x - x, cruiser.z - z) < 3.4) return 'cruiser';
      }
      return null;
    },
  };
}
