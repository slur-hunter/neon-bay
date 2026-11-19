// Neon Bay — city.js: the procedural coastal city, its sky, sun, water and landmarks.
// One clear job: build the world the other systems walk, drive and fight in.
import * as THREE from 'three';

/** A small seeded random generator, so the city is the same on every load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The city grid: streets run both ways, blocks sit between them. */
export const CITY = {
  streets: [-144, -112, -80, -48, -16, 16, 48, 80, 112, 144],
  blocks: [-128, -96, -64, -32, 0, 32, 64, 96, 128],
  roadWidth: 8,
  half: 168,
  waterZ: 168,
  beachZ0: 152,
  promenadeZ0: 144,
};

/** Landmark positions every other system navigates to. */
export const LANDMARKS = {
  plaza: new THREE.Vector3(0, 0, 0),
  spire: new THREE.Vector3(0, 0, 0),
  bank: new THREE.Vector3(32, 0, 8),
  docks: new THREE.Vector3(0, 0, 188),
  pierWest: new THREE.Vector3(-80, 0, 188),
  pierEast: new THREE.Vector3(80, 0, 188),
  hideout: new THREE.Vector3(128, 0, -128),
  shop: new THREE.Vector3(-48, 0, 48),
  park: new THREE.Vector3(-96, 0, -96),
  beach: new THREE.Vector3(-40, 0, 160),
  island: new THREE.Vector3(120, 0, 245),
  station: new THREE.Vector3(-128, 0, 128),
};

/** Draws a small canvas texture with a grid of windows for building facades. */
function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f2ede2'; g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 22) {
      const lit = ((x * 7 + y * 13) % 5) === 0;
      g.fillStyle = lit ? '#ffe9a8' : '#2c3e55';
      g.fillRect(x, y, 14, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Draws a canvas texture with a short sign text, for the bank and docks signs. */
function makeSignTexture(text, fg, bg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Draws a canvas texture of gentle water ripples. */
function makeWaterTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2e7f9e'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 2;
  for (let i = 0; i < 40; i += 1) {
    const y = (i * 37) % 256;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(80, y - 8, 170, y + 8, 256, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** True when a ground position can be walked or driven on (not open water). */
export function isWalkable(x, z) {
  if (z <= CITY.waterZ) return true;
  // The three piers.
  for (const px of [-80, 0, 80]) {
    if (Math.abs(x - px) <= 5 && z <= 210) return true;
  }
  // The bridge to the island and the island itself.
  if (Math.abs(x - 120) <= 4 && z <= 234) return true;
  const dx = x - 120, dz = z - 245;
  if (dx * dx + dz * dz <= 18 * 18) return true;
  return false;
}

/** Pushes a circle (x, z, radius) out of every building box it overlaps. */
export function resolveCollision(x, z, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw));
    const cz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        // Dead centre: push out along the smallest penetration axis.
        const px = c.hw + radius - Math.abs(x - c.x);
        const pz = c.hd + radius - Math.abs(z - c.z);
        if (px < pz) x = c.x + (x >= c.x ? c.hw + radius : -(c.hw + radius));
        else z = c.z + (z >= c.z ? c.hd + radius : -(c.hd + radius));
      }
    }
  }
  return { x, z };
}

