// People for Neon Bay: Rico the hero on foot, and pedestrians who walk
// the sidewalks. Punching a pedestrian knocks them down and does NOT raise
// wanted — that is the live rule, and the HUD and the police both honour it.
import * as THREE from '../vendor/three.module.min.js';
import { makeRng } from './rng.js';

const SHIRTS = ['#2e8a4c', '#c25a2e', '#2e6fc2', '#e0a52e', '#8f4aa8', '#d9d9d9', '#3a9e8f'];
const PANTS = ['#2a2a3a', '#4a3a2a', '#3a3a4a', '#5a2a2a'];
const SKINS = ['#e8b98a', '#c98a5a', '#8a5a3a', '#f0c8a0'];

function limb(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function makePerson(rng, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  g.name = o.name || 'ped';
  const shirt = o.shirt || SHIRTS[Math.floor(rng.next() * SHIRTS.length)];
  const pants = o.pants || PANTS[Math.floor(rng.next() * PANTS.length)];
  const skin = o.skin || SKINS[Math.floor(rng.next() * SKINS.length)];
  const legs = limb(0.34, 0.7, 0.22, pants, 0, 0.35, 0);
  g.add(legs);
  const torso = limb(0.52, 0.62, 0.3, shirt, 0, 1.0, 0);
  g.add(torso);
  const armL = limb(0.14, 0.55, 0.14, shirt, -0.34, 1.0, 0);
  g.add(armL);
  const armR = limb(0.14, 0.55, 0.14, shirt, 0.34, 1.0, 0);
  g.add(armR);
  const head = limb(0.34, 0.34, 0.32, skin, 0, 1.5, 0);
  g.add(head);
  if (o.cap) {
    const cap = limb(0.38, 0.1, 0.36, o.cap, 0, 1.7, 0);
    g.add(cap);
    const brim = limb(0.38, 0.05, 0.2, o.cap, 0, 1.66, 0.24);
    g.add(brim);
  }
  if (o.hair) {
    const hair = limb(0.36, 0.12, 0.34, o.hair, 0, 1.68, 0);
    g.add(hair);
  }
  g.userData.shirt = shirt;
  g.userData.down = false;
  g.userData.walkPhase = rng.next() * Math.PI * 2;
  return g;
}

export function makeRico() {
  const rng = makeRng(7);
  const g = makePerson(rng, {
    name: 'Rico',
    shirt: '#ff7a2e',
    pants: '#2a2a3a',
    skin: '#e8b98a',
    cap: '#ffd23e',
  });
  g.scale.set(1.15, 1.15, 1.15);
  return g;
}

export function makePedestrians(seed, count) {
  const rng = makeRng(seed);
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = makePerson(rng, { name: 'ped-' + i });
    p.userData.speed = rng.range(0.8, 1.6);
    p.userData.dir = rng.range(0, Math.PI * 2);
    peds.push(p);
  }
  return peds;
}
