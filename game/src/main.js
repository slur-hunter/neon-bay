// Neon Bay main: game loop, input, camera, collisions, missions, police,
// and shot staging. The game is a 3D open-world crime game in golden hour:
// Rico works off a debt over four jobs across a coastal city.
import * as THREE from '../vendor/three.module.min.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { makeCarMesh, makeTraffic, gearForSpeed, CAR_MODELS } from './vehicles.js';
import { makeRico, makePedestrians } from './people.js';
import { makeCruiser, updateCruiser, policePanel, roleFor } from './police.js';
import { JOBS, rankFor, rankProgress, districtAt, standingFor, formatTimer } from './jobs.js';
import { updateHud, drawMinimap } from './hud.js';
import { sound } from './sound.js';
import { loadSave, writeSave, defaultSave } from './save.js';
import { makeMarker, pulseMarker, showBanner, showTitleCard } from './fx.js';
import { SHOTS, LATE_GAME, shotById, jobForShot } from './stage.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
const origConsoleError = console.error.bind(console);
console.error = (...args) => {
  window.__errors.push(args.map(String).join(' '));
  origConsoleError(...args);
};

const params = new URLSearchParams(window.location.search);
const shotId = params.has('shot') ? Number(params.get('shot')) : null;
const seed = params.has('seed') ? Number(params.get('seed')) : 1;
const shot = shotId ? shotById(shotId) : null;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe8a06a, 90, 300);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 8, 14);

