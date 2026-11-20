// Neon Bay v7 — the engine. Renderer, input, car stealing, punching, damage,
// missions, HUD updates, camera modes and the game loop. Debug hooks are wired
// first, before any shot is staged.
import * as THREE from 'three';
import { buildMetropolis } from './metropolis.js';
import { createRico } from './rico.js';
import { createTraffic } from './traffic.js';
import { createSidewalk } from './sidewalk.js';
import { createPD } from './pd.js';
import { createContracts } from './contracts.js';
import { createBrawl } from './brawl.js';
import { createBursts } from './bursts.js';
import { createTunes } from './tunes.js';
import { loadKeep, saveKeep, clearKeep } from './keep.js';
import { createPanel } from './panel.js';
import { createDirector } from './director.js';

// Debug hooks, wired before anything else.
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.__ready = false;
window.__shotReady = false;
window.__shot = null;

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('gl') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

function fit() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', fit);
fit();

const city = buildMetropolis(scene);
const rico = createRico(scene, city);
const traffic = createTraffic(scene, city);
const sidewalk = createSidewalk(scene, city);
const pd = createPD(scene, city, traffic);
const jobs = createContracts(scene);
const brawl = createBrawl();
const bursts = createBursts(scene);
const tunes = createTunes();
const panel = createPanel();

const game = {
  scene, camera, renderer, city, rico, traffic, sidewalk, pd, jobs, brawl, bursts, tunes, panel,
  mode: 'menu',
  money: 0,
  health: 100,
  inCar: false,
  currentCar: null,
  cameraMode: 'menu',
  shotCam: null,
  shotNumber: null,
  frames: 0,
  startTime: performance.now(),
  camYaw: Math.PI,
  camPitch: 0.32,
  muted: false,
};

const director = createDirector(game);
game.director = director;

function focusPos() {
  if (game.inCar && game.currentCar) {
    return new THREE.Vector3(game.currentCar.pos.x, 1.2, game.currentCar.pos.z);
  }
  return new THREE.Vector3(rico.pos.x, 1.2, rico.pos.z);
}
game.focusPos = focusPos;

// ---------- input ----------
const keys = {};
let dragStart = null;
let dragging = false;

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.mode === 'playing') pauseGame();
    else if (game.mode === 'paused') resumeGame();
  }
  if (e.code === 'KeyM') {
    game.muted = !game.muted;
    tunes.setMuted(game.muted);
  }
  if (e.code === 'KeyE' && game.mode === 'playing') toggleCar();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

const canvas = document.getElementById('gl');
canvas.addEventListener('pointerdown', (e) => {
  dragStart = { x: e.clientX, y: e.clientY };
  dragging = false;
  tunes.init();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragStart) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 12) dragging = true;
  if (dragging) {
    game.camYaw -= dx * 0.005;
    game.camPitch = Math.max(0.08, Math.min(1.1, game.camPitch + dy * 0.003));
    dragStart = { x: e.clientX, y: e.clientY };
  }
});
canvas.addEventListener('pointerup', (e) => {
  const wasDrag = dragging;
  dragStart = null;
  dragging = false;
  // A click (not a drag) punches when Rico is on foot.
  if (!wasDrag && game.mode === 'playing' && !game.inCar) doPunch();
});

