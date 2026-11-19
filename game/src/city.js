// createCity builds the whole of Neon Bay: ground, roads, buildings, docks,
// beach, bridge, streetlights, neon signs and the sun. One clear job: the world.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROAD_LINES = [-180, -140, -100, -60, -20, 20, 60, 100, 140, 180];
const BLOCKS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];

function groundTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext('2d');
  const px = (x) => (x + 320) * (1024 / 640);
  g.fillStyle = '#232330';
  g.fillRect(0, 0, 1024, 1024);
  // water south and east
  g.fillStyle = '#0a2a4a';
  g.fillRect(0, px(240), 1024, 1024 - px(240));
  g.fillRect(px(240), 0, 1024 - px(240), 1024);
  // sand beach strip
  g.fillStyle = '#b99b62';
  g.fillRect(0, px(190), px(240), px(240) - px(190));
  // roads
  for (const r of ROAD_LINES) {
    g.fillStyle = '#2e2e40';
    g.fillRect(px(r - 7), 0, px(r + 7) - px(r - 7), 1024);
    g.fillRect(0, px(r - 7), 1024, px(r + 7) - px(r - 7));
    // sidewalks
    g.fillStyle = '#3a3a4e';
    g.fillRect(px(r - 11), 0, px(r - 7) - px(r - 11), 1024);
    g.fillRect(px(r + 7), 0, px(r + 11) - px(r + 7), 1024);
    g.fillRect(0, px(r - 11), 1024, px(r - 7) - px(r - 11));
    g.fillRect(0, px(r + 7), 1024, px(r + 11) - px(r + 7));
    // centre dashes
    g.fillStyle = '#c9a227';
    for (let d = -300; d < 300; d += 16) {
      g.fillRect(px(r - 0.6), px(d), px(r + 0.6) - px(r - 0.6), px(d + 7) - px(d));
      g.fillRect(px(d), px(r - 0.6), px(d + 7) - px(d), px(r + 0.6) - px(r - 0.6));
    }
  }
  // crosswalks at every intersection
  g.fillStyle = '#d8d8e0';
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      for (let k = -6; k <= 6; k += 3) {
        g.fillRect(px(rx + k - 1), px(rz - 9), px(rx + k + 1) - px(rx + k - 1), 3);
        g.fillRect(px(rx - 9), px(rz + k - 1), 3, px(rz + k + 1) - px(rz + k - 1));
      }
    }
  }
  // plaza tiles at the centre
  g.fillStyle = '#26263a';
  g.fillRect(px(-14), px(-14), px(14) - px(-14), px(14) - px(-14));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function windowTexture(rng, litChance) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0c0c18';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 16) {
      if (rng() < litChance) {
        g.fillStyle = rng() < 0.7 ? '#ffd27a' : '#7ae8ff';
        g.globalAlpha = 0.55 + rng() * 0.45;
      } else {
        g.fillStyle = '#1c2438';
        g.globalAlpha = 1;
      }
      g.fillRect(x, y, 10, 11);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a14';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 40px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(scene, seed) {
  const rng = mulberry32(seed);
  const buildingBoxes = [];
  const group = new THREE.Group();
  scene.add(group);

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  group.add(ground);

  // sky, fog, lights
  scene.background = new THREE.Color(0x241640);
  scene.fog = new THREE.Fog(0x241640, 160, 460);
  const hemi = new THREE.HemisphereLight(0x8a7bd8, 0x1a1226, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a5c, 1.4);
  sun.position.set(-120, 90, 60);
  scene.add(sun);
  const amb = new THREE.AmbientLight(0x505080, 0.8);
  scene.add(amb);

  // window texture variants shared by all buildings
  const winTexs = [windowTexture(rng, 0.62), windowTexture(rng, 0.5), windowTexture(rng, 0.72)];
  const wallColors = [0x3a4060, 0x46425e, 0x3f4a5e, 0x52445e, 0x3c5248];
  const neonColors = [0x00e5ff, 0xff2d78, 0xffe14d, 0x7cff5e, 0xff7a3d];
  const signWords = [
    ['HOTEL', '#ff2d78'], ['NEON', '#00e5ff'], ['24H TACOS', '#ffe14d'],
    ['BAY BAR', '#7cff5e'], ['PIER 9', '#00e5ff'], ['CASINO', '#ffd27a'],
    ['NOODLES', '#ff7a3d'], ['MOTEL', '#ff2d78'], ['ARCADE', '#7cff5e'],
    ['DANCE', '#ff2d78'], ['SURF', '#00e5ff'], ['PIZZA', '#ffe14d'],
  ];

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let signIndex = 0;
  const landmarks = {};
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      // docks take the east column, plaza stays empty at the centre
      if (bx >= 160) continue;
      if (bx === 0 && bz === 0) continue;
      const dist = Math.sqrt(bx * bx + bz * bz);
      const count = rng() < 0.22 ? 0 : 1 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i++) {
        const w = 12 + rng() * 10;
        const d = 12 + rng() * 10;
        const tall = Math.max(0, 1 - dist / 260);
        const h = 10 + rng() * 14 + tall * (18 + rng() * 26);
        const ox = (rng() - 0.5) * (26 - w);
        const oz = (rng() - 0.5) * (26 - d);
        const x = bx + ox;
        const z = bz + oz;
        const tex = winTexs[Math.floor(rng() * winTexs.length)].clone();
        tex.needsUpdate = true;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
        const mat = new THREE.MeshLambertMaterial({
          map: tex,
          color: wallColors[Math.floor(rng() * wallColors.length)],
        });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        group.add(b);
        buildingBoxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        // neon roof edge
        if (rng() < 0.55) {
          const edge = new THREE.Mesh(
            boxGeo,
            new THREE.MeshBasicMaterial({ color: neonColors[Math.floor(rng() * neonColors.length)] })
          );
          edge.scale.set(w + 0.4, 0.5, d + 0.4);
          edge.position.set(x, h + 0.25, z);
          group.add(edge);
        }
        // rooftop box
        if (rng() < 0.5) {
          const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x1c1c28 }));
          roof.scale.set(3 + rng() * 3, 2, 3 + rng() * 3);
          roof.position.set(x + (rng() - 0.5) * w * 0.4, h + 1, z + (rng() - 0.5) * d * 0.4);
          group.add(roof);
        }
        // neon sign on the face toward the nearest road
        if (rng() < 0.7 && signIndex < signWords.length) {
          const [word, color] = signWords[signIndex++];
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(14, 3.5),
            new THREE.MeshBasicMaterial({ map: signTexture(word, color), transparent: true })
          );
          sign.position.set(x, Math.min(h - 2, 14), z + d / 2 + 0.15);
          group.add(sign);
        }
      }
    }
  }

  // The Spire: the tall tower at the north plaza
  const spire = new THREE.Mesh(
    boxGeo,
    new THREE.MeshLambertMaterial({ map: winTexs[0], color: 0x3a3f5e })
  );
  spire.scale.set(18, 92, 18);
  spire.position.set(0, 46, -160);
  group.add(spire);
  buildingBoxes.push({ minX: -9, maxX: 9, minZ: -169, maxZ: -151 });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2d78 })
  );
  beacon.position.set(0, 94, -160);
  beacon.name = 'spireBeacon';
  group.add(beacon);
  landmarks.spire = new THREE.Vector3(0, 0, -160);

  // Docks: piers, containers, crane on the east edge
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x4a3f30 });
  for (let i = 0; i < 3; i++) {
    const pier = new THREE.Mesh(boxGeo, dockMat);
    pier.scale.set(46, 2, 10);
    pier.position.set(263, 1, -120 + i * 110);
    group.add(pier);
  }
  const containerColors = [0xb8442e, 0x2e7ab8, 0x3da55e, 0xc9a227, 0x7a4db8];
  for (let i = 0; i < 14; i++) {
    const cont = new THREE.Mesh(
      boxGeo,
      new THREE.MeshLambertMaterial({ color: containerColors[i % containerColors.length] })
    );
    cont.scale.set(12, 3, 3.4);
    cont.position.set(196 + rng() * 30, 1.5 + (i % 3) * 3.1, -150 + rng() * 300);
    cont.rotation.y = (rng() - 0.5) * 0.2;
    group.add(cont);
    buildingBoxes.push({
      minX: cont.position.x - 6, maxX: cont.position.x + 6,
      minZ: cont.position.z - 1.8, maxZ: cont.position.z + 1.8,
    });
  }
  // crane
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
  const craneBase = new THREE.Mesh(boxGeo, craneMat);
  craneBase.scale.set(4, 26, 4);
  craneBase.position.set(230, 13, -40);
  group.add(craneBase);
  const craneArm = new THREE.Mesh(boxGeo, craneMat);
  craneArm.scale.set(34, 2, 2);
  craneArm.position.set(216, 25, -40);
  group.add(craneArm);
  landmarks.docks = new THREE.Vector3(230, 0, -40);

  // Beach bar on the sand
  const bar = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a5a2e }));
  bar.scale.set(16, 6, 10);
  bar.position.set(0, 3, 212);
  group.add(bar);
  buildingBoxes.push({ minX: -8, maxX: 8, minZ: 207, maxZ: 217 });
  const barSign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: signTexture('BAY BAR', '#7cff5e'), transparent: true })
  );
  barSign.position.set(0, 7.5, 217.2);
  group.add(barSign);
  landmarks.beachBar = new THREE.Vector3(0, 0, 212);

  // palms on the beach
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8a4a });
  for (let i = 0; i < 10; i++) {
    const px = -140 + i * 30 + rng() * 10;
    const pz = 200 + rng() * 24;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.rotation.z = (rng() - 0.5) * 0.2;
    group.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), leafMat);
    top.scale.y = 0.45;
    top.position.set(px, 7.2, pz);
    group.add(top);
  }

  // Bridge over the north water strip
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x0a2a4a });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(640, 60), waterMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, 0.05, -215);
  group.add(river);
  const deck = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x3a3a4a }));
  deck.scale.set(22, 1.5, 56);
  deck.position.set(0, 0.75, -212);
  group.add(deck);
  for (const side of [-11, 11]) {
    const rail = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
    rail.scale.set(0.5, 1, 56);
    rail.position.set(side, 2, -212);
    group.add(rail);
  }
  landmarks.bridge = new THREE.Vector3(0, 0, -212);

  // streetlights at intersections (emissive heads, no real lights)
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222228 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      if (rng() < 0.55) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
      pole.position.set(rx + 9, 3.5, rz + 9);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), headMat);
      head.position.set(rx + 9, 7.1, rz + 9);
      group.add(head);
    }
  }

  // a few real point lights where the action is
  const plazaLight = new THREE.PointLight(0xff2d78, 60, 90);
  plazaLight.position.set(0, 12, 0);
  group.add(plazaLight);
  const dockLight = new THREE.PointLight(0x00e5ff, 50, 80);
  dockLight.position.set(230, 10, -40);
  group.add(dockLight);
  const barLight = new THREE.PointLight(0x7cff5e, 40, 60);
  barLight.position.set(0, 9, 212);
  group.add(barLight);

  // collision: push a circle out of every building box
  function collide(pos, radius) {
    for (const b of buildingBoxes) {
      if (pos.x > b.minX - radius && pos.x < b.maxX + radius &&
          pos.z > b.minZ - radius && pos.z < b.maxZ + radius) {
        const dxl = pos.x - (b.minX - radius);
        const dxr = (b.maxX + radius) - pos.x;
        const dzl = pos.z - (b.minZ - radius);
        const dzr = (b.maxZ + radius) - pos.z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) pos.x = b.minX - radius;
        else if (m === dxr) pos.x = b.maxX + radius;
        else if (m === dzl) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
        return true;
      }
    }
    return false;
  }

  let t = 0;
  return {
    buildingBoxes,
    landmarks,
    collide,
    update(dt, minutes) {
      t += dt;
      // sun: noon is up, midnight is down; 18:20 sits just past sunset (dusk)
      const dayFrac = (minutes % 1440) / 1440;
      const ang = dayFrac * Math.PI * 2;
      const elev = -Math.cos(ang);
      const dusk = Math.max(0, 1 - Math.abs(elev) * 2.2);
      sun.position.set(Math.cos(ang) * 160, 30 + Math.max(0, elev) * 140, 80);
      sun.color.setHSL(0.07 + dusk * 0.02, 0.9, 0.55 + (1 - dusk) * 0.1);
      sun.intensity = 1.1 + Math.max(0, elev) * 1.3 + dusk * 0.7;
      hemi.intensity = 1.0 + Math.max(0, elev) * 0.5;
      scene.background.setHSL(0.72, 0.55, 0.16 + Math.max(0, elev) * 0.12 + dusk * 0.1);
      scene.fog.color.copy(scene.background);
      beacon.material.color.setHSL((t * 0.2) % 1, 0.9, 0.6);
    },
  };
}
