// Neon Bay — main loop, input, camera, missions, wanted, debug hooks.
// Original open-world crime game: Rico owes $1,200 to Vinnie "The Ledger"
// Marlow and works it off over four jobs across a golden-hour city.
import * as THREE from 'three';
import { buildCity, STREET_LINES } from './city.js';
import { makeHero, stepHero } from './hero.js';
import { makeVehicles } from './vehicles.js';
import { makePeds } from './peds.js';
import { makePolice } from './police.js';
import { makeJobs, districtAt } from './jobs.js';
import { makeSound } from './sound.js';
import { makeFx } from './fx.js';
import { makeHud } from './hud.js';
import { setupShot } from './stage.js';
import { loadSave, storeSave, clearSave } from './save.js';
import { clamp, dist2, yawTo } from './rng.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

const params = new URLSearchParams(location.search);
const shotNum = params.get('shot') ? parseInt(params.get('shot'), 10) : null;
window.__shot = shotNum;
window.__ready = false;
window.__shotReady = false;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1400);
camera.position.set(0, 8, 54);

const city = buildCity(scene);
const hero = makeHero(scene);
const vehicles = makeVehicles(scene, city);
const peds = makePeds(scene, city);
const police = makePolice(scene, city);
const jobs = makeJobs();
const sound = makeSound();
const fx = makeFx(scene);
const hud = makeHud(document);

// Mission marker: gold beam + spinning ring at the current job's spot.
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.3 });
const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 42, 12, 1, true), beamMat);
beam.position.y = 21;
scene.add(beam);
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(2.4, 0.14, 8, 32),
  new THREE.MeshBasicMaterial({ color: 0xffd21f }),
);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.25;
scene.add(ring);

function refreshMarker() {
  const job = jobs.current();
  if (jobs.state.index >= jobs.JOBS.length) {
    beam.visible = false;
    ring.visible = false;
    return;
  }
  beam.visible = true;
  ring.visible = true;
  beam.position.x = job.marker.x;
  beam.position.z = job.marker.z;
  ring.position.x = job.marker.x;
  ring.position.z = job.marker.z;
}

const ctx = {
  hero, vehicles, peds, police, jobs, camera,
  inCar: false, car: null, speed: 0, health: 100, camYaw: Math.PI,
  refreshMarker,
  refreshHud(force) { updateHud(force); },
};

let mode = shotNum ? 'shot' : 'menu';
let frames = 0;
let shotStartedAt = performance.now();
let lastTime = performance.now();
let camPitch = 0.12;
const keys = {};
let dragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

const saved = loadSave();
if (saved) jobs.applySave(saved);

function playerPos() {
  if (ctx.inCar && ctx.car) return { x: ctx.car.x, z: ctx.car.z };
  return { x: hero.x, z: hero.z };
}
function playerYaw() {
  if (ctx.inCar && ctx.car) return ctx.car.yaw;
  return hero.yaw;
}

function updateHud() {
  const pos = playerPos();
  const job = jobs.current();
  const district = districtAt(pos.x, pos.z);
  const rel = yawTo(pos.x, pos.z, job.marker.x, job.marker.z) - ctx.camYaw;
  const units = police.list.map((c) => ({
    callsign: c.callsign, role: c.role, dist: Math.round(c.dist),
  }));
  const banner = jobs.state.bannerTimer > 0 ? jobs.state.banner : '';
  hud.update({
    wanted: police.wanted,
    health: ctx.health,
    money: jobs.money,
    rank: jobs.rank,
    rp: jobs.rp,
    district,
    standing: jobs.standingHere(district),
    policeUnits: units,
    mission: job,
    stage: `${Math.min(jobs.state.index + 1, 4)}/4`,
    next: jobs.state.index + 1 < jobs.JOBS.length
      ? jobs.JOBS[jobs.state.index + 1].title : 'Free roam',
    speaker: job.speaker,
    story: job.story,
    speedLabel: ctx.inCar ? `${Math.round(Math.abs(ctx.speed) * 2.237)} mph` : 'ON FOOT',
    compassArrow: hud.compassArrow(rel),
    compassDist: Math.round(dist2(pos.x, pos.z, job.marker.x, job.marker.z)),
    radio: ctx.inCar ? sound.station : null,
    damage: ctx.inCar && ctx.car ? ctx.car.damage : null,
    banner,
    soundOn: !sound.muted,
    marker: jobs.state.index < jobs.JOBS.length ? job.marker : null,
    player: { x: pos.x, z: pos.z, yaw: playerYaw() },
    traffic: [...vehicles.movers, ...vehicles.parked].map((c) => ({ x: c.x, z: c.z })),
    police: police.list.map((c) => ({ x: c.x, z: c.z })),
  });
}