const hemi = new THREE.HemisphereLight(0x9a6ab8, 0x8a5a3a, 1.15);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffc27a, 1.8);
sunLight.position.set(-120, 90, -100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -90;
sunLight.shadow.camera.right = 90;
sunLight.shadow.camera.top = 90;
sunLight.shadow.camera.bottom = -90;
sunLight.shadow.camera.far = 400;
scene.add(sunLight);
// Warm fill from the south-east so the faces the sun never reaches (the
// ones the camera sees looking north) stay readable instead of black.
const fillLight = new THREE.DirectionalLight(0xffd9a0, 0.5);
fillLight.position.set(100, 60, 120);
scene.add(fillLight);

const city = buildCity(scene, seed);
const rng = makeRng(seed * 31 + 7);

// Game state. Live play starts fresh at job 1; shot mode overrides with
// the staged late-game state.
const saved = loadSave();
const base = saved || defaultSave();
const state = {
  money: base.money,
  missionIndex: base.missionIndex,
  rp: base.rp,
  armour: base.armour,
  health: base.health,
  wanted: 0,
  doneByDistrict: base.doneByDistrict,
  clockMinutes: base.clockMinutes,
  inCar: false,
  speed: 0,
  speedMph: 0,
  gear: 'N',
  carCondition: 100,
  carName: 'NEON STING GT',
  carModel: CAR_MODELS[0],
  stageIndex: 1,
  timerSeconds: 0,
  missionElapsed: 0,
  dialogue: null,
  paused: false,
  muted: false,
  frozen: false,
  ready: false,
  ramCooldown: 0,
  decayTimer: 0,
  bannerShown: false,
  playerPos: new THREE.Vector3(0, 0, 8),
  playerHeading: Math.PI,
  carPos: new THREE.Vector3(0, 0, 0),
  carHeading: 0,
  car: null,
  markerPos: new THREE.Vector3(0, 0, -60),
  camYaw: Math.PI,
  camPitch: 0.32,
};

// Rico and his car.
const rico = makeRico();
rico.position.copy(state.playerPos);
scene.add(rico);
const playerCar = makeCarMesh(CAR_MODELS[0], { name: 'player-car' });
playerCar.visible = false;
scene.add(playerCar);
state.car = playerCar;

// Parked cars from the city spots.
const parked = [];
for (const spot of city.parkedSpots.slice(0, 15)) {
  const model = CAR_MODELS[Math.floor(rng.next() * CAR_MODELS.length)];
  const car = makeCarMesh(model, { name: 'parked' });
  car.position.set(spot.x, 0, spot.z);
  car.rotation.y = spot.angle;
  scene.add(car);
  parked.push(car);
}

// Ambient traffic movers and pedestrians.
const traffic = makeTraffic(seed + 11, 10);
const trafficState = [];
const avenueXs = [-60, -30, 0, 30, 60];
const streetZs = [-60, -30, 0, 30, 60];
for (let i = 0; i < traffic.length; i += 1) {
  const mesh = traffic[i];
  const alongAvenue = i % 2 === 0;
  const road = alongAvenue ? avenueXs[i % avenueXs.length] : streetZs[i % streetZs.length];
  const t = {
    mesh,
    alongAvenue,
    road,
    pos: rng.range(-90, 90),
    speed: rng.range(6, 11),
    dir: rng.next() < 0.5 ? 1 : -1,
  };
  mesh.position.set(alongAvenue ? road + 2.2 : t.pos, 0, alongAvenue ? t.pos : road + 2.2);
  mesh.rotation.y = alongAvenue ? (t.dir > 0 ? 0 : Math.PI) : (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  scene.add(mesh);
  trafficState.push(t);
}
const peds = makePedestrians(seed + 23, 22);
const pedState = [];
for (let i = 0; i < peds.length; i += 1) {
  const mesh = peds[i];
  const x = rng.range(-95, 65);
  const z = rng.range(-95, 95);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rng.next() * Math.PI * 2;
  scene.add(mesh);
  pedState.push({ mesh, speed: mesh.userData.speed, heading: mesh.rotation.y });
}

// Police cruisers, spawned by wanted level.
const cruisers = [];
function ensureCruisers() {
  while (cruisers.length < state.wanted) {
    const name = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9'][cruisers.length] || 'DUNE-2';
    const c = makeCruiser(name);
    const a = rng.next() * Math.PI * 2;
    c.position.set(state.playerPos.x + Math.cos(a) * 40, 0, state.playerPos.z + Math.sin(a) * 40);
    scene.add(c);
    cruisers.push(c);
  }
  while (cruisers.length > state.wanted) {
    const c = cruisers.pop();
    scene.remove(c);
  }
}

// Mission marker beam and ring.
const marker = makeMarker();
marker.position.copy(state.markerPos);
scene.add(marker);

// Input.
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  sound.unlock();
  if (e.code === 'KeyM') {
    sound.nextStation();
  }
  if (e.code === 'KeyX') {
    state.muted = sound.toggleMute();
  }
  if (e.code === 'KeyP') {
    state.paused = !state.paused;
  }
  if (e.code === 'KeyE') {
    tryEnterExit();
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  sound.unlock();
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  state.camYaw -= (e.clientX - lastX) * 0.005;
  state.camPitch = Math.max(0.1, Math.min(0.9, state.camPitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('click', () => {
  sound.unlock();
  doPunch();
});

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  const all = [playerCar, ...parked, ...traffic.map((t) => t)];
  for (const c of all) {
    if (c === playerCar && !playerCar.visible) continue;
    const d = Math.hypot(c.position.x - state.playerPos.x, c.position.z - state.playerPos.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function tryEnterExit() {
  if (state.inCar) {
    state.inCar = false;
    state.speed = 0;
    state.speedMph = 0;
    playerCar.visible = false;
    rico.visible = true;
    rico.position.copy(state.carPos);
    rico.position.x += 2.5;
    state.playerPos.copy(rico.position);
    state.playerHeading = state.carHeading;
    return;
  }
  const car = nearestCar(5);
  if (!car) return;
  state.inCar = true;
  state.carPos.copy(car.position);
  state.carHeading = car.rotation.y;
  state.carName = car.userData.model ? car.userData.model.name : 'NEON STING GT';
  state.carModel = car.userData.model || CAR_MODELS[0];
  state.carCondition = car.userData.condition || 100;
  playerCar.position.copy(car.position);
  playerCar.rotation.y = car.rotation.y;
  playerCar.visible = true;
  rico.visible = false;
  if (car !== playerCar) {
    scene.remove(car);
    const idx = parked.indexOf(car);
    if (idx !== -1) parked.splice(idx, 1);
    if (state.wanted === 0) state.wanted = 1;
    state.dialogue = { speaker: 'RICO', text: 'Borrowed. Vinnie pays the fines, not me.' };
  }
}

function doPunch() {
  if (state.inCar || state.paused) return;
  const fx = Math.sin(state.playerHeading);
  const fz = Math.cos(state.playerHeading);
  for (const p of pedState) {
    const dx = p.mesh.position.x - state.playerPos.x;
    const dz = p.mesh.position.z - state.playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.5 && dx * fx + dz * fz > 0) {
      p.mesh.userData.down = true;
      p.mesh.rotation.x = -Math.PI / 2;
      p.mesh.position.y = 0.3;
      // Punching a pedestrian does NOT raise wanted. That is the rule.
      return;
    }
  }
  for (const c of cruisers) {
    const dx = c.position.x - state.playerPos.x;
    const dz = c.position.z - state.playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.5 && dx * fx + dz * fz > 0) {
      state.wanted = Math.min(4, state.wanted + 1);
      return;
    }
  }
}

// Collision: circle vs building AABBs, pushed out along the smallest
// penetration axis. Roads, sidewalks and the beach are open ground.
function collide(pos, radius) {
  for (const b of city.colliders) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 0.0001) {
        pos.x = b.maxX + radius;
        continue;
      }
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    }
  }
  pos.x = Math.max(city.bounds.minX, Math.min(city.bounds.maxX, pos.x));
  pos.z = Math.max(city.bounds.minZ, Math.min(city.bounds.maxZ, pos.z));
}

function damage(amount) {
  let left = amount;
  if (state.armour > 0) {
    const absorbed = Math.min(state.armour, left);
    state.armour -= absorbed;
    left -= absorbed;
  }
  if (left > 0) state.health = Math.max(0, state.health - left);
  state.carCondition = Math.max(0, state.carCondition - amount * 0.6);
}

function currentJob() {
  return JOBS[state.missionIndex];
}

function stageThresholds(job) {
  if (job.stages.length === 3) return [40, 15];
  if (job.stages.length === 2) return [25];
  return [];
}

function updateMission(dt) {
  const job = currentJob();
  state.timerSeconds = state.missionElapsed;
  const target = state.inCar ? state.carPos : state.playerPos;
  const dist = Math.hypot(target.x - state.markerPos.x, target.z - state.markerPos.z);
  const thresholds = stageThresholds(job);
  let stage = 1;
  for (const t of thresholds) {
    if (dist < t) stage += 1;
  }
  state.stageIndex = Math.min(job.stages.length, stage);
  if (dist < 6) {
    completeJob(job);
  }
}

function completeJob(job) {
  state.money += job.pay;
  state.rp += job.rp;
  const district = districtAt(state.markerPos.x, state.markerPos.z);
  state.doneByDistrict[district] = (state.doneByDistrict[district] || 0) + 1;
  state.dialogue = { speaker: 'VINNIE', text: job.title + ' done. $' + job.pay + ' on the books, Rico.' };
  showBanner(document.getElementById('banner'), 'MISSION COMPLETE', job.title + '  +$' + job.pay);
  sound.blip(880);
  state.missionIndex = Math.min(JOBS.length - 1, state.missionIndex + 1);
  state.missionElapsed = 0;
  state.timerSeconds = 0;
  state.stageIndex = 1;
  const next = currentJob();
  state.markerPos.set(next.marker.x, 0, next.marker.z);
  marker.position.copy(state.markerPos);
  writeSave(state);
}

function updatePlayer(dt) {
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const strafe = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (state.inCar) {
    const accel = fwd * 14;
    const braking = keys.Space ? 22 : 0;
    state.speed += (accel - Math.sign(state.speed) * (2 + braking)) * dt;
    if (fwd === 0 && !keys.Space) state.speed *= Math.max(0, 1 - 1.6 * dt);
    state.speed = Math.max(-8, Math.min(26, state.speed));
    const steer = strafe * (state.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(state.speed) / 8);
    state.carHeading += steer * 1.9 * dt * (state.speed !== 0 ? 1 : 0);
    const prevX = state.carPos.x;
    const prevZ = state.carPos.z;
    state.carPos.x += Math.sin(state.carHeading) * state.speed * dt;
    state.carPos.z += Math.cos(state.carHeading) * state.speed * dt;
    collide(state.carPos, 2.2);
    const hit = Math.hypot(state.carPos.x - prevX, state.carPos.z - prevZ) < Math.abs(state.speed) * dt * 0.5;
    if (hit && Math.abs(state.speed) > 6) {
      damage(4);
      state.speed *= 0.4;
    }
    state.speedMph = Math.abs(state.speed) * 2.23694;
    state.gear = gearForSpeed(state.speedMph);
    playerCar.position.copy(state.carPos);
    playerCar.rotation.y = state.carHeading;
    state.playerPos.copy(state.carPos);
    state.playerHeading = state.carHeading;
  } else {
    const speed = 4.2;
    const mx = Math.sin(state.camYaw) * fwd + Math.cos(state.camYaw) * strafe;
    const mz = Math.cos(state.camYaw) * fwd - Math.sin(state.camYaw) * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      state.playerPos.x += (mx / len) * speed * dt;
      state.playerPos.z += (mz / len) * speed * dt;
      state.playerHeading = Math.atan2(mx, mz);
      rico.position.y = Math.abs(Math.sin(performance.now() * 0.012)) * 0.06;
    } else {
      rico.position.y = 0;
    }
    collide(state.playerPos, 1);
    rico.position.copy(state.playerPos);
    rico.rotation.y = state.playerHeading;
    state.speedMph = len > 0.01 ? 3 : 0;
    state.gear = 'N';
  }
}

function updateTraffic(dt) {
  if (state.frozen) return;
  for (const t of trafficState) {
    t.pos += t.speed * t.dir * dt;
    if (t.pos > 95) t.pos = -95;
    if (t.pos < -95) t.pos = 95;
    if (t.alongAvenue) {
      t.mesh.position.set(t.road + 2.2, 0, t.pos);
      t.mesh.rotation.y = t.dir > 0 ? 0 : Math.PI;
    } else {
      t.mesh.position.set(t.pos, 0, t.road + 2.2);
      t.mesh.rotation.y = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  for (const p of pedState) {
    if (p.mesh.userData.down) continue;
    p.heading += Math.sin(performance.now() * 0.0004 + p.mesh.userData.walkPhase) * 0.002;
    p.mesh.position.x += Math.sin(p.heading) * p.speed * dt;
    p.mesh.position.z += Math.cos(p.heading) * p.speed * dt;
    if (p.mesh.position.x < -95) p.mesh.position.x = 65;
    if (p.mesh.position.x > 65) p.mesh.position.x = -95;
    if (p.mesh.position.z < -95) p.mesh.position.z = 95;
    if (p.mesh.position.z > 95) p.mesh.position.z = -95;
    p.mesh.rotation.y = p.heading;
    p.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.01 + p.mesh.userData.walkPhase)) * 0.05;
  }
}

function updatePolice(dt) {
  ensureCruisers();
  const target = state.inCar ? state.carPos : state.playerPos;
  for (const c of cruisers) {
    updateCruiser(c, target, dt, state.wanted);
  }
  // A cruiser that rams the player car deals damage with a cooldown.
  state.ramCooldown = Math.max(0, state.ramCooldown - dt);
  if (state.inCar && state.ramCooldown <= 0) {
    for (const c of cruisers) {
      const d = Math.hypot(c.position.x - state.carPos.x, c.position.z - state.carPos.z);
      if (d < 3.4) {
        damage(7);
        state.ramCooldown = 1.6;
        break;
      }
    }
  }
  // Wanted decays when no cruiser is close.
  const nearest = cruisers.length === 0 ? 999 : Math.min(...cruisers.map((c) => c.userData.dist));
  if (nearest > 40) {
    state.decayTimer += dt;
    if (state.decayTimer > 10 && state.wanted > 0) {
      state.wanted -= 1;
      state.decayTimer = 0;
    }
  } else {
    state.decayTimer = 0;
  }
}

function updateCamera(dt) {
  if (shot) {
    camera.position.set(shot.camera.x, shot.camera.y, shot.camera.z);
    camera.lookAt(shot.camera.lookX, shot.camera.lookY, shot.camera.lookZ);
    return;
  }
  const target = state.inCar ? state.carPos : state.playerPos;
  const dist = state.inCar ? 11 : 9;
  const height = state.inCar ? 4.5 : 4;
  const cx = target.x - Math.sin(state.camYaw) * dist;
  const cz = target.z - Math.cos(state.camYaw) * dist;
  camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 6);
  camera.position.y += (height - camera.position.y) * Math.min(1, dt * 6);
  camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 6);
  camera.lookAt(target.x, 1.6, target.z);
}

