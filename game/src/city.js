// city.js — builds the Neon Bay city: street grid, blocks, buildings, docks and bay.
// Every building stays strictly inside its own block so no road is ever blocked.
import * as THREE from 'three';

// A tiny deterministic random generator so the city looks the same on every load
// when the same seed is given (screenshots use ?seed=).
export function makeRng(seed) {
  let a = (seed >>> 0) || 7;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BLOCK = 40;      // size of one city block
export const ROAD = 12;       // width of one street
export const PITCH = BLOCK + ROAD;
export const GRID = 5;        // blocks per side
export const HALF = (GRID * PITCH + ROAD) / 2; // city half-extent: 136

// Road centre lines (6 roads each way)
export const ROAD_LINES = [-130, -78, -26, 26, 78, 130];
// Block centres (5 each way)
export const BLOCK_LINES = [-104, -52, 0, 52, 104];

const PALETTE = [0xe8dcc8, 0xf2b8a0, 0xd98a7a, 0x8fb8b2, 0xe5c07b, 0xc9a0c4, 0xa8c686, 0xef8354, 0x6d9dc5];

function windowTexture(rng, base) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 10;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() > 0.45;
      g.fillStyle = lit ? '#ffe9a8' : '#2c3e55';
      g.fillRect(10 + x * 30, 12 + y * 24, 18, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed);
    // Building footprints as axis-aligned boxes, used for collision.
    this.solids = [];
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBay();
    this.buildStreetProps();
  }

  buildGround() {
    const geo = new THREE.PlaneGeometry(HALF * 2 + 80, HALF * 2 + 120);
    const mat = new THREE.MeshLambertMaterial({ color: 0x9b9186 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 10);
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  buildRoads() {
    const asphalt = new THREE.MeshLambertMaterial({ color: 0x33363d });
    const dash = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
    const span = HALF * 2;
    for (const c of ROAD_LINES) {
      for (const horizontal of [true, false]) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD), asphalt);
        strip.rotation.x = -Math.PI / 2;
        if (horizontal) strip.rotation.z = Math.PI / 2;
        strip.position.set(horizontal ? 0 : c, 0.02, horizontal ? c : 0);
        strip.receiveShadow = true;
        this.group.add(strip);
        // dashed centre line
        const n = Math.floor(span / 8);
        for (let i = 0; i < n; i++) {
          const d = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.5), dash);
          d.rotation.x = -Math.PI / 2;
          const along = -HALF + 4 + i * 8;
          if (horizontal) { d.rotation.z = Math.PI / 2; d.position.set(along, 0.04, c); }
          else d.position.set(c, 0.04, along);
          this.group.add(d);
        }
      }
    }
    // zebra crossings at the central intersection
    const white = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
    for (const dx of [-4.5, -1.5, 1.5, 4.5]) {
      for (const [cx, cz, rot] of [[-26, -6, 0], [26, -6, 0], [-6, -26, Math.PI / 2], [-6, 26, Math.PI / 2]]) {
        const z = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 7), white);
        z.rotation.x = -Math.PI / 2;
        z.rotation.z = rot;
        z.position.set(cx + (rot === 0 ? dx : 0), 0.04, cz + (rot === 0 ? 0 : dx));
        this.group.add(z);
      }
    }
  }

  buildBlocks() {
    const rng = this.rng;
    const textures = [0xefe3d0, 0xe8c9b0, 0xd8e2e8].map((base) => {
      const hex = '#' + base.toString(16).padStart(6, '0');
      return windowTexture(rng, hex);
    });
    for (const bx of BLOCK_LINES) {
      for (const bz of BLOCK_LINES) {
        this.buildBlock(bx, bz, textures);
      }
    }
  }

  buildBlock(bx, bz, textures) {
    const rng = this.rng;
    // The bank tower gets its own block, clearly marked, and still inside the block.
    const isBank = bx === 52 && bz === -52;
    const isMarina = bx === 104 && bz === 104;
    const isHideout = bx === -104 && bz === 104;
    const margin = 5; // sidewalk ring inside every block edge
    const inner = BLOCK - margin * 2;
    if (isBank) {
      this.addBuilding(bx, bz, 22, 46, 22, 0x2e4a6b, textures[2], 'BANK');
      return;
    }
    if (isMarina || isHideout) {
      // low wide building, leaves the rest of the block open
      this.addBuilding(bx - 6, bz, 18, isMarina ? 9 : 8, 20, isMarina ? 0x4a7a8c : 0x7a5a3a, textures[0], null);
      return;
    }
    // one or two buildings per block, each fully inside the inner square
    const two = rng() > 0.45;
    if (two) {
      const w1 = inner * (0.42 + rng() * 0.1);
      const w2 = inner - w1 - 4;
      this.addBuilding(bx - inner / 2 + w1 / 2, bz, w1, 9 + rng() * 22, inner, this.pickColor(), this.pickTexture(textures), null);
      this.addBuilding(bx + inner / 2 - w2 / 2, bz, w2, 9 + rng() * 26, inner, this.pickColor(), this.pickTexture(textures), null);
    } else {
      const w = inner * (0.6 + rng() * 0.25);
      const d = inner * (0.6 + rng() * 0.25);
      this.addBuilding(bx, bz, w, 10 + rng() * 24, d, this.pickColor(), this.pickTexture(textures), null);
    }
  }

  pickColor() {
    return PALETTE[Math.floor(this.rng() * PALETTE.length)];
  }

  pickTexture(textures) {
    return textures[Math.floor(this.rng() * textures.length)];
  }

  addBuilding(cx, cz, w, h, d, color, tex, sign) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color, map: tex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    // flat roof cap
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshLambertMaterial({ color: 0x5a5148 }),
    );
    cap.position.set(cx, h + 0.25, cz);
    this.group.add(cap);
    // rooftop box on tall buildings
    if (h > 20) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.5, 3),
        new THREE.MeshLambertMaterial({ color: 0x8a8a8a }),
      );
      box.position.set(cx - w / 4, h + 1.5, cz);
      this.group.add(box);
    }
    if (sign) {
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.7, 3, 0.8),
        new THREE.MeshBasicMaterial({ color: 0x0d2b4a }),
      );
      signMesh.position.set(cx, h - 4, cz + d / 2 + 0.5);
      this.group.add(signMesh);
    }
    this.solids.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }

  buildBay() {
    // The bay along the north edge, with a wooden pier the first job uses.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2 + 80, 60),
      new THREE.MeshLambertMaterial({ color: 0x2a7fa8 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.4, -HALF - 30);
    this.group.add(water);
    // sand strip between city and water
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2 + 80, 8),
      new THREE.MeshLambertMaterial({ color: 0xdcc49a }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.01, -HALF - 4);
    sand.receiveShadow = true;
    this.group.add(sand);
    // pier: flat walkable deck out into the water
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.6, 26),
      new THREE.MeshLambertMaterial({ color: 0x8a6a44 }),
    );
    deck.position.set(0, 0.3, -HALF - 14);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.group.add(deck);
    for (const px of [-4.5, 4.5]) {
      for (const pz of [-HALF - 4, -HALF - 14, -HALF - 24]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8),
          new THREE.MeshLambertMaterial({ color: 0x5a4028 }),
        );
        post.position.set(px, 0.4, pz);
        this.group.add(post);
      }
    }
  }

  buildStreetProps() {
    const rng = this.rng;
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const c of ROAD_LINES) {
      for (const along of [-104, -52, 0, 52, 104]) {
        if (rng() > 0.6) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6, 8), lampMat);
        pole.position.set(c + 6.4, 3, along);
        this.group.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bulbMat);
        bulb.position.set(c + 6.4, 6.1, along);
        this.group.add(bulb);
      }
    }
    // palm trees on sidewalks, never on a road
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
    for (let i = 0; i < 26; i++) {
      const bx = BLOCK_LINES[Math.floor(rng() * BLOCK_LINES.length)];
      const bz = BLOCK_LINES[Math.floor(rng() * BLOCK_LINES.length)];
      const ox = (rng() - 0.5) * (BLOCK - 8);
      const oz = (rng() - 0.5) * (BLOCK - 8);
      const x = bx + ox, z = bz + oz;
      if (this.insideSolid(x, z, 1.5)) continue;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 5, 8), trunkMat);
      trunk.position.set(x, 2.5, z);
      trunk.castShadow = true;
      this.group.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), leafMat);
      crown.position.set(x, 5.6, z);
      crown.scale.y = 0.6;
      this.group.add(crown);
    }
  }

  insideSolid(x, z, pad) {
    for (const s of this.solids) {
      if (x > s.minX - pad && x < s.maxX + pad && z > s.minZ - pad && z < s.maxZ + pad) return true;
    }
    return false;
  }

  // Push a circle (x, z, radius) out of every building. Returns true when pushed.
  collideCircle(p, radius) {
    let hit = false;
    for (const s of this.solids) {
      const cx = Math.max(s.minX, Math.min(p.x, s.maxX));
      const cz = Math.max(s.minZ, Math.min(p.z, s.maxZ));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * radius;
          p.z = cz + (dz / d) * radius;
        } else {
          // centre inside the box: push out along the smallest penetration axis
          const left = p.x - s.minX, right = s.maxX - p.x;
          const top = p.z - s.minZ, bottom = s.maxZ - p.z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) p.x = s.minX - radius;
          else if (m === right) p.x = s.maxX + radius;
          else if (m === top) p.z = s.minZ - radius;
          else p.z = s.maxZ + radius;
        }
      }
    }
    return hit;
  }

  clampToCity(p, margin) {
    p.x = Math.max(-HALF - margin, Math.min(HALF + margin, p.x));
    p.z = Math.max(-HALF - 30, Math.min(HALF + margin, p.z));
  }

  // Named places the missions use. Each marker sits just outside its building,
  // on open ground a car or a walker can actually reach.
  get pierPos() { return { x: 0, z: -HALF + 2 }; }
  get bankPos() { return { x: 52, z: -52 + 16 }; }
  get hideoutPos() { return { x: -99, z: 104 }; }
  get marinaPos() { return { x: 109, z: 104 }; }
  get spawnPos() { return { x: 0, z: 30 }; }
}
