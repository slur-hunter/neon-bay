// city.js — Neon Bay's streets: a grid of blocks, warm-walled buildings with
// lit windows, sidewalks, dashes, lamps and palms. The layout is seeded, so
// every load builds the same city.
import * as THREE from 'three';

export const CITY = {
  block: 44,
  street: 16,
  half: 158,
  streetCenters: [-150, -90, -30, 30, 90, 150],
  blockCenters: [-120, -60, 0, 60, 120],
};

// Small deterministic generator: same seed, same city, every single load.
function seededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A canvas of windows: most dark, a little over half lit warm or cool blue.
// Used as an emissive map so the walls stay warm while windows glow.
function buildWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#20242e';
  ctx.fillRect(0, 0, 128, 256);
  const rand = seededRandom(99);
  for (let row = 10; row < 246; row += 22) {
    for (let col = 10; col < 118; col += 22) {
      if (rand() < 0.55) {
        ctx.fillStyle = rand() < 0.7 ? '#ffd98a' : '#9fd8ff';
      } else {
        ctx.fillStyle = '#14181f';
      }
      ctx.fillRect(col, row, 14, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const rand = seededRandom(20261120);
  const root = new THREE.Group();
  root.name = 'city';

  // Late-afternoon sky: soft blue above, warm haze at the horizon.
  scene.background = new THREE.Color(0x9ec8ee);
  scene.fog = new THREE.Fog(0xcfe0f2, 220, 520);

  // Low warm sun from the west, with soft shadows.
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

  // One big asphalt slab under everything.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 80, CITY.half * 2 + 80),
    new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const windows = buildWindowTexture();
  const wallColors = [0xe8c9a0, 0xd9a06b, 0xf2e3c6, 0x9fc4c4, 0xc97b6b, 0xb8b0a0, 0xe0b45c, 0x7fa8a0];
  const solids = [];

  function placeBuilding(cx, cz, w, d, h) {
    const tint = wallColors[Math.floor(rand() * wallColors.length)];
    const walls = new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.9,
      emissive: 0xffffff,
      emissiveMap: windows,
      emissiveIntensity: 0.5,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), walls);
    body.position.set(cx, h / 2, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }),
    );
    cap.position.set(cx, h + 0.25, cz);
    root.add(cap);
    solids.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });
  }

  // One or two buildings per block, kept inside the block with room to walk.
  for (const bx of CITY.blockCenters) {
    for (const bz of CITY.blockCenters) {
      const margin = 4;
      const inner = CITY.block - margin * 2;
      if (rand() < 0.45) {
        const w = inner * (0.55 + rand() * 0.25);
        const d = inner * (0.55 + rand() * 0.25);
        placeBuilding(bx, bz, w, d, 10 + rand() * 22);
      } else {
        const w = inner / 2 - 3;
        const d = inner * (0.6 + rand() * 0.25);
        placeBuilding(bx - inner / 4, bz, w, d, 8 + rand() * 16);
        placeBuilding(bx + inner / 4, bz, w, d, 8 + rand() * 20);
      }
    }
  }

  // Pale sidewalk slab under each block, slightly raised.
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 });
  for (const bx of CITY.blockCenters) {
    for (const bz of CITY.blockCenters) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(CITY.block, 0.3, CITY.block), slabMat);
      slab.position.set(bx, 0.15, bz);
      slab.receiveShadow = true;
      root.add(slab);
    }
  }

  // Warm yellow centre dashes down every street, both directions.
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8c33c, roughness: 0.8 });
  for (const s of CITY.streetCenters) {
    for (let t = -CITY.half + 8; t < CITY.half - 8; t += 12) {
      const along = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 0.5), dashMat);
      along.position.set(t, 0.06, s);
      root.add(along);
      const across = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 5), dashMat);
      across.position.set(s, 0.06, t);
      root.add(across);
    }
  }

  // A lamp at every intersection corner: dark pole, warm glowing bulb.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.6, metalness: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe9b0, emissive: 0xffc860, emissiveIntensity: 1.4,
  });
  for (const sx of CITY.streetCenters) {
    for (const sz of CITY.streetCenters) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), poleMat);
      pole.position.set(sx + 7, 3.5, sz + 7);
      pole.castShadow = true;
      root.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), bulbMat);
      bulb.position.set(sx + 7, 7.1, sz + 7);
      root.add(bulb);
    }
  }

  // Forty palms along the sidewalk edges, trunks leaning a touch.
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const bx = CITY.blockCenters[Math.floor(rand() * 5)];
    const bz = CITY.blockCenters[Math.floor(rand() * 5)];
    const side = Math.floor(rand() * 4);
    let x = bx;
    let z = bz;
    if (side === 0) { x = bx - CITY.block / 2 + 2; z = bz + (rand() - 0.5) * (CITY.block - 8); }
    if (side === 1) { x = bx + CITY.block / 2 - 2; z = bz + (rand() - 0.5) * (CITY.block - 8); }
    if (side === 2) { z = bz - CITY.block / 2 + 2; x = bx + (rand() - 0.5) * (CITY.block - 8); }
    if (side === 3) { z = bz + CITY.block / 2 - 2; x = bx + (rand() - 0.5) * (CITY.block - 8); }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 5.5, 7), barkMat);
    trunk.position.set(x, 2.75, z);
    trunk.rotation.z = (rand() - 0.5) * 0.12;
    trunk.castShadow = true;
    root.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 8), leafMat);
    crown.position.set(x, 6.4, z);
    crown.castShadow = true;
    root.add(crown);
  }

  scene.add(root);
  return { group: root, buildings: solids, bounds: CITY.half };
}

// Push a circle out of every building it overlaps. Mutates and returns pos.
// When the circle sits dead centre, push along the smallest penetration axis.
export function collideBuildings(pos, radius, buildings) {
  for (const b of buildings) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      const left = pos.x - b.minX + radius;
      const right = b.maxX - pos.x + radius;
      const top = pos.z - b.minZ + radius;
      const bottom = b.maxZ - pos.z + radius;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.minX - radius;
      else if (m === right) pos.x = b.maxX + radius;
      else if (m === top) pos.z = b.minZ - radius;
      else pos.z = b.maxZ + radius;
    }
  }
  return pos;
}

export function clampToCity(pos, half) {
  pos.x = Math.max(-half, Math.min(half, pos.x));
  pos.z = Math.max(-half, Math.min(half, pos.z));
  return pos;
}