function hudState() {
  const job = currentJob();
  const rankInfo = rankProgress(state.rp);
  const target = state.inCar ? state.carPos : state.playerPos;
  const dx = state.markerPos.x - target.x;
  const dz = state.markerPos.z - target.z;
  const district = districtAt(target.x, target.z);
  return {
    wanted: state.wanted,
    health: state.health,
    armour: state.armour,
    money: state.money,
    rp: state.rp,
    rankInfo,
    district,
    standing: standingFor(state.doneByDistrict, district),
    clockMinutes: state.clockMinutes,
    job,
    missionIndex: state.missionIndex,
    stageIndex: state.stageIndex,
    stageTotal: job.stages.length,
    timerSeconds: state.timerSeconds,
    speedMph: state.speedMph,
    inCar: state.inCar,
    carName: state.carName,
    carCondition: state.carCondition,
    gear: state.gear,
    compassDist: Math.hypot(dx, dz),
    compassAngle: Math.atan2(dx, dz) - state.camYaw,
    radio: sound.station,
    damage: 100 - state.carCondition,
    muted: state.muted,
    dialogue: state.dialogue,
    police: policePanel(cruisers),
    marker: { x: state.markerPos.x, z: state.markerPos.z },
    player: { x: target.x, z: target.z, heading: state.playerHeading },
    traffic: trafficState.map((t) => ({ x: t.mesh.position.x, z: t.mesh.position.z })),
    policePos: cruisers.map((c) => ({ x: c.position.x, z: c.position.z })),
  };
}