function enterCar() {
  const pos = playerPos();
  const car = vehicles.nearestStealable(pos.x, pos.z, 3.5);
  if (!car) return;
  car.taken = true;
  ctx.car = car;
  ctx.inCar = true;
  ctx.speed = 0;
  hero.group.visible = false;
  police.raiseWanted(1);
  sound.blip('pickup');
  sound.startRadio();
}

function exitCar() {
  if (!ctx.car) return;
  const c = ctx.car;
  hero.x = c.x - Math.sin(c.yaw) * 2.6;
  hero.z = c.z - Math.cos(c.yaw) * 2.6;
  const fixed = city.collide(hero.x, hero.z, 0.55);
  hero.x = fixed.x;
  hero.z = fixed.z;
  hero.group.position.set(hero.x, 0, hero.z);
  hero.group.visible = true;
  ctx.car = null;
  ctx.inCar = false;
  ctx.speed = 0;
  sound.stopRadio();
}

function doPunch() {
  if (mode !== 'play' || ctx.inCar) return;
  if (hero.punchCooldown > 0) return;
  hero.punchTimer = 0.28;
  hero.punchCooldown = 0.45;
  sound.blip('punch');
  const ped = peds.nearestInFront(hero.x, hero.z, hero.yaw, 2.3);
  if (ped) {
    peds.knockDown(ped);
    fx.burst(ped.x, 1.2, ped.z, 0xffd21f, 10);
    fx.shake(0.5);
    return;
  }
  // A police car in front: punching it raises wanted by 1.
  let best = null;
  let bestD = 2.6;
  for (const c of police.list) {
    const d = dist2(hero.x, hero.z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best) {
    police.raiseWanted(1);
    fx.burst(best.x, 1.2, best.z, 0xff2a2a, 12);
    fx.shake(0.8);
    sound.blip('crash');
  }
}

function startGame(fromSave) {
  sound.ensure();
  if (!fromSave) {
    jobs.state.index = 0;
    jobs.state.money = 0;
    jobs.state.rp = 0;
    jobs.state.doneByDistrict = {};
    jobs.state.missionsDone = 0;
  }
  hero.x = 0;
  hero.z = 40;
  hero.yaw = Math.PI;
  hero.group.position.set(0, 0, 40);
  hero.group.visible = true;
  ctx.health = 100;
  ctx.inCar = false;
  ctx.car = null;
  mode = 'play';
  hud.hide('start-overlay');
  hud.hide('gameover-overlay');
  hud.hide('pause-overlay');
  refreshMarker();
}

// --- input ---------------------------------------------------------------
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyE' && mode === 'play') {
    if (ctx.inCar) exitCar();
    else enterCar();
  }
  if (e.code === 'KeyP' && (mode === 'play' || mode === 'paused')) {
    mode = mode === 'play' ? 'paused' : 'play';
    if (mode === 'paused') hud.show('pause-overlay');
    else hud.hide('pause-overlay');
  }
  if (e.code === 'KeyM' && mode === 'play') {
    sound.toggleStation();
    sound.blip('click');
  }
  if (e.code === 'KeyX') {
    sound.setMuted(!sound.muted);
  }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});
addEventListener('mouseup', (e) => {
  if (dragging && Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY) < 6) {
    doPunch();
  }
  dragging = false;
});
addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  ctx.camYaw -= dx * 0.005;
  camPitch = clamp(camPitch + dy * 0.003, -0.05, 0.55);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

document.getElementById('start-btn').addEventListener('click', () => startGame(false));
const contBtn = document.getElementById('continue-btn');
if (contBtn) {
  if (saved && saved.missionIndex > 0) contBtn.style.display = 'block';
  contBtn.addEventListener('click', () => startGame(true));
}
document.getElementById('resume-btn').addEventListener('click', () => {
  mode = 'play';
  hud.hide('pause-overlay');
});
document.getElementById('restart-btn').addEventListener('click', () => {
  clearSave();
  startGame(false);
});
document.getElementById('retry-btn').addEventListener('click', () => {
  clearSave();
  startGame(false);
});

// --- debug hooks -----------------------------------------------------------
window.__game = {
  get debug() {
    const pos = playerPos();
    return {
      mode,
      money: jobs.money,
      health: Math.round(ctx.health),
      wanted: police.wanted,
      missionIndex: jobs.state.index,
      missionsDone: jobs.state.missionsDone,
      inCar: ctx.inCar,
      playerPos: { x: Math.round(pos.x * 10) / 10, z: Math.round(pos.z * 10) / 10 },
      speed: Math.round(ctx.speed * 10) / 10,
      shot: shotNum,
      frames,
      camYaw: Math.round(ctx.camYaw * 100) / 100,
      cameraMode: mode === 'shot' ? 'staged' : 'follow',
      carYaw: ctx.car ? Math.round(ctx.car.yaw * 100) / 100 : 0,
      carPos: ctx.car
        ? { x: Math.round(ctx.car.x * 10) / 10, z: Math.round(ctx.car.z * 10) / 10 }
        : null,
      policeCount: police.list.length,
      policePos: police.list.map((c) => ({ x: Math.round(c.x), z: Math.round(c.z) })),
      parked: vehicles.parked.filter((c) => !c.taken).map((c) => ({ x: Math.round(c.x), z: Math.round(c.z) })),
      marker: jobs.state.index < jobs.JOBS.length ? jobs.current().marker : null,
      rp: jobs.rp,
      rank: jobs.rank,
    };
  },
};

