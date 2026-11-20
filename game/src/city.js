// Neon Bay's city: a deterministic street grid built once from a seed.
// Streets run both ways at fixed centres; blocks between them hold the
// buildings, sidewalks, palms and lamps. Everything is procedural — no
// loaded assets — and the layout is identical on every load.

import * as THREE from 'three';
import { makeSeeded, range, rangeInt, pick, chance } from './rng.js';

// The grid, in metres. Streets are 14 wide; blocks are 42 wide.
export const GRID = {
  half: 168,
  streetWidth: 14,
  blockSize: 42,
  streets: [-140, -84, -28, 28, 84, 140],
  blocks: [-112, -56, 0, 56, 112],
};

const WALLS = [0xe8c9a0, 0xd9a06b, 0xf2e3c6, 0x9fc4c4, 0xc97b6b, 0xb8b0a0, 0xe0b45c, 0x7fa8a0];

// A 128x256 window texture: dark glass with a grid of lit and dark panes.
function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#20242e';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 22) {
    for (let x = 8; x < 120; x += 22) {
      if (Math.random() < 0.55) {
        ctx.fillStyle = Math.random() < 0.7 ? '#ffd98a' : '#9fd8ff';
      } else {
        ctx.fillStyle = '#2c3340';
      }
      ctx.fillRect(x, y, 14, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const rnd = makeSeeded(20261124);
  const group = new THREE.Group();
  const buildings = [];
  const half = GRID.half;

  // Late-afternoon sky, sun and haze.
  scene.background = new THREE.Color(0x9ec8ee);
  scene.fog = new THREE.Fog(0xcfe0f2, 220, 520);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.position.set(-140, 110, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 1.4));

  // Asphalt ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 80, half * 2 + 80),
    new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const winTex = windowTexture();

  // Buildings, one or two per block, with a sidewalk margin.
  for (const bx of GRID.blocks) {
    for (const bz of GRID.blocks) {
      const inner = GRID.blockSize - 8;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(GRID.blockSize, 0.3, GRID.blockSize),
        new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.9 }),
      );
      slab.position.set(bx, 0.15, bz);
      slab.receiveShadow = true;
      group.add(slab);

      const twin = chance(rnd, 0.55);
      if (!twin) {
        const w = inner * range(rnd, 0.55, 0.8);
        const d = inner * range(rnd, 0.55, 0.8);
        const h = range(rnd, 10, 32);
        addBuilding(bx, bz, w, d, h);
      } else {
        const w = inner / 2 - 3;
        const d = inner * range(rnd, 0.6, 0.85);
        addBuilding(bx - inner / 4, bz, w, d, range(rnd, 8, 24));
        addBuilding(bx + inner / 4, bz, w, d, range(rnd, 8, 28));
      }
    }
  }

  function addBuilding(cx, cz, w, d, h) {
    const wall = new THREE.MeshStandardMaterial({
      color: pick(rnd, WALLS),
      roughness: 0.85,
      emissiveMap: winTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
    body.position.set(cx, h / 2, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 }),
    );
    cap.position.set(cx, h + 0.25, cz);
    group.add(cap);
    buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });
  }

  // Yellow dashes down the middle of every street.
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8c33c, roughness: 0.8 });
  for (const s of GRID.streets) {
    for (let t = -half + 6; t < half; t += 12) {
      for (const [x, z] of [[s, t], [t, s]]) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 0.5), dashMat);
        dash.position.set(x, 0.05, z);
        group.add(dash);
      }
    }
  }

  // Streetlights at intersection corners.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c313a, metalness: 0.4, roughness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe9b0,
    emissive: 0xffc860,
    emissiveIntensity: 1.4,
  });
  for (const sx of GRID.streets) {
    for (const sz of GRID.streets) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), poleMat);
      pole.position.set(sx + 7, 3.5, sz + 7);
      pole.castShadow = true;
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampMat);
      lamp.position.set(sx + 7, 7.1, sz + 7);
      group.add(lamp);
    }
  }

  // Palm trees on sidewalk edges.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 0.9 });
  for (let i = 0; i < 40; i++) {
    const bx = pick(rnd, GRID.blocks);
    const bz = pick(rnd, GRID.blocks);
    const px = bx + range(rnd, -19, 19);
    const pz = bz + (chance(rnd, 0.5) ? -19 : 19);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 5.5, 7), trunkMat);
    trunk.position.set(px, 2.75, pz);
    trunk.rotation.z = range(rnd, -0.06, 0.06);
    trunk.castShadow = true;
    group.add(trunk);
    const fronds = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 7), frondMat);
    fronds.position.set(px, 6.4, pz);
    fronds.castShadow = true;
    group.add(fronds);
  }

  scene.add(group);
  return { group, buildings, bounds: half };
}

// Push a point (THREE.Vector3, uses x/z) out of any building AABB it
// overlaps, along the smallest penetration axis.
export function collideBuildings(pos, radius, buildings) {
  for (const b of buildings) {
    const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    } else {
      // Dead centre: push out along the smallest axis.
      const left = pos.x - b.minX;
      const right = b.maxX - pos.x;
      const back = pos.z - b.minZ;
      const front = b.maxZ - pos.z;
      const m = Math.min(left, right, back, front);
      if (m === left) pos.x = b.minX - radius;
      else if (m === right) pos.x = b.maxX + radius;
      else if (m === back) pos.z = b.minZ - radius;
      else pos.z = b.maxZ + radius;
    }
  }
  return pos;
}

// Keep a point inside the city square.
export function clampToCity(pos, half) {
  pos.x = Math.max(-half, Math.min(half, pos.x));
  pos.z = Math.max(-half, Math.min(half, pos.z));
  return pos;
}

// Nearest street centre to a coordinate (for snapping spawns to roads).
export function nearestStreet(v) {
  let best = GRID.streets[0];
  for (const s of GRID.streets) {
    if (Math.abs(s - v) < Math.abs(best - v)) best = s;
  }
  return best;
}