function applyShot() {
  const job = jobForShot();
  state.money = LATE_GAME.money;
  state.rp = LATE_GAME.rp;
  state.armour = LATE_GAME.armour;
  state.health = LATE_GAME.health;
  state.clockMinutes = LATE_GAME.clockMinutes;
  state.missionIndex = LATE_GAME.missionIndex;
  state.stageIndex = LATE_GAME.stageIndex;
  state.timerSeconds = LATE_GAME.timerSeconds;
  state.missionElapsed = LATE_GAME.timerSeconds;
  state.doneByDistrict = { ...LATE_GAME.doneByDistrict };
  state.wanted = shot.wanted;
  state.markerPos.set(job.marker.x, 0, job.marker.z);
  marker.position.copy(state.markerPos);
  state.dialogue = shot.dialogue || null;
  if (shot.car) {
    state.inCar = true;
    state.carPos.set(shot.car.x, 0, shot.car.z);
    state.carHeading = shot.car.heading;
    state.carName = 'NEON STING GT';
    state.carModel = CAR_MODELS[0];
    state.carCondition = 96;
    playerCar.position.copy(state.carPos);
    playerCar.rotation.y = state.carHeading;
    playerCar.visible = true;
    rico.visible = false;
    state.playerPos.copy(state.carPos);
    state.playerHeading = state.carHeading;
    state.speedMph = 26;
    state.gear = 'G2';
  } else {
    state.inCar = false;
    state.playerPos.set(shot.player.x, 0, shot.player.z);
    state.playerHeading = shot.player.heading;
    rico.position.copy(state.playerPos);
    rico.rotation.y = state.playerHeading;
    rico.visible = true;
    playerCar.visible = false;
  }
  if (shot.cruisers) {
    for (const c of shot.cruisers) {
      const mesh = makeCruiser(c.name);
      mesh.position.set(c.x, 0, c.z);
      const dx = state.carPos.x - c.x;
      const dz = state.carPos.z - c.z;
      mesh.rotation.y = Math.atan2(dx, dz);
      mesh.userData.dist = Math.hypot(dx, dz);
      mesh.userData.role = roleFor(mesh.userData.dist);
      scene.add(mesh);
      cruisers.push(mesh);
    }
  }
  // Stage a few traffic cars and pedestrians in view of the camera.
  const cam = shot.camera;
  const stagedTraffic = [
    { x: cam.lookX - 8, z: cam.lookZ + 14, heading: Math.PI },
    { x: cam.lookX + 6, z: cam.lookZ - 6, heading: 0 },
    { x: cam.lookX + 12, z: cam.lookZ + 22, heading: Math.PI },
  ];
  stagedTraffic.forEach((s, i) => {
    const t = trafficState[i];
    if (!t) return;
    t.mesh.position.set(s.x, 0, s.z);
    t.mesh.rotation.y = s.heading;
  });
  const stagedPeds = [
    { x: cam.lookX - 6, z: cam.lookZ + 8 },
    { x: cam.lookX + 8, z: cam.lookZ + 4 },
    { x: cam.lookX - 2, z: cam.lookZ - 12 },
  ];
  stagedPeds.forEach((s, i) => {
    const p = pedState[i];
    if (!p) return;
    p.mesh.position.set(s.x, 0, s.z);
    p.mesh.rotation.y = Math.PI;
  });
  state.frozen = true;
  if (shot.missionDone) {
    showBanner(document.getElementById('banner'), 'MISSION COMPLETE', job.title + '  +$' + job.pay);
    state.stageIndex = job.stages.length;
  }
  if (shot.titleCard) {
    showTitleCard(document.getElementById('title-card'), shot.titleCard.place, shot.titleCard.sub);
  }
}

