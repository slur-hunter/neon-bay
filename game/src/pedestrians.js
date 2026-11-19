// createPedestrians walks people along the sidewalks. They flee from cars and
// a hit one is a crime, so driving carefully matters.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

const ROAD_LINES = [-180, -140, -100, -60, -20, 20, 60, 100, 140, 180];
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0xe67e22];

export function createPedestrians(scene, city, seed) {
  const rng = mulberry32(seed + 31);
  const people = [];

  function makePerson() {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)] });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x22222e });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt);
    torso.position.y = 1.05;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
    head.position.y = 1.62;
    group.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.24), dark);
    legL.position.set(-0.14, 0.3, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.14;
    group.add(legR);
    return { group, legL, legR };
  }

  function spawn(p, farFrom) {
    const horizontal = rng() < 0.5;
    const road = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const along = -170 + rng() * 340;
    p.pos.set(horizontal ? along : road + 9.5, 0, horizontal ? road + 9.5 : along);
    p.heading = horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    p.speed = 1.4 + rng() * 1.2;
    p.down = 0;
    p.group.position.copy(p.pos);
    p.group.rotation.y = p.heading;
    p.group.rotation.x = 0;
    if (farFrom) {
      const d = Math.hypot(p.pos.x - farFrom.x, p.pos.z - farFrom.z);
      if (d < 30) spawn(p, farFrom);
    }
  }

  for (let i = 0; i < 14; i++) {
    const body = makePerson();
    scene.add(body.group);
    const p = { ...body, pos: new THREE.Vector3(), heading: 0, speed: 2, down: 0, phase: rng() * 6 };
    spawn(p);
    people.push(p);
  }

  return {
    people,
    update(dt, playerCar, onHit) {
      for (const p of people) {
        if (p.down > 0) {
          p.down -= dt;
          if (p.down <= 0) spawn(p, playerCar ? playerCar.pos : null);
          continue;
        }
        p.phase += dt * p.speed * 3;
        p.legL.rotation.x = Math.sin(p.phase) * 0.6;
        p.legR.rotation.x = -Math.sin(p.phase) * 0.6;
        const step = p.speed * dt;
        p.pos.x += Math.sin(p.heading) * step;
        p.pos.z += Math.cos(p.heading) * step;
        // at a grid line, sometimes turn onto the crossing sidewalk
        const axis = Math.abs(Math.sin(p.heading)) > 0.5 ? 'x' : 'z';
        const along = axis === 'x' ? p.pos.x : p.pos.z;
        for (const r of ROAD_LINES) {
          const before = along - (axis === 'x' ? Math.sin(p.heading) : Math.cos(p.heading)) * step;
          if ((before < r && along >= r) || (before > r && along <= r)) {
            if (rng() < 0.35) {
              p.heading += rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
              if (axis === 'x') p.pos.z = r + 9.5 * Math.sign(Math.cos(p.heading));
              else p.pos.x = r + 9.5 * Math.sign(Math.sin(p.heading));
            }
            break;
          }
        }
        if (Math.abs(p.pos.x) > 195 || Math.abs(p.pos.z) > 195) p.heading += Math.PI;
        city.collide(p.pos, 0.5);
        p.group.position.copy(p.pos);
        p.group.rotation.y = p.heading;
        // hit by a fast player car
        if (playerCar && Math.abs(playerCar.speed) > 5) {
          const d = Math.hypot(p.pos.x - playerCar.pos.x, p.pos.z - playerCar.pos.z);
          if (d < 2.2) {
            p.down = 6;
            p.group.rotation.x = -Math.PI / 2;
            onHit(p);
          }
        }
      }
    },
  };
}
