// Neon Bay city: a golden-hour coastal grid with a beach and an ocean on
// the east side, so the boulevard frames an open horizon instead of a
// canyon. Buildings use canvas facade textures in several colours with
// different window patterns, and signs carry readable names.
import * as THREE from '../vendor/three.module.min.js';
import { makeRng } from './rng.js';

const FACADE_COLORS = [
  { base: '#b5654a', trim: '#8f4a35' },
  { base: '#d9a441', trim: '#b07f2e' },
  { base: '#3f7d7a', trim: '#2c5f5c' },
  { base: '#e8dcc0', trim: '#c9b892' },
  { base: '#c97b7b', trim: '#a55f5f' },
  { base: '#7a5a7a', trim: '#5d435d' },
];

const SIGNS = [
  { text: 'CASINO AZUL', bg: '#1d2f6e', fg: '#7fe7ff' },
  { text: 'MANGO & RYE', bg: '#3d2b12', fg: '#ffd27a' },
  { text: 'HOTEL PALMERA', bg: '#274d3d', fg: '#ffe9a8' },
  { text: 'THE STRAND', bg: '#5c2a4d', fg: '#ffb3d9' },
  { text: 'TACOS EL FARO', bg: '#7a2e1d', fg: '#ffe08a' },
  { text: 'NEON BAY', bg: '#1c1c2e', fg: '#ff7ad9' },
];