// --- main loop ---------------------------------------------------------------
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  frames += 1;

  if (mode === 'shot') {
    // Staged world: traffic holds its marks so the staged framing is
    // deterministic (ambient movers would otherwise drift for 4 s and
    // change the shot between runs). Pedestrians still stroll slowly;
    // cruiser bars flash and the marker spins.
    peds.step(dt, hero.x, hero.z, 0);
    const pos = playerPos();
    police.step(dt, pos.x, pos.z, ctx.speed, null);
    ring.rotation.z += dt * 0.8;
    if (jobs.state.bannerTimer > 0) jobs.state.bannerTimer -= dt;
    if (!window.__shotReady && performance.now() - shotStartedAt >= 4000 && frames >= 5) {
      window.__shotReady = true;
    }
    updateHud();
  } else if (mode === 'play') {
    const input = {
      f: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0),
      s: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
      run: !!keys.ShiftLeft || !!keys.ShiftRight,
      brake: !!keys.Space,
      camYaw: ctx.camYaw,
    };
    if (ctx.inCar && ctx.car) {
      vehicles.driveCar(ctx.car, input, dt, city);
      ctx.speed = ctx.car.speed;
    } else {
      ctx.speed = stepHero(hero, input, dt, city);
    }
    vehicles.stepMovers(dt, city);
    const pos = playerPos();
    peds.step(dt, pos.x, pos.z, Math.abs(ctx.speed));
    const ramDmg = police.step(dt, pos.x, pos.z, Math.abs(ctx.speed), (c) => {
      if (ctx.inCar && ctx.car) {
        ctx.car.damage = clamp(ctx.car.damage + 7, 0, 100);
        fx.burst(pos.x, 1, pos.z, 0xff9a3d, 8);
        fx.shake(0.7);
        sound.blip('crash');
      } else {
        ctx.health = clamp(ctx.health - 5, 0, 100);
        fx.burst(pos.x, 1.2, pos.z, 0xff2a2a, 8);
        fx.shake(0.7);
        sound.blip('crash');
      }
    });
    if (ramDmg > 0 && ctx.inCar && ctx.car) {
      // ramDamage is already applied in the callback; nothing extra here.
    }
    // Mission completion.
    const done = jobs.tryComplete(pos.x, pos.z);
    if (done) {
      sound.blip('pickup');
      fx.burst(done.marker.x, 2, done.marker.z, 0xffd21f, 18);
      storeSave({ money: jobs.money, missionIndex: jobs.state.index, rp: jobs.rp });
      refreshMarker();
    }
    if (jobs.state.bannerTimer > 0) jobs.state.bannerTimer -= dt;
    else jobs.state.banner = '';
    ring.rotation.z += dt * 0.8;
    // Camera follow: behind the player, eased.
    const lookX = Math.sin(ctx.camYaw);
    const lookZ = Math.cos(ctx.camYaw);
    const dist = ctx.inCar ? 12 : 9;
    const height = ctx.inCar ? 5 : 4.5;
    const wantX = pos.x - lookX * dist;
    const wantZ = pos.z - lookZ * dist;
    const k = 1 - Math.exp(-6 * dt);
    camera.position.x += (wantX - camera.position.x) * k;
    camera.position.y += (height - camera.position.y) * k;
    camera.position.z += (wantZ - camera.position.z) * k;
    camera.lookAt(pos.x + lookX * 4, 1.6, pos.z + lookZ * 4);
    sound.engine(ctx.speed, ctx.inCar);
    sound.siren(police.wanted > 0, dt);
    if (ctx.health <= 0) {
      mode = 'over';
      sound.blip('busted');
      sound.stopRadio();
      storeSave({ money: jobs.money, missionIndex: jobs.state.index, rp: jobs.rp });
      hud.show('gameover-overlay');
    }
    updateHud();
  }

  fx.step(dt, camera);
  if (!window.__ready) window.__ready = true;
  renderer.render(scene, camera);
}

if (shotNum) {
  setupShot(shotNum, ctx);
  shotStartedAt = performance.now();
  refreshMarker();
  updateHud();
  hud.hide('start-overlay');
  hud.hide('loading');
} else {
  refreshMarker();
  updateHud();
  hud.hide('loading');
}
requestAnimationFrame(tick);
