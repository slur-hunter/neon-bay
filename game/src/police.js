// Police for Neon Bay: named cruisers that chase, ram and pursue, with a
// live role per cruiser. The role comes from the real distance, never from
// a staged override: RAMMING under 7 m, PURSUIT under 30 m, RESPONDING
// otherwise. Light bars flash red and blue every frame while wanted.
import * as THREE from '../vendor/three.module.min.js';
import { makeCarMesh, CAR_MODELS } from './vehicles.js';

export const CRUISER_NAMES = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9', 'PIER-5', 'DUNE-2'];

export function roleFor(dist) {
  if (dist < 7) return 'RAMMING';
  if (dist < 30) return 'PURSUIT';
  return 'RESPONDING';
}

export function makeCruiser(name) {
  const model = CAR_MODELS[0];
  const mesh = makeCarMesh(model, { police: true, color: '#181818', name: 'cruiser-' + name });
  mesh.userData.cruiserName = name;
  mesh.userData.role = 'RESPONDING';
  mesh.userData.dist = 999;
  mesh.userData.speed = 0;
  mesh.userData.flash = 0;
  return mesh;
}

// Steer a cruiser toward the target. Returns nothing; mutates the mesh
// position and rotation, and updates its live role and distance.
export function updateCruiser(mesh, target, dt, wanted) {
  const dx = target.x - mesh.position.x;
  const dz = target.z - mesh.position.z;
  const dist = Math.hypot(dx, dz);
  mesh.userData.dist = dist;
  mesh.userData.role = roleFor(dist);
  const speed = wanted >= 4 ? 13 : wanted >= 2 ? 11 : 9;
  mesh.userData.speed = speed;
  if (dist > 2.5) {
    const desired = Math.atan2(dx, dz);
    let diff = desired - mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    mesh.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    mesh.position.x += Math.sin(mesh.rotation.y) * speed * dt;
    mesh.position.z += Math.cos(mesh.rotation.y) * speed * dt;
  }
  // Light bars flash red/blue alternately.
  mesh.userData.flash += dt * 8;
  const on = Math.floor(mesh.userData.flash) % 2 === 0;
  const barL = mesh.userData.barL;
  const barR = mesh.userData.barR;
  if (barL && barR) {
    barL.material.color.set(on ? '#ff2e2e' : '#7a1010');
    barR.material.color.set(on ? '#10106a' : '#2e6fff');
  }
}

export function policePanel(cruisers) {
  return cruisers.map((c) => ({
    name: c.userData.cruiserName,
    role: c.userData.role,
    dist: Math.round(c.userData.dist),
  }));
}

export function wantedStars(wanted) {
  return Math.max(0, Math.min(4, Math.round(wanted)));
}
