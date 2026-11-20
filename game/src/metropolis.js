// Neon Bay v7 — the city. A seeded grid of blocks and streets with procedural
// buildings, sidewalks, streetlights, palms and road markings. Everything is built
// from three.js geometry and one canvas texture, generated at runtime.
import * as THREE from 'three';
import { makeSeededRandom, pickFrom, range } from './seed.js';

// My own grid: streets run at these offsets on both axes, blocks sit between them.
export const GRID = {
  streetCenters: [-115, -69, -23, 23, 69, 115],
  blockCenters: [-92, -46, 0, 46, 92],
  streetHalf: 7,
  blockSize: 32,
  half: 138,
};

const WALL_COLORS = [0xe8c9a0, 0xd9a06b, 0xf2e3c6, 0x9fc4c4, 0xc97b6b, 0xb8b0a0, 0xe0b45c, 0x7fa8a0, 0xd8a0b8, 0xa8b878];
const SKIN_TONES = [0xf2c89b, 0xc98d5f, 0x8a5a3b];

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#20242e';
  g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 5; x++) {
      const lit = Math.random() < 0.55;
      g.fillStyle = lit ? (Math.random() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#2e3442';
      g.fillRect(8 + x * 24, 8 + y * 17, 16, 11);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildMetropolis(scene) {
  const rnd = makeSeededRandom(90210);
  const group = new THREE.Group();
  const solids = []; // {minX, maxX, minZ, maxZ, h} for collision
  const winTex = windowTexture();

  // Sky, sun and ambient light: late afternoon, warm and bright.
  scene.background = new THREE.Color(0x9ec8ee);
  scene.fog = new THREE.Fog(0xcfe0f2, 220, 540);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.position.set(-140, 110, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180; sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180; sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 520;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 1.4));

  // Asphalt ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID.half * 2 + 90, GRID.half * 2 + 90),
    new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Buildings: one or two per block, kept inside the block with a sidewalk margin.
  const inner = GRID.blockSize - 8;
  for (const bx of GRID.blockCenters) {
    for (const bz of GRID.blockCenters) {
      const twin = rnd() < 0.55;
      const slots = twin ? [[-inner / 4, 0], [inner / 4, 0]] : [[0, 0]];
      for (const [ox, oz] of slots) {
        const w = twin ? inner / 2 - 3 : inner * (0.55 + rnd() * 0.25);
        const d = inner * (0.6 + rnd() * 0.25);
        const h = twin ? 8 + rnd() * 18 : 10 + rnd() * 22;
        const wall = new THREE.MeshStandardMaterial({
          color: pickFrom(rnd, WALL_COLORS),
          roughness: 0.85,
          emissiveMap: winTex,
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
        });
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
        box.position.set(bx + ox, h / 2, bz + oz);
        box.castShadow = true;
        box.receiveShadow = true;
        group.add(box);
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
          new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }),
        );
        cap.position.set(bx + ox, h + 0.25, bz + oz);
        group.add(cap);
        solids.push({ minX: bx + ox - w / 2, maxX: bx + ox + w / 2, minZ: bz + oz - d / 2, maxZ: bz + oz + d / 2, h });
      }
      // Sidewalk slab for the block.
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(GRID.blockSize, 0.3, GRID.blockSize),
        new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 }),
      );
      slab.position.set(bx, 0.15, bz);
      slab.receiveShadow = true;
      group.add(slab);
    }
  }

  // Yellow centre dashes along every street, both directions.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xe8c33c });
  const dashGeo = new THREE.BoxGeometry(5, 0.06, 0.5);
  for (const s of GRID.streetCenters) {
    for (let t = -GRID.half; t <= GRID.half; t += 12) {
      const d1 = new THREE.Mesh(dashGeo, dashMat);
      d1.position.set(t, 0.03, s);
      group.add(d1);
      const d2 = new THREE.Mesh(dashGeo, dashMat);
      d2.rotation.y = Math.PI / 2;
      d2.position.set(s, 0.03, t);
      group.add(d2);
    }
  }

  // Streetlights at every intersection corner.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c313a, metalness: 0.4, roughness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc860, emissiveIntensity: 1.4 });
  for (const sx of GRID.streetCenters) {
    for (const sz of GRID.streetCenters) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), poleMat);
      pole.position.set(sx + 7, 3.5, sz + 7);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampMat);
      lamp.position.set(sx + 7, 7.1, sz + 7);
      group.add(lamp);
    }
  }

  // Palm trees on sidewalk edges.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const bx = pickFrom(rnd, GRID.blockCenters);
    const bz = pickFrom(rnd, GRID.blockCenters);
    const px = bx + range(rnd, -GRID.blockSize / 2 + 2, GRID.blockSize / 2 - 2);
    const pz = bz + (rnd() < 0.5 ? -1 : 1) * (GRID.blockSize / 2 - 1);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 5.5, 7), trunkMat);
    trunk.position.set(px, 2.75, pz);
    trunk.rotation.z = range(rnd, -0.06, 0.06);
    trunk.castShadow = true;
    group.add(trunk);
    const fronds = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 8), frondMat);
    fronds.position.set(px, 6.4, pz);
    fronds.castShadow = true;
    group.add(fronds);
  }

  scene.add(group);
  return { group, solids, bounds: GRID.half };
}

// Push a circle (pos, radius) out of every building AABB it overlaps.
export function collideSolids(pos, radius, solids) {
  for (const b of solids) {
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
        // Dead centre: push out along the smallest axis.
        const pushL = pos.x - b.minX, pushR = b.maxX - pos.x;
        const pushB = pos.z - b.minZ, pushF = b.maxZ - pos.z;
        const m = Math.min(pushL, pushR, pushB, pushF);
        if (m === pushL) pos.x = b.minX - radius;
        else if (m === pushR) pos.x = b.maxX + radius;
        else if (m === pushB) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
    }
  }
}

export function clampToBounds(pos, half) {
  pos.x = Math.max(-half, Math.min(half, pos.x));
  pos.z = Math.max(-half, Math.min(half, pos.z));
}

export { SKIN_TONES };
