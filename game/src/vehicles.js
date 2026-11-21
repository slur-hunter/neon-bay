// Car meshes for Neon Bay: the player car, traffic cars, parked cars and
// police cruisers with flashing light bars. Every car model has a name, a
// condition percentage and a gear, all read live by the HUD.
import * as THREE from '../vendor/three.module.min.js';
import { makeRng } from './rng.js';

export const CAR_MODELS = [
  { name: 'NEON STING GT', color: '#1f8a4c', top: 100 },
  { name: 'PALM RUNNER', color: '#c23b2e', top: 100 },
  { name: 'BAY CRUISER', color: '#2e6fc2', top: 100 },
  { name: 'SUNSET COUPE', color: '#e0a52e', top: 100 },
  { name: 'CORAL SEDAN', color: '#d9d9d9', top: 100 },
];

const TRAFFIC_COLORS = ['#c23b2e', '#2e6fc2', '#e0a52e', '#d9d9d9', '#7a4a9e', '#3a9e8f'];

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function makeCarMesh(model, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  g.name = o.name || 'car';
  const bodyColor = o.color || model.color;
  // Body: 2.0 m wide, 4.4 m long. A centre-line dash (1.4 m) is a third
  // of this car, and no road marking is larger than it.
  const body = box(2.0, 0.62, 4.4, bodyColor, 0, 0.55, 0);
  g.add(body);
  const cabin = box(1.7, 0.55, 2.2, '#1c2430', 0, 1.1, -0.2);
  g.add(cabin);
  const glass = box(1.72, 0.3, 1.1, '#9fd4e8', 0, 1.12, 0.5);
  g.add(glass);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: '#141414' });
  const wheelPositions = [[-0.95, 0.36, 1.45], [0.95, 0.36, 1.45], [-0.95, 0.36, -1.45], [0.95, 0.36, -1.45]];
  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    g.add(wheel);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2e2e' });
  for (const sx of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), tailMat);
    tail.position.set(sx, 0.62, -2.22);
    g.add(tail);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: '#fff2b0' });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), headMat);
    head.position.set(sx, 0.62, 2.22);
    g.add(head);
  }
  if (o.police) {
    // White doors and a red/blue light bar on the roof.
    const doorMat = new THREE.MeshLambertMaterial({ color: '#e8e8e8' });
    for (const sx of [-1.01, 1.01]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 1.6), doorMat);
      door.position.set(sx, 0.6, 0);
      g.add(door);
    }
    const barBase = box(1.1, 0.1, 0.4, '#111111', 0, 1.48, -0.2);
    g.add(barBase);
    const barL = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.34),
      new THREE.MeshBasicMaterial({ color: '#ff2e2e' }),
    );
    barL.position.set(-0.28, 1.56, -0.2);
    g.add(barL);
    const barR = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.34),
      new THREE.MeshBasicMaterial({ color: '#2e6fff' }),
    );
    barR.position.set(0.28, 1.56, -0.2);
    g.add(barR);
    g.userData.barL = barL;
    g.userData.barR = barR;
  }
  g.userData.model = model;
  g.userData.condition = o.condition !== undefined ? o.condition : 100;
  g.userData.gear = 1;
  return g;
}

export function makeTraffic(seed, count) {
  const rng = makeRng(seed);
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const model = CAR_MODELS[Math.floor(rng.next() * CAR_MODELS.length)];
    const color = TRAFFIC_COLORS[Math.floor(rng.next() * TRAFFIC_COLORS.length)];
    const mesh = makeCarMesh(model, { color, condition: Math.round(rng.range(72, 100)) });
    mesh.userData.traffic = true;
    cars.push(mesh);
  }
  return cars;
}

export function gearForSpeed(mph) {
  if (mph < 1) return 'N';
  if (mph < 12) return 'G1';
  if (mph < 26) return 'G2';
  if (mph < 42) return 'G3';
  if (mph < 60) return 'G4';
  return 'G5';
}
