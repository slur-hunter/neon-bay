// Neon Bay city: a seeded grid of blocks and streets under a golden-hour
// sky. Builds the ground, the sky dome, the low sun, the buildings with
// lit windows, palms and streetlights. Exposes collision and districts.
import * as THREE from 'three';

export const CITY_HALF = 120;
export const STREET_AT = [-96, -48, 0, 48, 96];
const ROAD_HALF = 7;

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const size = CITY_HALF * 2;
  const px = (v) => ((v + CITY_HALF) / size) * 1024;
  g.fillStyle = '#241f2b'; g.fillRect(0, 0, 1024, 1024);
  // sidewalks: lighter blocks between streets
  g.fillStyle = '#4a4552';
  for (let i = 0; i <= STREET_AT.length; i++) {
    const a = i === 0 ? -CITY_HALF : STREET_AT[i - 1] + ROAD_HALF;
    const b = i === STREET_AT.length ? CITY_HALF : STREET_AT[i] - ROAD_HALF;
    for (let j = 0; j <= STREET_AT.length; j++) {
      const c0 = j === 0 ? -CITY_HALF : STREET_AT[j - 1] + ROAD_HALF;
      const d0 = j === STREET_AT.length ? CITY_HALF : STREET_AT[j] - ROAD_HALF;
      g.fillRect(px(a), px(c0), px(b) - px(a), px(d0) - px(c0));
    }
  }
  // asphalt streets
  g.fillStyle = '#2c2833';
  for (const s of STREET_AT) {
    g.fillRect(0, px(s - ROAD_HALF), 1024, px(s + ROAD_HALF) - px(s - ROAD_HALF));
    g.fillRect(px(s - ROAD_HALF), 0, px(s + ROAD_HALF) - px(s - ROAD_HALF), 1024);
  }
  // yellow centre dashes
  g.fillStyle = '#c9a13b';
  for (const s of STREET_AT) {
    for (let v = -CITY_HALF + 6; v < CITY_HALF; v += 16) {
      g.fillRect(px(v), px(s) - 2, 26, 4);
      g.fillRect(px(s) - 2, px(v), 4, 26);
    }
  }
  // crosswalk stripes at every crossing
  g.fillStyle = '#cfc8d8';
  for (const sx of STREET_AT) for (const sz of STREET_AT) {
    for (let k = -3; k <= 3; k++) {
      g.fillRect(px(sx + k * 3) - 1, px(sz - ROAD_HALF) + 2, 3, 5);
      g.fillRect(px(sx + k * 3) - 1, px(sz + ROAD_HALF) - 7, 3, 5);
      g.fillRect(px(sx - ROAD_HALF) + 2, px(sz + k * 3) - 1, 5, 3);
      g.fillRect(px(sx + ROAD_HALF) - 7, px(sz + k * 3) - 1, 5, 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function windowTexture(rng, warm) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = warm ? '#5a3d55' : '#4a3a4e';
  g.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 10;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng.chance(0.62);
      g.fillStyle = lit ? (rng.chance(0.5) ? '#ffd27a' : '#ff9d4d') : '#2a2030';
      g.fillRect(8 + x * 30, 10 + y * 24, 20, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#2b1b4d');
  grad.addColorStop(0.35, '#6b2d63');
  grad.addColorStop(0.55, '#c65a4a');
  grad.addColorStop(0.72, '#ff8a3d');
  grad.addColorStop(0.82, '#ffb347');
  grad.addColorStop(1.0, '#ffcf7d');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sunGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 220, 140, 1)');
  grad.addColorStop(0.35, 'rgba(255, 160, 60, 0.55)');
  grad.addColorStop(1, 'rgba(255, 120, 40, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);

  // Sky dome: warm gradient, purple top to orange horizon.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  sky.position.y = 0;
  group.add(sky);

  // Sun disc low on the western horizon plus a big glow. Due west, so the
  // sightline down an east-west street reaches it past the rooftops.
  const sunDir = new THREE.Vector3(-0.97, 0.16, 0).normalize();
  const sunPos = sunDir.clone().multiplyScalar(390);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb050, fog: false }),
  );
  disc.position.copy(sunPos);
  disc.lookAt(0, 6, 0);
  group.add(disc);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 190),
    new THREE.MeshBasicMaterial({ map: sunGlowTexture(), transparent: true, depthWrite: false, fog: false }),
  );
  glow.position.copy(sunPos);
  glow.lookAt(0, 6, 0);
  group.add(glow);

  // Golden-hour lights: low warm sun, warm hemisphere.
  const sun = new THREE.DirectionalLight(0xffa050, 2.4);
  sun.position.set(-90, 38, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -140; sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140; sun.shadow.camera.bottom = -140;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xff8a4a, 0x3a2a3a, 0.85));
  scene.fog = new THREE.FogExp2(0x4a2c4e, 0.0016);

  // Ground with streets, sidewalks, dashes, crosswalks painted in.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2, CITY_HALF * 2),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Buildings: seeded per block, two window palettes, lit windows glow.
  const solids = [];
  const texA = windowTexture(rng, true);
  const texB = windowTexture(rng, false);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3340 });
  const mats = [texA, texB].map((t) => new THREE.MeshStandardMaterial({
    map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5, roughness: 0.9,
  }));
  const blockCenters = [];
  for (let i = 0; i < STREET_AT.length - 1; i++) {
    for (let j = 0; j < STREET_AT.length - 1; j++) {
      const x0 = STREET_AT[i] + ROAD_HALF, x1 = STREET_AT[i + 1] - ROAD_HALF;
      const z0 = STREET_AT[j] + ROAD_HALF, z1 = STREET_AT[j + 1] - ROAD_HALF;
      blockCenters.push([(x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0]);
    }
  }
  for (const [cx, cz, w, d] of blockCenters) {
    const count = rng.chance(0.55) ? 4 : 2;
    const spots = count === 4
      ? [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]
      : [[-0.25, 0], [0.25, 0]];
    for (const [fx, fz] of spots) {
      const bw = (count === 4 ? w * 0.42 : w * 0.42);
      const bd = (count === 4 ? d * 0.42 : d * 0.8);
      const h = rng.range(9, 30) * (rng.chance(0.18) ? 1.8 : 1);
      const bx = cx + fx * w, bz = cz + fz * d;
      const mat = rng.pick(mats);
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), mat);
      b.position.set(bx, h / 2, bz);
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, 0.5, bd + 0.6), roofMat);
      roof.position.set(bx, h + 0.25, bz);
      group.add(roof);
      solids.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2 });
    }
  }

  // Palm trees along the sidewalks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  for (let k = 0; k < 46; k++) {
    const street = rng.pick(STREET_AT);
    const along = rng.range(-CITY_HALF + 12, CITY_HALF - 12);
    const side = rng.chance(0.5) ? 1 : -1;
    const px = rng.chance(0.5) ? street + side * (ROAD_HALF + 2.5) : along;
    const pz = rng.chance(0.5) ? along : street + side * (ROAD_HALF + 2.5);
    const h = rng.range(5, 8);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, h, 6), trunkMat);
    trunk.position.set(px, h / 2, pz);
    trunk.castShadow = true;
    group.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 4), frondMat);
      const ang = (f / 5) * Math.PI * 2;
      frond.position.set(px + Math.cos(ang) * 0.9, h + 0.4, pz + Math.sin(ang) * 0.9);
      frond.rotation.z = Math.cos(ang) * 1.1;
      frond.rotation.x = -Math.sin(ang) * 1.1;
      group.add(frond);
    }
  }

  // Streetlights at intersections, glowing warm.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (const sx of STREET_AT) {
    for (const sz of STREET_AT) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), poleMat);
      pole.position.set(sx + ROAD_HALF + 1, 3.25, sz + ROAD_HALF + 1);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), lampMat);
      lamp.position.set(sx + ROAD_HALF + 1, 6.7, sz + ROAD_HALF + 1);
      group.add(lamp);
    }
  }

  const districts = [
    { name: 'Downtown', test: (x, z) => x < 0 && z < 0 },
    { name: 'Marina', test: (x, z) => x >= 0 && z < 0 },
    { name: 'Old Town', test: (x, z) => x < 0 && z >= 0 },
    { name: 'Harbor District', test: (x, z) => x >= 0 && z >= 0 },
  ];

  return {
    group,
    solids,
    collide(x, z, r) {
      let nx = x, nz = z;
      for (const b of solids) {
        const cx = Math.max(b.minX, Math.min(x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        const dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            nx = cx + (dx / d) * r;
            nz = cz + (dz / d) * r;
          } else {
            nx = x + r;
          }
        }
      }
      nx = Math.max(-CITY_HALF + 2, Math.min(CITY_HALF - 2, nx));
      nz = Math.max(-CITY_HALF + 2, Math.min(CITY_HALF - 2, nz));
      return { x: nx, z: nz };
    },
    districtAt(x, z) {
      for (const d of districts) if (d.test(x, z)) return d.name;
      return 'Downtown';
    },
    streetPoint(rng2) {
      const s = rng2.pick(STREET_AT);
      const along = rng2.range(-CITY_HALF + 10, CITY_HALF - 10);
      return rng2.chance(0.5) ? { x: s, z: along } : { x: along, z: s };
    },
  };
}