/** Builds the whole city into the scene and returns its handles. */
export function createCity(scene) {
  const rng = mulberry32(20261119);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const colliders = [];

  // Bright late-afternoon sky: a gradient dome, warm sun, blue sky, light haze.
  const skyGeo = new THREE.SphereGeometry(600, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 top = vec3(0.36, 0.62, 0.92); vec3 mid = vec3(0.62, 0.78, 0.95); vec3 low = vec3(1.0, 0.86, 0.62); vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  group.add(sky);
  scene.fog = new THREE.Fog(0xa8c6e8, 280, 620);

  const sun = new THREE.DirectionalLight(0xffdfae, 2.6);
  sun.position.set(-160, 150, -70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -190; sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190; sun.shadow.camera.bottom = -190;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbdd8f5, 0x8a7a66, 1.15);
  scene.add(hemi);

  // Ground: concrete city slab, then sand beach, boardwalk and the bay.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x9d9a90, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -40);
  ground.receiveShadow = true;
  group.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 16),
    new THREE.MeshStandardMaterial({ color: 0xe8d49a, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.03, 160);
  beach.receiveShadow = true;
  group.add(beach);

  const boardwalk = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 8),
    new THREE.MeshStandardMaterial({ color: 0xb08d5e, roughness: 1 }),
  );
  boardwalk.rotation.x = -Math.PI / 2;
  boardwalk.position.set(0, 0.04, 148);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);

  const waterTex = makeWaterTexture();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 160),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: waterTex, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.94 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, 248);
  group.add(water);

  // Roads: dark asphalt strips on every street, with pale sidewalks beside them.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x404046, roughness: 1 });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xc4beb0, roughness: 1 });
  for (const s of CITY.streets) {
    const along = new THREE.Mesh(new THREE.PlaneGeometry(336, CITY.roadWidth), roadMat);
    along.rotation.x = -Math.PI / 2; along.position.set(0, 0.06, s); along.receiveShadow = true;
    group.add(along);
    const across = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, 336), roadMat);
    across.rotation.x = -Math.PI / 2; across.position.set(s, 0.06, 0); across.receiveShadow = true;
    group.add(across);
    for (const off of [-5.5, 5.5]) {
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(336, 3), walkMat);
      w1.rotation.x = -Math.PI / 2; w1.position.set(0, 0.05, s + off); w1.receiveShadow = true;
      group.add(w1);
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 336), walkMat);
      w2.rotation.x = -Math.PI / 2; w2.position.set(s + off, 0.05, 0); w2.receiveShadow = true;
      group.add(w2);
    }
  }

  // Lane dashes and crosswalk stripes, instanced for a low draw-call count.
  const dashGeo = new THREE.BoxGeometry(3, 0.06, 0.35);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.8 });
  const dashCount = CITY.streets.length * 2 * 20;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  const m4 = new THREE.Matrix4();
  let di = 0;
  for (const s of CITY.streets) {
    for (let k = -9; k <= 9; k += 1) {
      if (di >= dashCount) break;
      m4.makeTranslation(k * 16, 0.09, s);
      dashes.setMatrixAt(di, m4); di += 1;
      m4.makeRotationY(Math.PI / 2);
      m4.setPosition(s, 0.09, k * 16);
      dashes.setMatrixAt(di, m4); di += 1;
    }
  }
  dashes.count = di;
  group.add(dashes);

  // Buildings: one instanced box with a window texture, tinted per instance.
  const windowTex = makeWindowTexture();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const facadeColors = [0xd8c9a8, 0xb8c8d8, 0xd8a8a0, 0xc8b8d0, 0xa8c0b0, 0xe0d8c8, 0x9fb4c8, 0xd0b890];
  const buildingMat = new THREE.MeshStandardMaterial({ map: windowTex, roughness: 0.85, metalness: 0.05 });
  const spots = [];
  for (const bx of CITY.blocks) {
    for (const bz of CITY.blocks) {
      if (bx === 0 && bz === 0) continue; // Spire plaza
      if (bx === 32 && bz === 0) continue; // the bank sits here
      if (bx === -96 && bz === -96) continue; // park
      if (bx === 96 && bz === 96) continue; // park
      if (bx === 128 && bz === -128) continue; // hideout
      if (bz >= 144) continue;
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i += 1) {
        const w = 8 + rng() * 8;
        const d = 8 + rng() * 8;
        const h = 8 + rng() * rng() * 42;
        const x = bx + (rng() - 0.5) * (24 - w);
        const z = bz + (rng() - 0.5) * (24 - d);
        spots.push({ x, z, w, d, h, c: facadeColors[Math.floor(rng() * facadeColors.length)] });
        colliders.push({ x, z, hw: w / 2 + 0.4, hd: d / 2 + 0.4 });
      }
    }
  }
  const buildings = new THREE.InstancedMesh(boxGeo, buildingMat, spots.length);
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    m4.makeScale(s.w, s.h, s.d);
    m4.setPosition(s.x, 0, s.z);
    buildings.setMatrixAt(i, m4);
    buildings.setColorAt(i, col.setHex(s.c));
  });
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  group.add(buildings);

  // The Spire: the city's tall landmark tower on the central plaza, with a pink tip.
  const spireMat = new THREE.MeshStandardMaterial({ color: 0x8fb8d8, roughness: 0.4, metalness: 0.4, emissive: 0x112233, emissiveIntensity: 0.4 });
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(7, 11, 95, 8), spireMat);
  spire.position.set(0, 47.5, 0);
  spire.castShadow = true;
  group.add(spire);
  colliders.push({ x: 0, z: 0, hw: 11, hd: 11 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 2.2 });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), tipMat);
  tip.position.set(0, 96.5, 0);
  group.add(tip);

  // The bank in its own block east of the plaza, front facing the south street.
  const bankMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.8 });
  const bank = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 14), bankMat);
  bank.position.set(32, 6, 0);
  bank.castShadow = true; bank.receiveShadow = true;
  group.add(bank);
  colliders.push({ x: 32, z: 0, hw: 11, hd: 7 });
  const colGeo = new THREE.CylinderGeometry(0.9, 0.9, 12, 10);
  for (let i = 0; i < 4; i += 1) {
    const c = new THREE.Mesh(colGeo, bankMat);
    c.position.set(23 + i * 6, 6, 7.5);
    c.castShadow = true;
    group.add(c);
  }
  const bankSign = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 4.5),
    new THREE.MeshStandardMaterial({ map: makeSignTexture('NEON BAY BANK', '#ffd23f', '#14081f'), roughness: 0.6 }),
  );
  bankSign.position.set(32, 10.5, 7.2);
  group.add(bankSign);

  // The hideout: a small house with a pink roof in the north-east corner.
  const house = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: 0.9 }));
  house.position.set(128, 3, -128); house.castShadow = true;
  group.add(house);
  colliders.push({ x: 128, z: -128, hw: 5, hd: 4 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 4, 4), new THREE.MeshStandardMaterial({ color: 0xff5da2, roughness: 0.7 }));
  roof.position.set(128, 8, -128); roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  group.add(roof);

  // The docks: three piers into the bay, with crates and a sign.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xc8a860, roughness: 0.9 });
  for (const px of [-80, 0, 80]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 44), pierMat);
    pier.position.set(px, 0.6, 189);
    pier.castShadow = true; pier.receiveShadow = true;
    group.add(pier);
    for (let i = 0; i < 3; i += 1) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), crateMat);
      crate.position.set(px + (rng() - 0.5) * 6, 2.4, 176 + rng() * 26);
      crate.rotation.y = rng() * Math.PI;
      crate.castShadow = true;
      group.add(crate);
    }
  }
  const dockSign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4),
    new THREE.MeshStandardMaterial({ map: makeSignTexture('NEON BAY DOCKS', '#4de8ff', '#0a2030'), roughness: 0.6 }),
  );
  dockSign.position.set(0, 8, 168.5);
  group.add(dockSign);

  // The bridge to the island, and the island with its lighthouse.
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x7a7a80, roughness: 0.9 });
  for (let i = 0; i < 4; i += 1) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 18), bridgeMat);
    seg.position.set(120, 1.2 + Math.sin((i + 0.5) * Math.PI / 4) * 2.2, 176 + i * 16);
    seg.castShadow = true; seg.receiveShadow = true;
    group.add(seg);
  }
  const railMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6 });
  for (const side of [-4.2, 4.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 66), railMat);
    rail.position.set(120 + side, 3.2, 200);
    group.add(rail);
  }
  const island = new THREE.Mesh(new THREE.CylinderGeometry(18, 20, 2, 24), new THREE.MeshStandardMaterial({ color: 0xd8c890, roughness: 1 }));
  island.position.set(120, 0.4, 245);
  island.receiveShadow = true;
  group.add(island);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.7 });
  const lighthouse = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 16, 12), lightMat);
  lighthouse.position.set(120, 9, 245);
  lighthouse.castShadow = true;
  group.add(lighthouse);
  const lightTop = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd23f, emissiveIntensity: 2.5 }));
  lightTop.position.set(120, 17.5, 245);
  group.add(lightTop);

  // Parks: grass discs with trees.
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x7fae62, roughness: 1 });
  for (const [px, pz] of [[-96, -96], [96, 96]]) {
    const grass = new THREE.Mesh(new THREE.CircleGeometry(13, 24), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(px, 0.07, pz);
    grass.receiveShadow = true;
    group.add(grass);
  }

  // Trees along the sidewalks and in the parks, instanced.
  const treeSpots = [];
  for (let i = 0; i < 70; i += 1) {
    const s = CITY.streets[Math.floor(rng() * CITY.streets.length)];
    const along = -150 + rng() * 300;
    const side = rng() > 0.5 ? 6.5 : -6.5;
    if (rng() > 0.5) treeSpots.push([s + side, along]);
    else treeSpots.push([along, s + side]);
  }
  treeSpots.push([-96, -96], [-90, -100], [-100, -90], [96, 96], [90, 100], [100, 90]);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const canopyGeo = new THREE.IcosahedronGeometry(2.2, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x4e8f3e, roughness: 1 });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeSpots.length);
  treeSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 1.5, z);
    trunks.setMatrixAt(i, m4);
    m4.makeTranslation(x, 4.4, z);
    canopies.setMatrixAt(i, m4);
  });
  trunks.castShadow = true; canopies.castShadow = true;
  group.add(trunks); group.add(canopies);

  // Streetlights along the main streets.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.7, metalness: 0.4 });
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a8, emissiveIntensity: 0.8 });
  const lightSpots = [];
  for (const s of [-144, -80, -16, 48, 112]) {
    for (let k = -4; k <= 4; k += 1) lightSpots.push([s + 6.5, k * 32]);
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lightSpots.length);
  lightSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3, z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x, 6.1, z);
    lamps.setMatrixAt(i, m4);
  });
  group.add(poles); group.add(lamps);

  // Drifting clouds: flat white ellipsoids high above the city.
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  const clouds = [];
  for (let i = 0; i < 7; i += 1) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), cloudMat);
    cloud.scale.set(22 + rng() * 18, 5 + rng() * 3, 12 + rng() * 8);
    cloud.position.set(-240 + rng() * 480, 110 + rng() * 40, -240 + rng() * 320);
    group.add(cloud);
    clouds.push(cloud);
  }

  return {
    group, rng, sun, tip, waterTex, clouds, colliders,
    update(dt) {
      waterTex.offset.x += dt * 0.008;
      waterTex.offset.y += dt * 0.003;
      const pulse = 1.8 + Math.sin(performance.now() * 0.004) * 0.9;
      tipMat.emissiveIntensity = pulse;
      for (const c of clouds) {
        c.position.x += dt * 1.2;
        if (c.position.x > 300) c.position.x = -300;
      }
    },
  };
}
