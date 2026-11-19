// city.js — Neon Bay's city: grid streets, building blocks, sidewalks, lights.
// Every building sits inside its own block, so roads always stay clear.
import * as THREE from 'three';

export const CITY = {
  block: 44,
  street: 16,
  half: 158,
  streetCenters: [-150, -90, -30, 30, 90, 150],
  blockCenters: [-120, -60, 0, 60, 120],
};

// Deterministic pseudo-random from a seed, so the city is the same every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#20242e'; g.fillRect(0, 0, 128, 256);
  const rnd = mulberry32(99);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 22) {
      const lit = rnd() < 0.55;
      g.fillStyle = lit ? (rnd() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#14181f';
      g.fillRect(x, y, 14, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const rnd = mulberry32(20261120);
  const group = new THREE.Group();
  group.name = 'city';

  // Bright late-afternoon sky: warm horizon haze, soft blue above.
  scene.background = new THREE.Color(0x9ec8ee);
  scene.fog = new THREE.Fog(0xcfe0f2, 220, 520);

  // Late-afternoon sun, low from the west, warm gold.
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.position.set(-140, 110, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180; sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180; sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 1.4);
  scene.add(hemi);

  // Asphalt ground for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 80, CITY.half * 2 + 80),
    new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const windowTex = makeWindowTexture();
  const wallPalette = [0xe8c9a0, 0xd9a06b, 0xf2e3c6, 0x9fc4c4, 0xc97b6b, 0xb8b0a0, 0xe0b45c, 0x7fa8a0];
  const buildings = [];

  // One or two buildings per block, always inside the block with a sidewalk margin.
  for (const bx of CITY.blockCenters) {
    for (const bz of CITY.blockCenters) {
      const margin = 4;
      const inner = CITY.block - margin * 2;
      const count = rnd() < 0.45 ? 1 : 2;
      if (count === 1) {
        const w = inner * (0.55 + rnd() * 0.25);
        const d = inner * (0.55 + rnd() * 0.25);
        const h = 10 + rnd() * 22;
        addBuilding(bx, bz, w, d, h);
      } else {
        const w = inner / 2 - 3;
        const d = inner * (0.6 + rnd() * 0.25);
        const h1 = 8 + rnd() * 16;
        const h2 = 8 + rnd() * 20;
        addBuilding(bx - inner / 4, bz, w, d, h1);
        addBuilding(bx + inner / 4, bz, w, d, h2);
      }
    }
  }

  // Windows glow through an emissive map instead of darkening the walls: the
  // wall keeps its warm colour and only the lit windows shine.
  function addBuilding(cx, cz, w, d, h) {
    const color = wallPalette[Math.floor(rnd() * wallPalette.length)];
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.9, emissive: 0xffffff, emissiveMap: windowTex, emissiveIntensity: 0.5,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // Flat roof cap in a darker shade.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }),
    );
    roof.position.set(cx, h + 0.25, cz);
    group.add(roof);
    buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });
  }

  // Sidewalk slabs: one light slab per block, slightly raised, under the buildings.
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 });
  for (const bx of CITY.blockCenters) {
    for (const bz of CITY.blockCenters) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(CITY.block, 0.3, CITY.block), walkMat);
      slab.position.set(bx, 0.15, bz);
      slab.receiveShadow = true;
      group.add(slab);
    }
  }

  // Street centre dashes, warm yellow, along every street.
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8c33c, roughness: 0.8 });
  for (const s of CITY.streetCenters) {
    for (let t = -CITY.half + 8; t < CITY.half - 8; t += 12) {
      const dashX = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 0.5), dashMat);
      dashX.position.set(t, 0.06, s);
      group.add(dashX);
      const dashZ = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 5), dashMat);
      dashZ.position.set(s, 0.06, t);
      group.add(dashZ);
    }
  }

  // Streetlights at every intersection corner, lamps glow warm.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.6, metalness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc860, emissiveIntensity: 1.4 });
  for (const sx of CITY.streetCenters) {
    for (const sz of CITY.streetCenters) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), poleMat);
      pole.position.set(sx + 7, 3.5, sz + 7);
      pole.castShadow = true;
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampMat);
      lamp.position.set(sx + 7, 7.1, sz + 7);
      group.add(lamp);
    }
  }

  // Palm trees along the sidewalks, trunks lean a little, fronds as cones.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const bx = CITY.blockCenters[Math.floor(rnd() * 5)];
    const bz = CITY.blockCenters[Math.floor(rnd() * 5)];
    const edge = Math.floor(rnd() * 4);
    let x = bx; let z = bz;
    if (edge === 0) { x = bx - CITY.block / 2 + 2; z = bz + (rnd() - 0.5) * (CITY.block - 8); }
    if (edge === 1) { x = bx + CITY.block / 2 - 2; z = bz + (rnd() - 0.5) * (CITY.block - 8); }
    if (edge === 2) { z = bz - CITY.block / 2 + 2; x = bx + (rnd() - 0.5) * (CITY.block - 8); }
    if (edge === 3) { z = bz + CITY.block / 2 - 2; x = bx + (rnd() - 0.5) * (CITY.block - 8); }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 5.5, 7), trunkMat);
    trunk.position.set(x, 2.75, z);
    trunk.rotation.z = (rnd() - 0.5) * 0.12;
    trunk.castShadow = true;
    group.add(trunk);
    const fronds = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 8), frondMat);
    fronds.position.set(x, 6.4, z);
    fronds.castShadow = true;
    group.add(fronds);
  }

  scene.add(group);
  return { group, buildings, bounds: CITY.half };
}

// Circle vs building AABB push-out. Returns the corrected position (mutates the vector).
export function collideBuildings(pos, radius, buildings) {
  for (const b of buildings) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // Dead centre: push out along the smallest penetration axis.
        const pushL = pos.x - b.minX + radius;
        const pushR = b.maxX - pos.x + radius;
        const pushT = pos.z - b.minZ + radius;
        const pushB = b.maxZ - pos.z + radius;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) pos.x = b.minX - radius;
        else if (m === pushR) pos.x = b.maxX + radius;
        else if (m === pushT) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
    }
  }
  return pos;
}

export function clampToCity(pos, half) {
  pos.x = Math.max(-half, Math.min(half, pos.x));
  pos.z = Math.max(-half, Math.min(half, pos.z));
  return pos;
}
