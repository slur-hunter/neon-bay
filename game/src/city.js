// Neon Bay city: a deterministic grid of blocks and streets at golden hour.
// The v9 fix lives here: the ground and the lights are warm and BRIGHT, so the
// asphalt, dashes and sidewalks read clearly instead of sinking to near-black.
// Own layout: streets every 70 units, blocks between them, city edge at +-190.
import * as THREE from 'three';
import { makeRng, range, rangeInt, pick } from './rng.js';

export const CITY_EDGE = 190;
export const STREET_AT = [-175, -105, -35, 35, 105, 175];
export const BLOCK = 56;
export const STREET_W = 14;

// Districts by quadrant. Jobs 1 and 2 both sit in Marina so the standing
// the HUD shows after job 1 (25) is real per-district standing.
export function districtAt(x, z) {
  if (x < 0 && z < 0) return 'Marina';
  if (x >= 0 && z < 0) return 'Harbour';
  if (x < 0 && z >= 0) return 'Old Town';
  return 'Downtown';
}

function windowTexture(rng, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3a2b3e';
  g.fillRect(0, 0, 128, 256);
  const cols = 4;
  const rows = 10;
  const cw = 128 / cols;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < litRatio;
      if (lit) {
        const warm = pick(rng, ['#ffd27a', '#ffb347', '#ffe9a8', '#ff9e57']);
        g.fillStyle = warm;
      } else {
        g.fillStyle = '#241a2e';
      }
      g.fillRect(col * cw + 5, r * rh + 6, cw - 10, rh - 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#2a1048');
  grad.addColorStop(0.35, '#6b2360');
  grad.addColorStop(0.62, '#c94b4b');
  grad.addColorStop(0.8, '#ff8a3c');
  grad.addColorStop(1.0, '#ffc46b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'city';

  // --- Sky, sun, fog: golden hour, warm and bright -------------------------
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xd97a52, 120, 420);

  // Hemisphere: warm sky above, warm tan ground below, STRONG so the street
  // never goes black. This is the core of the v9 brightness fix.
  const hemi = new THREE.HemisphereLight(0xffc07a, 0x9a7a5a, 1.9);
  scene.add(hemi);
  // Soft warm ambient lift on top of the hemisphere.
  const amb = new THREE.AmbientLight(0xffd9a8, 0.85);
  scene.add(amb);
  // Low sun from the west (-x), warm orange, long shadows.
  const sun = new THREE.DirectionalLight(0xff9a3c, 2.4);
  sun.position.set(-160, 55, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // Sun disc low on the western horizon, directly down street z=-35 so the
  // cover shot (which looks west down that street) sees it centred.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false })
  );
  disc.position.set(-380, 26, -35);
  disc.lookAt(0, 26, -35);
  scene.add(disc);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff8a3c, transparent: true, opacity: 0.5, fog: false,
    })
  );
  glow.position.set(-382, 26, -35);
  glow.lookAt(0, 26, -35);
  scene.add(glow);

  // --- Ground: warm asphalt, light enough to read --------------------------
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x7a6a5e, roughness: 0.95, metalness: 0.0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Sidewalk strips along every block edge, lighter than the asphalt.
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xa89478, roughness: 0.9 });
  for (let i = 0; i < STREET_AT.length - 1; i++) {
    for (let j = 0; j < STREET_AT.length - 1; j++) {
      const x0 = STREET_AT[i] + STREET_W / 2;
      const z0 = STREET_AT[j] + STREET_W / 2;
      const x1 = STREET_AT[i + 1] - STREET_W / 2;
      const z1 = STREET_AT[j + 1] - STREET_W / 2;
      const walk = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 4, 0.3, z1 - z0 + 4), walkMat);
      walk.position.set((x0 + x1) / 2, 0.15, (z0 + z1) / 2);
      walk.receiveShadow = true;
      group.add(walk);
    }
  }

  // Yellow centre dashes on every street, bright so they read at dusk.
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0xffc93c, roughness: 0.6, emissive: 0x664400,
  });
  const dashGeo = new THREE.BoxGeometry(4, 0.12, 1.1);
  for (const s of STREET_AT) {
    for (let t = -175; t <= 175; t += 14) {
      const d1 = new THREE.Mesh(dashGeo, dashMat);
      d1.position.set(t, 0.08, s);
      group.add(d1);
      const d2 = new THREE.Mesh(dashGeo, dashMat);
      d2.rotation.y = Math.PI / 2;
      d2.position.set(s, 0.08, t);
      group.add(d2);
    }
  }

  // Crosswalk stripes at the central intersections.
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8 });
  const stripeGeo = new THREE.BoxGeometry(1.6, 0.1, 10);
  for (const sx of [-35, 35]) {
    for (const sz of [-35, 35]) {
      for (let k = -2; k <= 2; k++) {
        const st = new THREE.Mesh(stripeGeo, crossMat);
        st.position.set(sx + k * 2.6, 0.07, sz);
        group.add(st);
      }
    }
  }

  // --- Buildings ------------------------------------------------------------
  const solids = [];
  const facadeTex = windowTexture(rng, 0.72);
  const wallCols = [0x5a3a52, 0x4a3550, 0x6b4238, 0x3e3a55, 0x54402e];
  for (let i = 0; i < STREET_AT.length - 1; i++) {
    for (let j = 0; j < STREET_AT.length - 1; j++) {
      const x0 = STREET_AT[i] + STREET_W / 2 + 3;
      const z0 = STREET_AT[j] + STREET_W / 2 + 3;
      const x1 = STREET_AT[i + 1] - STREET_W / 2 - 3;
      const z1 = STREET_AT[j + 1] - STREET_W / 2 - 3;
      const count = rangeInt(rng, 2, 3);
      for (let b = 0; b < count; b++) {
        const w = range(rng, 16, 26);
        const d = range(rng, 16, 26);
        const h = range(rng, 14, 46);
        const cx = range(rng, x0 + w / 2, x1 - w / 2);
        const cz = range(rng, z0 + d / 2, z1 - d / 2);
        const mat = new THREE.MeshStandardMaterial({
          map: facadeTex, color: pick(rng, wallCols), roughness: 0.85,
          emissive: 0xffb347, emissiveMap: facadeTex, emissiveIntensity: 0.55,
        });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        tower.position.set(cx, h / 2, cz);
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(w + 1.2, 0.8, d + 1.2),
          new THREE.MeshStandardMaterial({ color: 0x2e2430, roughness: 0.9 })
        );
        cap.position.set(cx, h + 0.4, cz);
        group.add(cap);
        solids.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      }
    }
  }

  // --- Streetlights at intersections (on, glowing) -------------------------
  // A real point light only at every other intersection: the hemisphere and
  // ambient already carry the scene's brightness, and 36 point lights crawl
  // on slow GPUs. The emissive lamp spheres still glow at every corner.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe9a8, emissive: 0xffc46b, emissiveIntensity: 2.2,
  });
  const lampLights = [];
  let li = 0;
  for (const sx of STREET_AT) {
    for (const sz of STREET_AT) {
      if (Math.abs(sx) > 180 || Math.abs(sz) > 180) continue;
      li++;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(sx + 8, 3.5, sz + 8);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), lampMat);
      lamp.position.set(sx + 8, 7.2, sz + 8);
      group.add(lamp);
      if (li % 2 === 0) {
        const pt = new THREE.PointLight(0xffc46b, 14, 26, 1.8);
        pt.position.set(sx + 8, 7, sz + 8);
        group.add(pt);
        lampLights.push(pt);
      }
    }
  }

  // --- Palm trees on sidewalk corners ---------------------------------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 0.9 });
  for (let k = 0; k < 46; k++) {
    const sx = pick(rng, STREET_AT);
    const sz = pick(rng, STREET_AT);
    const px = sx + pick(rng, [-9, 9]);
    const pz = sz + pick(rng, [-9, 9]);
    if (Math.abs(px) > 185 || Math.abs(pz) > 185) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.castShadow = true;
    group.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.72, 3.4, 4), frondMat);
      const a = (f / 6) * Math.PI * 2;
      frond.position.set(px + Math.cos(a) * 1.6, 7.6, pz + Math.sin(a) * 1.6);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      group.add(frond);
    }
  }

  scene.add(group);

  // Circle vs building AABB push-out. Returns corrected [x, z].
  function collide(x, z, r) {
    for (const s of solids) {
      const nx = Math.max(s.minX, Math.min(x, s.maxX));
      const nz = Math.max(s.minZ, Math.min(z, s.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          const pushL = x - (s.minX - r);
          const pushR = (s.maxX + r) - x;
          const pushB = z - (s.minZ - r);
          const pushF = (s.maxZ + r) - z;
          const m = Math.min(pushL, pushR, pushB, pushF);
          if (m === pushL) x = s.minX - r;
          else if (m === pushR) x = s.maxX + r;
          else if (m === pushB) z = s.minZ - r;
          else z = s.maxZ + r;
        }
      }
    }
    return [x, z];
  }

  function clampPos(x, z) {
    return [
      Math.max(-CITY_EDGE, Math.min(CITY_EDGE, x)),
      Math.max(-CITY_EDGE, Math.min(CITY_EDGE, z)),
    ];
  }

  return { group, solids, collide, clampPos, hemi, sun, lampLights };
}