function facadeTexture(color, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = color.base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = color.trim;
  g.fillRect(0, 0, 128, 10);
  g.fillRect(0, 246, 128, 10);
  for (let r = 0; r < 10; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const x = 8 + c * 30;
      const y = 18 + r * 22;
      const lit = rng.next() < 0.62;
      g.fillStyle = lit ? '#ffd27a' : '#2a2233';
      g.fillRect(x, y, 20, 14);
      if (lit && rng.next() < 0.3) {
        g.fillStyle = 'rgba(255, 210, 122, 0.35)';
        g.fillRect(x - 2, y - 2, 24, 18);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(entry) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = entry.bg;
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = entry.fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 84);
  g.fillStyle = entry.fg;
  g.font = 'bold 52px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(entry.text, 256, 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function oceanTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#2a7f8f');
  grad.addColorStop(0.5, '#1f6a80');
  grad.addColorStop(1, '#2a7f8f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < 10; i += 1) {
    g.beginPath();
    const y = 12 + i * 26;
    for (let x = 0; x <= 256; x += 16) {
      const yy = y + Math.sin(x * 0.09 + i * 1.7) * 4;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const colliders = [];
  const parkedSpots = [];
  const oceanMats = [];

  // Sky dome: purple top fading to a warm orange horizon, golden hour.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#5b3a86') },
      mid: { value: new THREE.Color('#c65f7a') },
      low: { value: new THREE.Color('#ff9a5c') },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), skyMat);
  sky.name = 'sky';
  group.add(sky);

  // Sun disc low in the west, with a soft glow sprite.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: '#fff3c4', fog: false }),
  );
  sun.position.set(-180, 52, -160);
  sun.lookAt(0, 40, 0);
  sun.name = 'sun-disc';
  group.add(sun);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const gg = glowCanvas.getContext('2d');
  const radial = gg.createRadialGradient(64, 64, 4, 64, 64, 64);
  radial.addColorStop(0, 'rgba(255, 220, 140, 0.85)');
  radial.addColorStop(1, 'rgba(255, 220, 140, 0)');
  gg.fillStyle = radial;
  gg.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas), fog: false, depthWrite: false,
  }));
  glow.scale.set(120, 120, 1);
  glow.position.copy(sun.position);
  group.add(glow);

  // Ground: warm tan base for the whole play area.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshLambertMaterial({ color: '#a97e52' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Beach sand strip on the east, then the ocean.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 520),
    new THREE.MeshLambertMaterial({ color: '#e0c48f' }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(92, 0.02, 0);
  group.add(sand);
  const oceanTex = oceanTexture();
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 520),
    new THREE.MeshLambertMaterial({ map: oceanTex, color: '#9fd4dd' }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(265, 0.01, 0);
  oceanMats.push(ocean.material);
  group.add(ocean);

  // Roads: avenues run north-south, streets run east-west. The beach
  // boulevard (x = 60) runs along the sand with the ocean on its right.
  // Road paint is realistic scale: crosswalk bars are narrow parallel
  // bars (0.5 m wide, 2.6 m long), centre-line marks are small yellow
  // dashes (1.4 m long, 0.22 m wide). No plus or cross shapes anywhere.
  const avenues = [-60, -30, 0, 30, 60];
  const streets = [-60, -30, 0, 30, 60];
  const roadMat = new THREE.MeshLambertMaterial({ color: '#4a3a34' });
  const walkMat = new THREE.MeshLambertMaterial({ color: '#c9a876' });
  const paintMat = new THREE.MeshBasicMaterial({ color: '#f2ead8' });
  const dashMat = new THREE.MeshBasicMaterial({ color: '#ffd23e' });

  function flat(w, d, mat, x, z, y) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  // Avenue and street asphalt plus sidewalks.
  for (const ax of avenues) {
    flat(10, 200, roadMat, ax, 0, 0.03);
    flat(3, 200, walkMat, ax - 6.5, 0, 0.04);
    flat(3, 200, walkMat, ax + 6.5, 0, 0.04);
  }
  for (const sz of streets) {
    flat(168, 10, roadMat, -16, sz, 0.03);
    flat(168, 3, walkMat, -16, sz - 6.5, 0.04);
    flat(168, 3, walkMat, -16, sz + 6.5, 0.04);
  }

  // Crosswalks: narrow parallel bars across each road at each crossing.
  const barGeo = new THREE.BoxGeometry(0.5, 0.04, 2.6);
  const barGeoAcross = new THREE.BoxGeometry(2.6, 0.04, 0.5);
  function crosswalk(cx, cz) {
    for (let i = -4; i <= 4; i += 1) {
      const b1 = new THREE.Mesh(barGeo, paintMat);
      b1.position.set(cx + i * 1.1, 0.06, cz - 8);
      group.add(b1);
      const b2 = new THREE.Mesh(barGeo, paintMat);
      b2.position.set(cx + i * 1.1, 0.06, cz + 8);
      group.add(b2);
      const b3 = new THREE.Mesh(barGeoAcross, paintMat);
      b3.position.set(cx - 8, 0.06, cz + i * 1.1);
      group.add(b3);
      const b4 = new THREE.Mesh(barGeoAcross, paintMat);
      b4.position.set(cx + 8, 0.06, cz + i * 1.1);
      group.add(b4);
    }
  }
  for (const ax of avenues) {
    for (const sz of streets) {
      crosswalk(ax, sz);
    }
  }

  // Centre-line dashes: small yellow marks, never larger than a car.
  const dashGeo = new THREE.BoxGeometry(0.22, 0.04, 1.4);
  for (const ax of avenues) {
    for (let z = -96; z <= 96; z += 4) {
      if (streets.some((s) => Math.abs(z - s) < 9)) continue;
      const d = new THREE.Mesh(dashGeo, dashMat);
      d.position.set(ax, 0.06, z);
      group.add(d);
    }
  }
  const dashGeoAcross = new THREE.BoxGeometry(1.4, 0.04, 0.22);
  for (const sz of streets) {
    for (let x = -96; x <= 64; x += 4) {
      if (avenues.some((a) => Math.abs(x - a) < 9)) continue;
      const d = new THREE.Mesh(dashGeoAcross, dashMat);
      d.position.set(x, 0.06, sz);
      group.add(d);
    }
  }

  // Buildings: one or two per block, in six facade colours with different
  // window patterns. Taller towers in the north make the skyline; the
  // column beside the beach stays low so the ocean horizon stays open.
  const facadeMats = FACADE_COLORS.map((c) => {
    const tex = facadeTexture(c, rng);
    const side = new THREE.MeshLambertMaterial({ map: tex });
    const top = new THREE.MeshLambertMaterial({ color: '#3a3230' });
    return [side, side, top, top, side, side];
  });
  const blockX = [-45, -15, 15, 45];
  const blockZ = [-45, -15, 15, 45];
  let signIndex = 0;
  function addBuilding(cx, cz, w, d, h, mats) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return mesh;
  }
  for (const bx of blockX) {
    for (const bz of blockZ) {
      const nearBeach = bx === 45;
      const north = bz === -45;
      const h = nearBeach ? rng.range(6, 12) : north ? rng.range(18, 34) : rng.range(8, 24);
      const mats = facadeMats[Math.floor(rng.next() * facadeMats.length)];
      const b = addBuilding(bx, bz, 14, 14, h, mats);
      // A readable sign on some buildings facing the boulevard or avenue.
      if (bx === 45 || (bx === 15 && bz === -15) || (bx === -15 && bz === 15)) {
        const entry = SIGNS[signIndex % SIGNS.length];
        signIndex += 1;
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(10, 1.9),
          new THREE.MeshBasicMaterial({ map: signTexture(entry) }),
        );
        sign.position.set(bx + 7.2, Math.min(h - 2, 9), bz);
        sign.rotation.y = Math.PI / 2;
        group.add(sign);
      }
      void b;
    }
  }
  // North skyline towers, taller than anything in the grid.
  for (let i = 0; i < 5; i += 1) {
    const x = -60 + i * 30;
    const h = rng.range(30, 44);
    const mats = facadeMats[Math.floor(rng.next() * facadeMats.length)];
    addBuilding(x, -82, 16, 16, h, mats);
  }
  // The casino on the beachfront, low and bright, with its own sign.
  const casino = addBuilding(52, -45, 12, 18, 9, facadeMats[0]);
  const casinoSign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 2.2),
    new THREE.MeshBasicMaterial({ map: signTexture(SIGNS[0]) }),
  );
  casinoSign.position.set(52, 8, -45 + 9.2);
  group.add(casinoSign);
  void casino;
  // A tall NEON BAY tower sign on the northern skyline.
  const towerSign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 3),
    new THREE.MeshBasicMaterial({ map: signTexture(SIGNS[5]) }),
  );
  towerSign.position.set(-30, 40, -73.8);
  group.add(towerSign);

  // Streetlights at the intersections, with warm glowing lamps.
  const poleMat = new THREE.MeshLambertMaterial({ color: '#2c2c34' });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffe9a8' });
  for (const ax of avenues) {
    for (const sz of streets) {
      if ((ax + sz) % 60 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 8), poleMat);
      pole.position.set(ax + 7.5, 3, sz + 7.5);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), lampMat);
      lamp.position.set(ax + 7.5, 6.2, sz + 7.5);
      group.add(lamp);
    }
  }

  // Palm trees along the beach boulevard and a few on the sand.
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#7a5230' });
  const frondMat = new THREE.MeshLambertMaterial({ color: '#3f8f4f' });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5.5, 8), trunkMat);
    trunk.position.set(x, 2.75, z);
    trunk.rotation.z = 0.08;
    group.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 4), frondMat);
      const a = (i / 5) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 0.9, 5.6, z + Math.sin(a) * 0.9);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      group.add(frond);
    }
  }
  for (let z = -84; z <= 84; z += 18) {
    palm(66, z);
  }
  palm(74, -20);
  palm(78, 12);
  palm(72, 44);

  // Parked-car spots along the avenues, for the vehicles module.
  for (const ax of [-30, 0, 30]) {
    for (const z of [-48, -18, 12, 42]) {
      parkedSpots.push({ x: ax + 3.6, z, angle: 0 });
      parkedSpots.push({ x: ax - 3.6, z: z + 6, angle: Math.PI });
    }
  }

  function update(dt) {
    oceanTex.offset.x += dt * 0.004;
    oceanTex.offset.y += dt * 0.002;
  }

  return {
    colliders,
    parkedSpots,
    update,
    bounds: { minX: -100, maxX: 114, minZ: -100, maxZ: 100 },
    beachX: 68,
  };
}



