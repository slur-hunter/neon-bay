// Neon Bay — pedestrians.js: the people on the sidewalks, who walk, turn and run.
// One clear job: make the city feel lived in, and make it react to trouble.
import * as THREE from 'three';
import { CITY, mulberry32 } from './city.js';

const SHIRT_COLORS = [0xd83a3a, 0x3a6fd8, 0xe8c33a, 0x3ad8a0, 0xd8d8d8, 0x8a5fd8, 0xff8c42, 0x4de8ff];

/** Builds one simple walker: a body, a head, and two legs that swing. */
function buildWalker(color) {
  const g = new THREE.Group();
  g.name = 'pedestrian';
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.0, 8), shirt);
  body.position.y = 1.15;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.88;
  head.castShadow = true;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
  legGeo.translate(0, -0.35, 0);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.7, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.14, 0.7, 0);
  g.add(legR);
  return { group: g, legL, legR };
}

/** Spawns fourteen walkers on the sidewalks. */
export function createPedestrians(scene, city) {
  void city;
  const rng = mulberry32(4242);
  const peds = [];
  for (let i = 0; i < 14; i += 1) {
    const color = SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)];
    const { group, legL, legR } = buildWalker(color);
    const axis = rng() > 0.5 ? 'x' : 'z';
    const street = CITY.streets[Math.floor(rng() * CITY.streets.length)];
    const along = -150 + rng() * 300;
    const side = rng() > 0.5 ? 6.5 : -6.5;
    group.position.set(axis === 'x' ? along : street + side, 0, axis === 'x' ? street + side : along);
    scene.add(group);
    peds.push({
      group, legL, legR,
      axis, street, along,
      side,
      dir: rng() > 0.5 ? 1 : -1,
      speed: 1.4 + rng() * 1.1,
      phase: rng() * Math.PI * 2,
      flee: 0,
      pos: group.position,
    });
  }

  return {
    peds,
    /** Scares every walker near a point: they run away for a few seconds. */
    frighten(x, z, radius) {
      for (const p of peds) {
        const d = Math.hypot(p.pos.x - x, p.pos.z - z);
        if (d < radius) {
          p.flee = 3;
          // Run away along the current axis.
          const away = p.axis === 'x' ? (p.pos.x - x) : (p.pos.z - z);
          p.dir = away >= 0 ? 1 : -1;
        }
      }
    },
    update(dt) {
      for (const p of peds) {
        if (p.flee > 0) p.flee -= dt;
        const speed = p.flee > 0 ? 4.6 : p.speed;
        p.along += p.dir * speed * dt;
        if (p.along > 155) { p.along = 155; p.dir = -1; }
        if (p.along < -155) { p.along = -155; p.dir = 1; }
        // At an intersection, sometimes turn onto the cross street.
        if (p.flee <= 0) {
          for (const s of CITY.streets) {
            if (Math.abs(p.along - s) < 2 && rng() < dt * 0.12) {
              const newStreet = s;
              const newAlong = p.axis === 'x' ? p.pos.z - p.side : p.pos.x - p.side;
              p.axis = p.axis === 'x' ? 'z' : 'x';
              p.street = newStreet;
              p.along = newAlong;
              p.dir = rng() > 0.5 ? 1 : -1;
              break;
            }
          }
        }
        if (p.axis === 'x') p.group.position.set(p.along, 0, p.street + p.side);
        else p.group.position.set(p.street + p.side, 0, p.along);
        // Face the direction of travel and swing the legs.
        const targetYaw = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
        p.group.rotation.y = targetYaw;
        p.phase += dt * speed * 3.2;
        const swing = Math.sin(p.phase) * 0.5;
        p.legL.rotation.x = swing;
        p.legR.rotation.x = -swing;
      }
    },
  };
}
