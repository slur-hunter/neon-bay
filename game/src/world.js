// The city of Neon Bay: a waterfront avenue (The Strand) with the ocean on its east
// side, so the horizon stays open; varied facades, readable signs, palms, a skyline
// to the north, and the gold marker beam and ring a job points at.
import { FACADES, SIGNS, WORLD } from './config.js';
import { makeCanvas, pick, skyCanvas } from './util.js';

const THREE = globalThis.THREE;

/** Facade texture: base colour, trim bands, a window grid with some windows lit warm. */
function facadeTexture(random, facade) {
  const canvas = makeCanvas(128, 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = facade.base;
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = facade.trim;
  ctx.fillRect(0, 0, 128, 10);
  ctx.fillRect(0, 246, 128, 10);
  const cols = 4;
  const rows = 8;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = 10 + col * 28;
      const y = 20 + row * 27;
      const lit = random() < facade.lit;
      ctx.fillStyle = lit ? '#ffd27a' : '#2c3550';
      ctx.fillRect(x, y, 18, 16);
      if (lit) {
        ctx.fillStyle = 'rgba(255, 210, 122, 0.35)';
        ctx.fillRect(x - 2, y - 2, 22, 20);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Sign texture: dark board, glowing name, small sub-line. */
function signTexture(sign) {
  const canvas = makeCanvas(512, 128);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14101f';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = sign.glow;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.textAlign = 'center';
  ctx.shadowColor = sign.glow;
  ctx.shadowBlur = 22;
  ctx.fillStyle = sign.colour;
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.fillText(sign.text, 256, 66);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d8d8e8';
  ctx.font = '24px Arial, sans-serif';
  ctx.fillText(sign.sub, 256, 102);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function box(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function createWorld(random) {
  const scene = new THREE.Scene();
  scene.background = new THREE.CanvasTexture(
    skyCanvas(16, 512, [
      [0, '#5a3a7a'],
      [0.35, '#a04a72'],
      [0.6, '#e86a45'],
      [0.8, '#ff9a3d'],
      [1, '#ffd27a'],
    ]),
  );
  scene.background.colorSpace = THREE.SRGBColorSpace;
  scene.fog = new THREE.Fog(0xe8734a, 140, 380);

  const sun = new THREE.DirectionalLight(0xffb36b, 2.6);
  sun.position.set(-90, 42, -110);
  scene.add(sun);
  // Warm fill from the south-east so the Strand-facing facades are readable.
  const fill = new THREE.DirectionalLight(0xffc890, 1.2);
  fill.position.set(60, 25, 80);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x3a2b4d, 1.5));

  // Sun disc low over the north-west skyline.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(14, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  sunDisc.position.set(-95, 34, -190);
  sunDisc.lookAt(0, 10, 60);
  scene.add(sunDisc);

  // Ground: city slab, then sand, then the ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 320),
    new THREE.MeshLambertMaterial({ color: 0x4a4a52 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-10, 0, -10);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 290),
    new THREE.MeshLambertMaterial({ color: 0xd9b380 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((WORLD.beachX0 + WORLD.beachX1) / 2, 0.01, -10);
  scene.add(sand);

  const oceanCanvas = skyCanvas(16, 256, [
    [0, '#7fd4e8'],
    [0.25, '#3fa8c9'],
    [0.6, '#1d6f9e'],
    [1, '#0d4d7a'],
  ]);
  const oceanTexture = new THREE.CanvasTexture(oceanCanvas);
  oceanTexture.colorSpace = THREE.SRGBColorSpace;
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 300),
    new THREE.MeshLambertMaterial({ map: oceanTexture }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(WORLD.oceanX0 + 170, 0.02, -10);
  scene.add(ocean);

  // Foam strip where the water meets the sand.
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 290),
    new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.75 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(WORLD.oceanX0 + 0.4, 0.03, -10);
  scene.add(foam);

  // Roads: the Strand avenue plus the side and cross streets.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e38 });
  const strand = new THREE.Mesh(new THREE.PlaneGeometry(14, 290), roadMat);
  strand.rotation.x = -Math.PI / 2;
  strand.position.set(WORLD.strandX, 0.04, -10);
  scene.add(strand);
  for (const x of WORLD.sideStreets) {
    const street = new THREE.Mesh(new THREE.PlaneGeometry(8, 290), roadMat);
    street.rotation.x = -Math.PI / 2;
    street.position.set(x, 0.04, -10);
    scene.add(street);
  }
  for (const z of WORLD.crossStreets) {
    const street = new THREE.Mesh(new THREE.PlaneGeometry(120, 8), roadMat);
    street.rotation.x = -Math.PI / 2;
    street.position.set(-8, 0.04, z);
    scene.add(street);
  }

  // Road paint, instanced: narrow crosswalk bars and small centre dashes. No marking
  // is larger than a car, and there are no plus or cross shapes.
  const barGeo = new THREE.BoxGeometry(0.5, 0.04, 2.6);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ea });
  const barPositions = [];
  for (const z of WORLD.crossStreets) {
    for (let i = 0; i < 5; i += 1) {
      barPositions.push([WORLD.strandX - 5.5 + i * 2.75, 0.06, z - 5.2]);
      barPositions.push([WORLD.strandX - 5.5 + i * 2.75, 0.06, z + 5.2]);
    }
    for (let i = 0; i < 4; i += 1) {
      barPositions.push([4 - i * 2.75, 0.06, z - 5.2]);
      barPositions.push([4 - i * 2.75, 0.06, z + 5.2]);
    }
  }
  const bars = new THREE.InstancedMesh(barGeo, barMat, barPositions.length);
  const dummy = new THREE.Object3D();
  barPositions.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    bars.setMatrixAt(i, dummy.matrix);
  });
  scene.add(bars);

  const dashGeo = new THREE.BoxGeometry(0.22, 0.04, 1.4);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const dashPositions = [];
  for (let z = WORLD.northEnd + 6; z < WORLD.southEnd; z += 6) {
    dashPositions.push([WORLD.strandX, 0.06, z]);
  }
  for (const x of WORLD.sideStreets) {
    for (let z = WORLD.northEnd + 6; z < WORLD.southEnd; z += 6) {
      dashPositions.push([x, 0.06, z]);
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashPositions.length);
  dashPositions.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  });
  scene.add(dashes);

  // Buildings: varied heights and the six facade colours, with a window texture each.
  const facadeMats = FACADES.map(
    (facade) => new THREE.MeshLambertMaterial({ map: facadeTexture(random, facade) }),
  );
  const buildings = [];
  const signSpots = [];
  const blockXs = [18, -2, -22, -42];
  for (const bx of blockXs) {
    for (let z = WORLD.northEnd + 18; z < WORLD.southEnd - 10; z += WORLD.blockDepth) {
      const height = 8 + random() * 22;
      const width = 12 + random() * 6;
      const depth = 14 + random() * 6;
      const mat = pick(random, facadeMats);
      const mesh = box(width, height, depth, mat, bx, height / 2, z + random() * 4 - 2);
      scene.add(mesh);
      buildings.push(mesh);
      if (bx === 18 && random() < 0.75) signSpots.push({ x: bx + width / 2 + 0.15, y: Math.min(height - 2, 12), z: mesh.position.z });
    }
  }

  // North skyline: tall dark towers against the sunset, so the horizon reads as a city.
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x3a2b4d });
  for (let i = 0; i < 14; i += 1) {
    const height = 34 + random() * 42;
    const width = 10 + random() * 8;
    const x = -70 + i * 11 + random() * 4;
    scene.add(box(width, height, 10, towerMat, x, height / 2, -168 - random() * 8));
  }
  for (let i = 0; i < 6; i += 1) {
    const height = 30 + random() * 30;
    scene.add(box(10, height, 10, towerMat, -78 - random() * 6, height / 2, -120 + i * 44));
  }

  // Signs on the Strand-facing facades, glowing and readable.
  const signMats = SIGNS.map((sign) => new THREE.MeshBasicMaterial({ map: signTexture(sign) }));
  signSpots.slice(0, 6).forEach((spot, i) => {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), signMats[i % signMats.length]);
    sign.position.set(spot.x, spot.y, spot.z);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);
  });

  // Palms along the beach edge, instanced trunks and crowns.
  const palmXs = [];
  const palmZs = [];
  for (let z = WORLD.northEnd + 12; z < WORLD.southEnd - 8; z += 14) {
    palmXs.push(49 + random() * 4);
    palmZs.push(z + random() * 4 - 2);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmXs.length);
  const crownGeo = new THREE.SphereGeometry(2.0, 8, 6);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e7d4f });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmXs.length);
  palmXs.forEach((x, i) => {
    dummy.position.set(x, 2.5, palmZs[i]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 5.4, palmZs[i]);
    dummy.scale.set(1, 0.45, 1);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  });
  scene.add(trunks);
  scene.add(crowns);

  // Street lamps along the Strand.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x22222a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let z = WORLD.northEnd + 20; z < WORLD.southEnd - 6; z += 28) {
    scene.add(box(0.3, 6, 0.3, lampMat, WORLD.strandX - 8, 3, z));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bulbMat);
    bulb.position.set(WORLD.strandX - 8, 6.2, z);
    scene.add(bulb);
    scene.add(box(0.3, 6, 0.3, lampMat, WORLD.strandX + 8, 3, z + 14));
    const bulb2 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bulbMat);
    bulb2.position.set(WORLD.strandX + 8, 6.2, z + 14);
    scene.add(bulb2);
  }

  // The job marker: a thin, faint gold beam and a flat ring on the ground.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 14, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.08, depthWrite: false }),
  );
  beam.position.set(WORLD.strandX, 7, -30);
  scene.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(WORLD.strandX, 0.08, -30);
  scene.add(ring);

  return {
    scene,
    beam,
    ring,
    setMarker(x, z) {
      beam.position.set(x, 7, z);
      ring.position.set(x, 0.08, z);
    },
  };
}