function readInput() {
  return {
    f: (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0,
    b: (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0,
    l: (keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0,
    r: (keys['KeyD'] || keys['ArrowRight']) ? 1 : 0,
    run: keys['ShiftLeft'] || keys['ShiftRight'] ? 1 : 0,
    brake: keys['Space'] ? 1 : 0,
  };
}

// ---------- cars ----------
function enterCar(car, silent) {
  if (!car || car.kind === 'police' || game.inCar) return false;
  game.inCar = true;
  game.currentCar = car;
  car.kind = 'driven';
  rico.group.visible = false;
  if (!silent) {
    pd.addWanted(1);
    panel.message('CAR STOLEN', 'The heat is on — lose the cops or outrun them.', 2600);
    tunes.crash();
  }
  return true;
}
function exitCar(silent) {
  if (!game.inCar || !game.currentCar) return;
  const car = game.currentCar;
  const off = 3;
  rico.reset(
    car.pos.x + Math.sin(car.yaw + Math.PI / 2) * off,
    car.pos.z + Math.cos(car.yaw + Math.PI / 2) * off,
    car.yaw,
  );
  car.speed = 0;
  car.kind = 'parked';
  game.inCar = false;
  game.currentCar = null;
  rico.group.visible = true;
}
function toggleCar() {
  if (game.inCar) { exitCar(false); return; }
  const car = traffic.nearestStealable(rico.pos, 4.5);
  if (car) enterCar(car, false);
}
game.enterCar = enterCar;
game.exitCar = exitCar;

// ---------- combat ----------
function doPunch() {
  rico.punch();
  const origin = rico.pos;
  const targets = [];
  for (const p of sidewalk.list) targets.push(p);
  for (const c of traffic.cars) if (c.kind === 'police') targets.push(c);
  const hits = brawl.punch(origin, rico.heading, targets);
  for (const t of hits) {
    if (t.group) {
      // A pedestrian: knocked flat, gold burst, and heat — hitting someone in
      // public is a crime, so the wanted level always goes up.
      sidewalk.knockDown(t, origin, performance.now() / 1000);
      bursts.burst(t.pos.x, 1.2, t.pos.z, 0xffd23f, 10);
      pd.addWanted(1);
    } else {
      // A police car: orange burst, shake, more heat.
      bursts.burst(t.pos.x, 1.2, t.pos.z, 0xff8c1a, 12);
      bursts.shake(0.35);
      pd.addWanted(1);
    }
  }
  if (hits.length) tunes.punch();
}

// ---------- damage ----------
function onDamage(amount, push, inCar) {
  if (game.mode !== 'playing') return;
  game.health -= amount;
  bursts.shake(0.5);
  tunes.crash();
  if (inCar && game.currentCar) {
    game.currentCar.pos.x += push.x * 1.5;
    game.currentCar.pos.z += push.z * 1.5;
  } else {
    rico.pos.x += push.x * 1.5;
    rico.pos.z += push.z * 1.5;
  }
  if (game.health <= 0) {
    game.health = 0;
    game.mode = 'gameover';
    tunes.busted();
    panel.showGameOver(`The Bay City PD finally caught up with Rico. The debt is still due — $${game.money} earned.`);
    saveKeep({ money: game.money, missionIndex: jobs.index });
  }
}

// ---------- missions + HUD ----------
function updateMissionHud() {
  if (jobs.done) {
    panel.setMission('<b>DEBT PAID</b><br>Neon Bay is yours — free roam.');
    panel.setStage(4, 4, 'DEBT PAID');
    const c = jobs.defs[3];
    panel.setDialogue(c.speaker, c.story);
    return;
  }
  const c = jobs.current();
  panel.setMission(`<b>${c.title}</b><br>${c.text}`);
  panel.setStage(jobs.index + 1, jobs.total(), jobs.nextTitle());
  panel.setDialogue(c.speaker, c.story);
}
game.updateMissionHud = updateMissionHud;

// ---------- flow ----------
function startGame(fromSave) {
  const save = fromSave ? loadKeep() : null;
  game.money = save ? save.money : 0;
  game.health = 100;
  jobs.reset(save ? save.missionIndex : 0);
  pd.setWanted(0);
  rico.reset(16, 40, Math.PI);
  rico.group.visible = true;
  game.inCar = false;
  game.currentCar = null;
  game.mode = 'playing';
  game.cameraMode = 'follow';
  panel.hideStart();
  panel.hidePause();
  panel.hideGameOver();
  tunes.init();
  tunes.click();
  updateMissionHud();
  panel.message('NEON BAY', 'Pay off the $1,200 debt — four jobs.', 3200);
}
function pauseGame() {
  game.mode = 'paused';
  panel.showPause();
  saveKeep({ money: game.money, missionIndex: jobs.index });
}
function resumeGame() {
  game.mode = 'playing';
  panel.hidePause();
  tunes.click();
}

document.getElementById('startBtn').addEventListener('click', () => startGame(false));
document.getElementById('continueBtn').addEventListener('click', () => startGame(true));
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('restartBtn').addEventListener('click', () => { clearKeep(); startGame(false); });

// ---------- camera ----------
function updateCamera(dt) {
  const shake = bursts.shakeOffset();
  const focus = focusPos();
  if (game.cameraMode === 'shot' && game.shotCam) {
    camera.position.set(
      focus.x + game.shotCam.offset.x + shake.x,
      focus.y + game.shotCam.offset.y + shake.y,
      focus.z + game.shotCam.offset.z,
    );
    camera.lookAt(focus.x + game.shotCam.lookOffset.x, focus.y + game.shotCam.lookOffset.y, focus.z + game.shotCam.lookOffset.z);
    return;
  }
  if (game.cameraMode === 'menu') {
    const t = performance.now() / 1000 * 0.05;
    camera.position.set(Math.sin(t) * 120, 70, Math.cos(t) * 120);
    camera.lookAt(0, 0, 0);
    return;
  }
  // Follow: ease behind the player or the car.
  const heading = game.inCar && game.currentCar ? game.currentCar.yaw : rico.heading;
  const targetYaw = heading + Math.PI;
  let d = targetYaw - game.camYaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  game.camYaw += d * Math.min(1, dt * 2.2);
  const dist = game.inCar ? 12 : 9;
  const height = game.inCar ? 5.2 : 4.2;
  const cy = height + Math.sin(game.camPitch) * dist * 0.4;
  camera.position.set(
    focus.x + Math.sin(game.camYaw) * dist + shake.x,
    cy + shake.y,
    focus.z + Math.cos(game.camYaw) * dist,
  );
  camera.lookAt(focus.x, focus.y + 0.4, focus.z);
}

// ---------- loop ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now() / 1000;
  game.frames += 1;

  if (game.mode === 'playing') {
    const input = readInput();
    brawl.update(dt);
    if (game.inCar && game.currentCar) {
      traffic.driveCar(game.currentCar, dt, input);
    } else {
      rico.update(dt, input, game.camYaw);
    }
    traffic.updateTraffic(dt);
    sidewalk.update(dt, focusPos(), game.inCar ? Math.abs(game.currentCar.speed) : rico.speed, now);
    pd.update(dt, focusPos(), game.inCar ? Math.abs(game.currentCar.speed) : rico.speed, onDamage, now, game.inCar);
    bursts.update(dt);
    jobs.spin(dt);
    // Mission completion.
    const done = jobs.update(dt, focusPos());
    if (done) {
      game.money += done.pay;
      tunes.pickup();
      const mp = jobs.markerPos() || focusPos();
      bursts.burst(mp.x, 2, mp.z, 0xffd23f, 16);
      panel.message('MISSION COMPLETE', `+$${done.pay} — ${done.story}`, 3600);
      if (jobs.done) panel.message('DEBT PAID', 'Neon Bay is yours — free roam.', 5000);
      updateMissionHud();
      saveKeep({ money: game.money, missionIndex: jobs.index });
    }
    // HUD, every frame.
    panel.setStars(pd.wanted);
    panel.setHealth(game.health);
    panel.setMoney(game.money);
    const spd = game.inCar && game.currentCar ? Math.abs(game.currentCar.speed) * 2.2 : rico.speed * 2.2;
    panel.setSpeed(spd);
    const marker = jobs.markerPos();
    if (marker && !jobs.done) {
      const dx = marker.x - focusPos().x;
      const dz = marker.z - focusPos().z;
      const markerHeading = Math.atan2(dx, dz);
      let rel = markerHeading - (game.camYaw + Math.PI);
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      panel.setCompass(rel, Math.hypot(dx, dz));
    } else {
      panel.setCompass(null, 0);
    }
    panel.drawMinimap({
      player: { x: focusPos().x, z: focusPos().z, yaw: game.inCar && game.currentCar ? game.currentCar.yaw : rico.heading },
      cars: traffic.cars.filter((c) => c.kind !== 'police').map((c) => ({ x: c.pos.x, z: c.pos.z })),
      police: pd.units.map((u) => ({ x: u.pos.x, z: u.pos.z })),
      mission: marker,
      missionDone: jobs.done,
    });
    panel.setPolice(pd.roster(focusPos()));
    tunes.engine(game.inCar ? Math.abs(game.currentCar.speed) / 26 : 0);
    tunes.siren(pd.wanted > 0);
  } else {
    traffic.updateTraffic(dt);
    sidewalk.update(dt, rico.pos, 0, now);
    bursts.update(dt);
    jobs.spin(dt);
  }

  updateCamera(dt);
  renderer.render(scene, camera);

  if (!window.__ready) {
    window.__ready = true;
    panel.hideLoading();
  }
  if (game.shotNumber !== null && director.isReady()) window.__shotReady = true;
}

// ---------- debug ----------
window.__game = {
  get debug() {
    const fp = focusPos();
    return {
      mode: game.mode,
      money: game.money,
      health: game.health,
      wanted: pd.wanted,
      missionIndex: jobs.index,
      missionsDone: jobs.done,
      inCar: game.inCar,
      playerPos: { x: rico.pos.x, z: rico.pos.z },
      speed: game.inCar && game.currentCar ? game.currentCar.speed : rico.speed,
      shot: game.shotNumber,
      frames: game.frames,
      camYaw: game.camYaw,
      cameraMode: game.cameraMode,
      carYaw: game.currentCar ? game.currentCar.yaw : null,
      carPos: game.currentCar ? { x: game.currentCar.pos.x, z: game.currentCar.pos.z } : null,
      policeCount: pd.units.length,
      policePos: pd.units.map((u) => ({ x: Math.round(u.pos.x), z: Math.round(u.pos.z) })),
      parked: traffic.parked.map((c) => ({ x: Math.round(c.pos.x), z: Math.round(c.pos.z) })),
      peds: sidewalk.list.map((p) => ({ x: Math.round(p.pos.x), z: Math.round(p.pos.z), down: p.downUntil > performance.now() / 1000 })),
    };
  },
};
window.__game.focusPos = focusPos;

// ---------- boot ----------
const saved = loadKeep();
if (saved && saved.money > 0) panel.setContinue(saved.money);
panel.showStart();
panel.setStars(0);
panel.setHealth(100);
panel.setMoney(0);
panel.setMission('<b>Job 1 — The Pickup</b><br>Pick up the package at the corner of 2nd &amp; Palm. $200.');
panel.setStage(1, 4, 'Job 2 — The Drop');
panel.setDialogue('VINNIE “THE LEDGER” MARLOW', 'Rico grabs the package. One down — the Ledger is watching.');
panel.hideLoading();

const params = new URLSearchParams(window.location.search);
const shotParam = Number(params.get('shot'));
if (shotParam >= 1 && shotParam <= 4) {
  window.__shot = shotParam;
  director.stage(shotParam);
}

animate();
