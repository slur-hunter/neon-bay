// Neon Bay city: a deterministic grid of blocks and streets in golden-hour
// light. All geometry is procedural. Road paint is drawn at realistic scale:
// centre-line dashes are short yellow rectangles and crosswalks are narrow
// parallel white bars, each marking far smaller than a car. (v10 drew the
// paint as giant plus signs as wide as a car; that is the bug v11 fixes.)
import * as THREE from 'three';
import { mulberry32, range, pick, chance } from './rng.js';

export const PITCH = 60; // block (44) + street (16)
export const STREET_HALF = 8; // half the street width
export const CITY_EDGE = 190; // clamp for player and cars
export const STREET_LINES = [-180, -120, -60, 0, 60, 120, 180];

function windowTexture(rng, hue) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = hue;
  g.fillRect(0, 0, 128, 256);
  const rows = 12;
  const cols = 6;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < 0.62;
      const warm = pick(rng, ['#ffb347', '#ffcf7a', '#ff9a3d', '#ffd28a']);
      g.fillStyle = lit ? warm : '#1c1626';
      g.fillRect(8 + col * 20, 10 + r * 20, 13, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#241640');
  grad.addColorStop(0.45, '#5b2a63');
  grad.addColorStop(0.72, '#b34a6e');
  grad.addColorStop(0.88, '#ff7a3d');
  grad.addColorStop(1.0, '#ffb347');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const rng = mulberry32(20261121);
  const solids = []; // {x0,z0,x1,z1} building bounds for collision

  // --- sky dome and sun disc -------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(620, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(30, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd98a, fog: false }),
  );
  sun.position.set(0, 52, -540);
  sun.lookAt(0, 52, 0);
  scene.add(sun);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(52, 40),
    new THREE.MeshBasicMaterial({ color: 0xff9a5a, transparent: true, opacity: 0.28, fog: false }),
  );
  halo.position.set(0, 52, -545);
  halo.lookAt(0, 52, 0);
  scene.add(halo);

  // --- lights: warm golden hour, bright ground -------------------------
  scene.add(new THREE.HemisphereLight(0xffc07a, 0x9a7a5a, 1.9));
  scene.add(new THREE.AmbientLight(0xffd9a8, 0.85));
  const sunLight = new THREE.DirectionalLight(0xffb36b, 2.4);
  sunLight.position.set(140, 95, -320);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -210;
  sunLight.shadow.camera.right = 210;
  sunLight.shadow.camera.top = 210;
  sunLight.shadow.camera.bottom = -210;
  sunLight.shadow.camera.far = 900;
  scene.add(sunLight);
  scene.fog = new THREE.Fog(0x8a5a7a, 260, 820);

  // --- ground: warm tan asphalt ----------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshStandardMaterial({ color: 0x7d675a, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- sidewalks: lighter tan strips along every block edge ------------
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xa89478, roughness: 0.95 });
  const walkGeo = new THREE.BoxGeometry(1, 0.18, 1);
  const walkMesh = new THREE.InstancedMesh(walkGeo, walkMat, 400);
  const m4 = new THREE.Matrix4();
  let walkCount = 0;
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      const x0 = STREET_LINES[i] + STREET_HALF + 1.5;
      const x1 = STREET_LINES[i + 1] - STREET_HALF - 1.5;
      const z0 = STREET_LINES[j] + STREET_HALF + 1.5;
      const z1 = STREET_LINES[j + 1] - STREET_HALF - 1.5;
      const w = x1 - x0;
      const d = z1 - z0;
      // north and south strips
      m4.makeScale(w, 1, 3);
      m4.setPosition((x0 + x1) / 2, 0.09, z0 + 1.5);
      walkMesh.setMatrixAt(walkCount++, m4);
      m4.makeScale(w, 1, 3);
      m4.setPosition((x0 + x1) / 2, 0.09, z1 - 1.5);
      walkMesh.setMatrixAt(walkCount++, m4);
      // west and east strips
      m4.makeScale(3, 1, d);
      m4.setPosition(x0 + 1.5, 0.09, (z0 + z1) / 2);
      walkMesh.setMatrixAt(walkCount++, m4);
      m4.makeScale(3, 1, d);
      m4.setPosition(x1 - 1.5, 0.09, (z0 + z1) / 2);
      walkMesh.setMatrixAt(walkCount++, m4);
    }
  }
  walkMesh.count = walkCount;
  walkMesh.receiveShadow = true;
  scene.add(walkMesh);

  // --- road paint: SMALL dashes and NARROW bars ------------------------
  // Centre-line dash: 1.4 m long, 0.22 m wide. A car is 4.4 m long, so a
  // dash is a third of a car. Never a plus, never a cross.
  const dashGeo = new THREE.BoxGeometry(0.22, 0.04, 1.4);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.8 });
  const dashSpots = [];
  for (const s of STREET_LINES) {
    for (let t = -186; t <= 186; t += 6) {
      const nearCross = STREET_LINES.some((c) => Math.abs(t - c) < 11);
      if (nearCross) continue; // keep intersections clean for crosswalks
      dashSpots.push([s, t, 0]); // dash along a Z-running street (x = s)
      dashSpots.push([t, s, 1]); // dash along an X-running street (z = s)
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashSpots.length);
  dashSpots.forEach(([x, z, along], i) => {
    m4.makeRotationY(along === 1 ? Math.PI / 2 : 0);
    m4.setPosition(x, 0.03, z);
    dashMesh.setMatrixAt(i, m4);
  });
  scene.add(dashMesh);

  // Crosswalk: narrow parallel bars. Each bar is 0.5 m wide and 2.6 m
  // long, spaced 1.1 m apart across the lane. One bar is a thin stripe;
  // the whole crossing reads as zebra stripes, never as a giant plus.
  const barGeo = new THREE.BoxGeometry(0.5, 0.04, 2.6);
  const barMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.8 });
  const barSpots = [];
  for (const sx of STREET_LINES) {
    for (const sz of STREET_LINES) {
      // crossings on the four approaches of every intersection
      for (const [dx, dz, rot] of [
        [0, -11, 0], [0, 11, 0], [-11, 0, 1], [11, 0, 1],
      ]) {
        for (let k = -3; k <= 3; k++) {
          const off = k * 1.1;
          if (rot === 0) barSpots.push([sx + dx + off, sz + dz, 0]);
          else barSpots.push([sx + dx, sz + dz + off, 1]);
        }
      }
    }
  }
  const barMesh = new THREE.InstancedMesh(barGeo, barMat, barSpots.length);
  barSpots.forEach(([x, z, rot], i) => {
    m4.makeRotationY(rot === 1 ? Math.PI / 2 : 0);
    m4.setPosition(x, 0.03, z);
    barMesh.setMatrixAt(i, m4);
  });
  scene.add(barMesh);

  // --- buildings: lit windows, flat roof caps --------------------------
  const facadeHues = ['#3a2b3f', '#2e2438', '#40302e', '#33283f'];
  const texs = facadeHues.map((h) => windowTexture(mulberry32(7 + facadeHues.indexOf(h)), h));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x241c28, roughness: 1 });
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      const cx = (STREET_LINES[i] + STREET_LINES[i + 1]) / 2;
      const cz = (STREET_LINES[j] + STREET_LINES[j + 1]) / 2;
      const w = range(rng, 30, 38);
      const d = range(rng, 30, 38);
      const h = range(rng, 13, 40);
      const tex = pick(rng, texs);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissiveMap: tex, emissive: 0xffc070, emissiveIntensity: 0.85, roughness: 0.9,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx + range(rng, -2, 2), h / 2, cz + range(rng, -2, 2));
      b.castShadow = true;
      b.receiveShadow = true;
      scene.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.8, d + 1), roofMat);
      roof.position.set(b.position.x, h + 0.4, b.position.z);
      scene.add(roof);
      solids.push({
        x0: b.position.x - w / 2, x1: b.position.x + w / 2,
        z0: b.position.z - d / 2, z1: b.position.z + d / 2,
      });
    }
  }

  // --- palm trees: trunk + cone, instanced ------------------------------
  const palmSpots = [];
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      if (chance(rng, 0.75)) {
        const cx = (STREET_LINES[i] + STREET_LINES[i + 1]) / 2;
        const cz = (STREET_LINES[j] + STREET_LINES[j + 1]) / 2;
        palmSpots.push([cx + range(rng, -18, 18), cz + range(rng, -18, 18)]);
      }
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 5.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const coneGeo = new THREE.ConeGeometry(2.4, 3.4, 7);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 0.9 });
  const coneMesh = new THREE.InstancedMesh(coneGeo, coneMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    m4.identity();
    m4.setPosition(x, 2.6, z);
    trunkMesh.setMatrixAt(i, m4);
    m4.identity();
    m4.setPosition(x, 6.6, z);
    coneMesh.setMatrixAt(i, m4);
  });
  scene.add(trunkMesh);
  scene.add(coneMesh);

  // --- streetlights at inner intersections ------------------------------
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 7, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7, metalness: 0.4 });
  const glowGeo = new THREE.SphereGeometry(0.55, 10, 8);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const sx of [-120, -60, 0, 60, 120]) {
    for (const sz of [-120, -60, 0, 60, 120]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(sx + 9.5, 3.5, sz + 9.5);
      scene.add(pole);
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(sx + 9.5, 7.1, sz + 9.5);
      scene.add(glow);
    }
  }

  // --- collision + clamp -------------------------------------------------
  function collide(x, z, r) {
    for (const s of solids) {
      const nx = Math.max(s.x0, Math.min(x, s.x1));
      const nz = Math.max(s.z0, Math.min(z, s.z1));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 0.0001) return { x: s.x1 + r, z };
        const d = Math.sqrt(d2);
        return { x: nx + (dx / d) * r, z: nz + (dz / d) * r };
      }
    }
    return { x, z };
  }
  function clampPos(x, z) {
    return {
      x: Math.max(-CITY_EDGE, Math.min(CITY_EDGE, x)),
      z: Math.max(-CITY_EDGE, Math.min(CITY_EDGE, z)),
    };
  }
  function onStreet(x, z) {
    return STREET_LINES.some((s) => Math.abs(x - s) <= STREET_HALF + 1)
      || STREET_LINES.some((s) => Math.abs(z - s) <= STREET_HALF + 1);
  }

  return { collide, clampPos, onStreet, solids };
}
