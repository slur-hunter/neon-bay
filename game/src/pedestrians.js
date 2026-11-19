// pedestrians.js — people walking the sidewalks around each block.
import * as THREE from 'three';
import { BLOCK_LINES } from './city.js';

const SHIRTS = [0xd4553d, 0x3d7ad4, 0x53b06a, 0xd4a53d, 0x9a5fd4, 0xe8e8e8, 0x222226];

function makeWalkerMesh(color) {
  const g = new THREE.Group();
  g.name = 'pedestrian';
  const shirt = new THREE.MeshLambertMaterial({ color });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c2c34 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.38), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.75;
  g.add(head);
  for (const sx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), pants);
    leg.position.set(sx, 0.35, 0);
    leg.name = sx < 0 ? 'legL' : 'legR';
    g.add(leg);
  }
  return g;
}

export class Pedestrians {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.walkers = [];
    for (let i = 0; i < 14; i++) this.spawnWalker();
  }

  spawnWalker() {
    const bx = BLOCK_LINES[Math.floor(this.rng() * BLOCK_LINES.length)];
    const bz = BLOCK_LINES[Math.floor(this.rng() * BLOCK_LINES.length)];
    const color = SHIRTS[Math.floor(this.rng() * SHIRTS.length)];
    const mesh = makeWalkerMesh(color);
    this.scene.add(mesh);
    const walker = {
      mesh,
      blockX: bx, blockZ: bz,
      leg: Math.floor(this.rng() * 4),
      speed: 1.2 + this.rng() * 1.1,
      heading: 0,
      stumble: 0,
      phase: this.rng() * 6,
    };
    const wp = this.perimeterPoint(walker, 0);
    mesh.position.set(wp.x, 0, wp.z);
    this.walkers.push(walker);
    return walker;
  }

  // Corners of the sidewalk ring around a block (2 units outside the block edge).
  perimeterCorners(bx, bz) {
    const half = 22;
    return [
      { x: bx - half, z: bz - half },
      { x: bx + half, z: bz - half },
      { x: bx + half, z: bz + half },
      { x: bx - half, z: bz + half },
    ];
  }

  perimeterPoint(walker, ahead) {
    const corners = this.perimeterCorners(walker.blockX, walker.blockZ);
    const from = corners[walker.leg % 4];
    const to = corners[(walker.leg + 1) % 4];
    return ahead ? to : from;
  }

  nearest(pos, maxDist) {
    let best = null, bestD = maxDist;
    for (const w of this.walkers) {
      const d = Math.hypot(w.mesh.position.x - pos.x, w.mesh.position.z - pos.z);
      if (d < bestD) { bestD = d; best = w; }
    }
    return best;
  }

  // A punch sends a walker stumbling backwards.
  knockback(walker, dirX, dirZ) {
    walker.stumble = 0.7;
    walker.stumbleDir = { x: dirX, z: dirZ };
    walker.mesh.rotation.x = -0.5;
  }

  update(dt) {
    for (const w of this.walkers) {
      if (w.stumble > 0) {
        w.stumble -= dt;
        const s = w.stumbleDir || { x: 0, z: 1 };
        w.mesh.position.x += s.x * 5 * dt;
        w.mesh.position.z += s.z * 5 * dt;
        if (w.stumble <= 0) w.mesh.rotation.x = 0;
        continue;
      }
      const target = this.perimeterPoint(w, 1);
      const p = w.mesh.position;
      const dx = target.x - p.x, dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      w.heading = Math.atan2(dx, dz);
      w.mesh.rotation.y = w.heading;
      p.x += (dx / (dist || 1)) * w.speed * dt;
      p.z += (dz / (dist || 1)) * w.speed * dt;
      w.phase += dt * w.speed * 2.4;
      const swing = Math.sin(w.phase) * 0.4;
      const legL = w.mesh.getObjectByName('legL');
      const legR = w.mesh.getObjectByName('legR');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (dist < 1.2) w.leg = (w.leg + 1) % 4;
    }
  }
}
