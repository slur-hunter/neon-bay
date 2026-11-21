// Neon Bay: a deterministic grid city at golden hour.
// Streets run on a 52 m pitch. Blocks sit between them. Everything the game
// needs for collision is recorded as building AABBs.
import * as THREE from 'three';
import { Rng } from './rng.js';

export const PITCH = 52;
export const BLOCK = 36;
export const STREET = 16;
export const CITY_LIMIT = 198;

function windowTexture(base, litRatio, rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // faint facade noise
  for (let i = 0; i < 220; i++) {
    g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    g.fillRect(rng.range(0, 128), rng.range(0, 256), 3, 3);
  }
  // lit / dark windows
  const cols = 6;
  const rows = 12;
  const ww = 128 / cols;
  const wh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? (rng.chance(0.7) ? '#ffca6a' : '#ff9a4d') : '#1c1626';
      g.fillRect(col * ww + 4, r * wh + 5, ww - 8, wh - 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#160a2e');
  grad.addColorStop(0.35, '#4a1e5e');
  grad.addColorStop(0.62, '#a83e6b');
  grad.addColorStop(0.8, '#ff7a3c');
  grad.addColorStop(1, '#ffb35c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = new Rng(20261121);
    this.buildings = [];
    this.buildGround();
    this.buildSky();
    this.buildBlocks();
    this.buildDashes();
    this.buildLights();
    this.buildPalms();
  }

  buildGround() {
    const geo = new THREE.PlaneGeometry(440, 440);
    const mat = new THREE.MeshStandardMaterial({ color: 0x7d675a, roughness: 0.95 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  buildSky() {
    const skyGeo = new THREE.SphereGeometry(760, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTexture(),
      side: THREE.BackSide,
      fog: false,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
    // low sun disc toward -Z, with a warm halo
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(26, 40),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
    );
    sun.position.set(0, 58, -520);
    this.scene.add(sun);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(52, 40),
      new THREE.MeshBasicMaterial({
        color: 0xff8a4a,
        transparent: true,
        opacity: 0.35,
        fog: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.position.set(0, 58, -521);
    this.scene.add(halo);
    this.scene.fog = new THREE.Fog(0x8a4a68, 220, 720);
  }

  buildBlocks() {
    const texA = windowTexture('#3a2f45', 0.72, this.rng);
    const texB = windowTexture('#4a2f3a', 0.66, this.rng);
    const texC = windowTexture('#2f3a4a', 0.6, this.rng);
    const mats = [texA, texB, texC].map(
      (t) =>
        new THREE.MeshStandardMaterial({
          map: t,
          emissiveMap: t,
          emissive: 0xffb060,
          emissiveIntensity: 0.55,
          roughness: 0.9,
        }),
    );
    const tints = [0xffffff, 0xffd9b0, 0xe8c8ff, 0xc8e0ff];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x241a2e, roughness: 1 });
    const walkGeo = new THREE.BoxGeometry(BLOCK, 0.3, BLOCK);
    const walkMat = new THREE.MeshStandardMaterial({ color: 0xa89478, roughness: 0.95 });
    const centers = [];
    for (let i = -4; i <= 3; i++) centers.push(i * PITCH + PITCH / 2);
    for (const cx of centers) {
      for (const cz of centers) {
        const walk = new THREE.Mesh(walkGeo, walkMat);
        walk.position.set(cx, 0.15, cz);
        walk.receiveShadow = true;
        this.scene.add(walk);
        // two towers per block, diagonal corners
        const spots = [
          [cx - 8, cz - 8],
          [cx + 8, cz + 8],
        ];
        for (const [bx, bz] of spots) {
          const w = 13 + this.rng.range(0, 3);
          const d = 13 + this.rng.range(0, 3);
          const h = this.rng.chance(0.18) ? this.rng.range(34, 46) : this.rng.range(10, 30);
          const mat = mats[this.rng.int(0, 2)].clone();
          mat.color.setHex(this.rng.pick(tints));
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, d);
          b.position.set(bx, h / 2, bz);
          b.castShadow = true;
          b.receiveShadow = true;
          this.scene.add(b);
          const roof = new THREE.Mesh(roofGeo, roofMat);
          roof.scale.set(w + 0.6, 0.8, d + 0.6);
          roof.position.set(bx, h + 0.4, bz);
          this.scene.add(roof);
          this.buildings.push({
            minX: bx - w / 2,
            maxX: bx + w / 2,
            minZ: bz - d / 2,
            maxZ: bz + d / 2,
          });
        }
      }
    }
  }

  buildDashes() {
    // yellow centre dashes along every street, one InstancedMesh
    const dashGeo = new THREE.BoxGeometry(0.35, 0.06, 3.2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    const spots = [];
    for (let k = -3; k <= 3; k++) {
      const c = k * PITCH;
      for (let s = -195; s <= 195; s += 9) {
        spots.push([c, s, 0]);
        spots.push([s, c, 1]);
      }
    }
    const inst = new THREE.InstancedMesh(dashGeo, dashMat, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    spots.forEach(([a, b, rot], i) => {
      q.setFromAxisAngle(up, rot ? Math.PI / 2 : 0);
      m.compose(new THREE.Vector3(rot ? b : a, 0.06, rot ? a : b), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);
    // white crosswalk stripes at the central intersections (narrower and
    // dimmer than the dashes so they read as paint, not blocks)
    const stripeGeo = new THREE.BoxGeometry(2.6, 0.06, 0.65);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd8cfb8 });
    const crosses = [];
    for (let kx = -2; kx <= 2; kx++) {
      for (let kz = -2; kz <= 2; kz++) {
        const cx = kx * PITCH;
        const cz = kz * PITCH;
        for (let o = -6; o <= 6; o += 3) {
          crosses.push([cx + o, cz - 9.5, 0]);
          crosses.push([cx + o, cz + 9.5, 0]);
          crosses.push([cx - 9.5, cz + o, 1]);
          crosses.push([cx + 9.5, cz + o, 1]);
        }
      }
    }
    const ci = new THREE.InstancedMesh(stripeGeo, stripeMat, crosses.length);
    crosses.forEach(([a, b, rot], i) => {
      q.setFromAxisAngle(up, rot ? Math.PI / 2 : 0);
      m.compose(new THREE.Vector3(rot ? b : a, 0.06, rot ? a : b), q, new THREE.Vector3(1, 1, 1));
      ci.setMatrixAt(i, m);
    });
    ci.instanceMatrix.needsUpdate = true;
    this.scene.add(ci);
  }

  buildLights() {
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2430, roughness: 0.8 });
    const headGeo = new THREE.SphereGeometry(0.45, 10, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffe0a0,
      emissive: 0xffc46a,
      emissiveIntensity: 2.2,
    });
    const spots = [];
    for (let kx = -3; kx <= 3; kx += 2) {
      for (let kz = -3; kz <= 3; kz += 2) {
        spots.push([kx * PITCH + 9, kz * PITCH + 9]);
      }
    }
    for (const [x, z] of spots) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 3.5, z);
      this.scene.add(pole);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(x, 7.1, z);
      this.scene.add(head);
    }
    // a few real point lights near the centre for warm pools on the road
    for (const [x, z] of [[0, 0], [52, -52], [-52, 52], [0, -104], [-104, 0], [104, 52]]) {
      const pl = new THREE.PointLight(0xffc07a, 26, 42, 2);
      pl.position.set(x, 6.5, z);
      this.scene.add(pl);
    }
  }

  buildPalms() {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 5.4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a34, roughness: 1 });
    const frondGeo = new THREE.ConeGeometry(1.5, 3.4, 4);
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e6a3a, roughness: 1 });
    for (let i = 0; i < 34; i++) {
      const bx = this.rng.pick([-4, -3, -2, -1, 0, 1, 2, 3]) * PITCH + PITCH / 2;
      const bz = this.rng.pick([-4, -3, -2, -1, 0, 1, 2, 3]) * PITCH + PITCH / 2;
      const x = bx + this.rng.pick([-16, 16]);
      const z = bz + this.rng.range(-16, 16);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 2.7, z);
      trunk.castShadow = true;
      this.scene.add(trunk);
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(x, 6.4, z);
      frond.scale.set(1, 0.55, 1);
      frond.castShadow = true;
      this.scene.add(frond);
    }
  }

  // Circle vs building AABB push-out, then clamp to the city bounds.
  // p is {x, z} and is mutated in place. Returns true if it hit something.
  collideCircle(p, r) {
    let hit = false;
    for (const b of this.buildings) {
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          // centre inside the box: push out along the smallest axis
          const pl = Math.min(p.x - b.minX, b.maxX - p.x);
          const pz = Math.min(p.z - b.minZ, b.maxZ - p.z);
          if (pl < pz) p.x = p.x - b.minX < b.maxX - p.x ? b.minX - r : b.maxX + r;
          else p.z = p.z - b.minZ < b.maxZ - p.z ? b.minZ - r : b.maxZ + r;
        }
      }
    }
    p.x = Math.max(-CITY_LIMIT, Math.min(CITY_LIMIT, p.x));
    p.z = Math.max(-CITY_LIMIT, Math.min(CITY_LIMIT, p.z));
    return hit;
  }

  // A random point on a street centreline.
  streetPoint() {
    const axis = this.rng.chance(0.5);
    const line = this.rng.pick([-3, -2, -1, 0, 1, 2, 3]) * PITCH;
    const along = this.rng.range(-180, 180);
    return axis ? { x: line, z: along } : { x: along, z: line };
  }

  // Snap a point to the nearest street centreline (keeps one axis).
  snapToStreet(x, z) {
    const snap = (v) => Math.round(v / PITCH) * PITCH;
    const dx = Math.abs(x - snap(x));
    const dz = Math.abs(z - snap(z));
    return dx < dz ? { x: snap(x), z } : { x, z: snap(z) };
  }
}