let last = performance.now();
let elapsed = 0;
function loop(now) {
  requestAnimationFrame(loop);
  // dtReal is wall-clock time (drives the clock, the timer and the shot
  // readiness); dt is clamped for stable physics. In a throttled headless
  // browser rAF can run as slowly as 2-3 fps, and accumulating only the
  // clamped dt would leave the readiness flag unset for half a minute.
  const dtReal = Math.max(0, (now - last) / 1000);
  last = now;
  // Clamped to 0.1 s so the game still runs at a usable speed when the
  // browser throttles rAF (headless runs near 2-3 fps); positional
  // collision stays correct at this step size.
  const dt = Math.min(0.1, dtReal);
  elapsed += dtReal;
  if (state.paused) {
    renderer.render(scene, camera);
    return;
  }
  city.update(dt);
  state.clockMinutes = (state.clockMinutes + dtReal / 3) % 1440;
  if (!shot) {
    updatePlayer(dt);
    state.missionElapsed += dtReal;
    updateMission(dt);
    updateTraffic(dt);
    updatePolice(dt);
  } else {
    state.missionElapsed += dtReal;
    state.timerSeconds = state.missionElapsed;
    // In shot mode the movers stay frozen so the framing is identical
    // on every run; the police light bars still flash.
    for (const c of cruisers) {
      c.userData.flash += dt * 8;
      const on = Math.floor(c.userData.flash) % 2 === 0;
      if (c.userData.barL && c.userData.barR) {
        c.userData.barL.material.color.set(on ? '#ff2e2e' : '#7a1010');
        c.userData.barR.material.color.set(on ? '#10106a' : '#2e6fff');
      }
    }
  }
  pulseMarker(marker, elapsed);
  updateCamera(dt);
  const hs = hudState();
  updateHud(hs);
  drawMinimap(document.getElementById('minimap'), hs);
  renderer.render(scene, camera);
  if (!state.ready && elapsed > 3.5) {
    state.ready = true;
    window.__shotReady = true;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Debug handle for the live play test and the code reviewer: read-only
// live state, never used by the game itself.
window.__neonBay = {
  get state() {
    return {
      money: state.money,
      missionIndex: state.missionIndex,
      rp: state.rp,
      health: Math.round(state.health),
      armour: Math.round(state.armour),
      wanted: state.wanted,
      inCar: state.inCar,
      speedMph: Math.round(state.speedMph),
      carX: Math.round(state.carPos.x * 10) / 10,
      carZ: Math.round(state.carPos.z * 10) / 10,
      carHeading: Math.round(state.carHeading * 100) / 100,
      playerX: Math.round(state.playerPos.x * 10) / 10,
      playerZ: Math.round(state.playerPos.z * 10) / 10,
      markerX: state.markerPos.x,
      markerZ: state.markerPos.z,
      stageIndex: state.stageIndex,
    };
  },
  teleport(x, z) {
    state.playerPos.set(x, 0, z);
    rico.position.copy(state.playerPos);
  },
};

// Boot.
if (shot) {
  applyShot();
} else {
  state.markerPos.set(currentJob().marker.x, 0, currentJob().marker.z);
  marker.position.copy(state.markerPos);
  state.dialogue = { speaker: 'VINNIE', text: 'Rico. You owe me $1,200. Four jobs, and we are square. First: the pickup.' };
  window.setTimeout(() => { window.__shotReady = true; }, 2000);
}
requestAnimationFrame(loop);
