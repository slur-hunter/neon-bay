// Neon Bay — bootstrap, input, camera, car stealing, damage, missions and
// the game loop. The debug hooks are wired FIRST, before any shot staging.

import * as THREE from 'three';
import { buildCity } from './city.js';
import { createHero } from './hero.js';
import { createAutos } from './autos.js';
import { createCrowd } from './crowd.js';
import { createPatrol } from './patrol.js';
import { createErrands } from './errands.js';
import { createFists } from './fists.js';
import { createSparks } from './sparks.js';
import { createSound } from './sound.js';
import { loadSave, saveGame, clearSave } from './pocket.js';
import { createDisplay } from './display.js';
import { createStage } from './stage.js';

// Debug hooks, wired before anything else runs.
window.__errors = [];
window.__ready = false;
window.__shotReady = false;
window.__shot = null;
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message ?? event.error ?? 'error'));
});

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('gl').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
const scene = new THREE.Scene();
const clock = new THREE.Clock();

const city = buildCity(scene);
const hero = createHero(scene);
const autos = createAutos(scene, city);
const crowd = createCrowd(scene);
const patrol = createPatrol(scene, city, autos);
const errands = createErrands(scene);
const fists = createFists();
const sparks = createSparks(scene);
const sound = createSound();
const display = createDisplay();

const game = {
  scene,
  camera,
  renderer,
  city,
  hero,
  autos,
  crowd,
  patrol,
  errands,
  fists,
  sparks,
  sound,
  display,
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

game.focusPos = function focusPos() {
  return game.inCar && game.currentCar ? game.currentCar.pos : hero.pos;
};

game.shots = createStage(game);

window.__game = {
  debug: {
    get mode() { return game.mode; },
    get money() { return game.money; },
    get health() { return game.health; },
    get wanted() { return patrol.wanted; },
    get missionIndex() { return errands.index; },
    get missionsDone() { return errands.done; },
    get inCar() { return game.inCar; },
    get playerPos() { return { x: hero.pos.x, z: hero.pos.z }; },
    get speed() {
      return game.inCar && game.currentCar ? game.currentCar.speed : hero.speed;
    },
    get shot() { return game.shotNumber; },
    get frames() { return game.frames; },
    get camYaw() { return game.camYaw; },
    get cameraMode() { return game.cameraMode; },
    get carYaw() { return game.currentCar ? game.currentCar.yaw : null; },
    get carPos() {
      return game.currentCar ? { x: game.currentCar.pos.x, z: game.currentCar.pos.z } : null;
    },
    get policeCount() { return patrol.police.length; },
    get policePos() {
      return patrol.police.map((u) => ({ x: u.pos.x, z: u.pos.z }));
    },
  },
};

// ---- input ----
const keys = {};
let dragStart = null;
let dragMoved = 0;

function readInput() {
  return {
    f: keys.KeyW || keys.ArrowUp || false,
    b: keys.KeyS || keys.ArrowDown || false,
    l: keys.KeyA || keys.ArrowLeft || false,
    r: keys.KeyD || keys.ArrowRight || false,
    run: keys.ShiftLeft || keys.ShiftRight || false,
    brake: keys.Space || false,
  };
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') event.preventDefault();
  keys[event.code] = true;
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (game.mode === 'playing') pauseGame();
    else if (game.mode === 'paused') resumeGame();
  }
  if (event.code === 'KeyM') {
    game.muted = !game.muted;
    sound.setMuted(game.muted);
  }
  if (event.code === 'KeyE' && game.mode === 'playing') toggleCar();
});
window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  sound.init();
  dragStart = { x: event.clientX, y: event.clientY };
  dragMoved = 0;
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragStart) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  dragMoved = Math.max(dragMoved, Math.hypot(dx, dy));
  game.camYaw -= dx * 0.005;
  game.camPitch = Math.max(0.08, Math.min(1.1, game.camPitch + dy * 0.003));
  dragStart = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener('pointerup', () => {
  // A click punches; a drag only looks around.
  if (dragStart && dragMoved < 8 && game.mode === 'playing' && !game.inCar) doPunch();
  dragStart = null;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- cars ----
function enterCar(car) {
  if (!car || game.inCar || car.isPolice) return;
  game.inCar = true;
  game.currentCar = car;
  car.kind = 'driven';
  hero.group.visible = false;
  patrol.addWanted(1);
  display.message('CAR STOLEN', 'The heat is on — lose the cops or outrun them.', 2600);
  sound.crash();
}

function exitCar(silent) {
  if (!game.inCar || !game.currentCar) return;
  const car = game.currentCar;
  hero.reset(
    car.pos.x + Math.sin(car.yaw + Math.PI / 2) * 3,
    car.pos.z + Math.cos(car.yaw + Math.PI / 2) * 3,
    car.yaw,
  );
  car.speed = 0;
  game.inCar = false;
  game.currentCar = null;
  hero.group.visible = true;
  if (!silent) sound.click();
}

function toggleCar() {
  if (game.inCar) {
    exitCar(false);
    return;
  }
  const car = autos.nearestCar(hero.pos, 4.5);
  if (car) enterCar(car);
}

// ---- combat / damage ----
function doPunch() {
  hero.punch();
  const targets = [];
  for (const ped of crowd.list) {
    if (ped.down <= 0) targets.push({ pos: ped.pos, radius: 0.5, ped });
  }
  for (const unit of patrol.police) {
    targets.push({ pos: unit.pos, radius: 2.0, unit });
  }
  const hit = fists.punch(hero.pos, hero.yaw, targets);
  for (const target of hit) {
    if (target.ped) {
      crowd.knockDown(target.ped, hero.pos);
      sparks.burst(target.ped.pos.x, 1.2, target.ped.pos.z, 0xffd23f, 8);
      const nearCop = patrol.police.some(
        (u) => Math.hypot(u.pos.x - hero.pos.x, u.pos.z - hero.pos.z) < 40,
      );
      if (nearCop) patrol.addWanted(1);
    } else if (target.unit) {
      sparks.burst(target.unit.pos.x, 1.2, target.unit.pos.z, 0xff8c1a, 10);
      sparks.shake(0.35);
      patrol.addWanted(1);
    }
  }
  sound.punch();
}

function onDamage(amount, push) {
  if (game.mode !== 'playing') return;
  game.health -= amount;
  sparks.shake(0.5);
  sound.crash();
  if (game.inCar && game.currentCar) {
    game.currentCar.pos.x += push.x;
    game.currentCar.pos.z += push.z;
  } else {
    hero.pos.x += push.x;
    hero.pos.z += push.z;
  }
  if (game.health <= 0) {
    game.health = 0;
    game.mode = 'gameover';
    sound.busted();
    display.showGameOver(
      `The Bay City PD finally caught up with Rico. The debt is still due — $${game.money} earned.`,
    );
    saveGame({ money: game.money, missionIndex: errands.index });
  }
}

// ---- missions / HUD ----
function updateMissionHud() {
  if (errands.done) {
    display.setMission('DEBT PAID', 'Neon Bay is yours — free roam.');
    display.setStage(4, 4, 'DEBT PAID');
    const last = errands.defs[errands.defs.length - 1];
    display.setDialogue(last.speaker, last.story);
    return;
  }
  const job = errands.current();
  display.setMission(job.title, job.text);
  display.setStage(errands.index + 1, errands.total(), errands.nextTitle());
  display.setDialogue(job.speaker, job.story);
}

game.updateMissionHud = updateMissionHud;
game.hideOverlays = function hideOverlays() {
  display.hideStart();
  display.hidePause();
  display.hideGameOver();
  display.hideLoading();
};
game.exitCar = exitCar;
game.enterCar = enterCar;

// ---- flow ----
function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  game.money = save ? save.money : 0;
  game.health = 100;
  errands.reset(save ? save.missionIndex : 0);
  patrol.setWanted(0);
  hero.reset(28, 0, Math.PI);
  game.inCar = false;
  game.currentCar = null;
  hero.group.visible = true;
  game.mode = 'playing';
  game.cameraMode = 'follow';
  display.hideStart();
  display.hidePause();
  display.hideGameOver();
  sound.init();
  sound.click();
  updateMissionHud();
  display.message('NEON BAY', 'Pay off the $1,200 debt — four jobs.', 3200);
}

function pauseGame() {
  game.mode = 'paused';
  display.showPause();
  saveGame({ money: game.money, missionIndex: errands.index });
}

function resumeGame() {
  game.mode = 'playing';
  display.hidePause();
  sound.click();
}

document.getElementById('startBtn').addEventListener('click', () => startGame(false));
document.getElementById('continueBtn').addEventListener('click', () => startGame(true));
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('restartBtn').addEventListener('click', () => {
  clearSave();
  startGame(false);
});

// ---- camera ----
function updateCamera(dt) {
  const shake = sparks.shakeOffset();
  const focus = game.focusPos();
  if (game.cameraMode === 'shot' && game.shotCam) {
    camera.position.set(
      focus.x + game.shotCam.offset.x + shake.x,
      game.shotCam.offset.y + shake.y,
      focus.z + game.shotCam.offset.z,
    );
    camera.lookAt(
      focus.x + game.shotCam.lookOffset.x,
      game.shotCam.lookOffset.y,
      focus.z + game.shotCam.lookOffset.z,
    );
    return;
  }
  if (game.cameraMode === 'menu') {
    const t = performance.now() / 1000 * 0.05;
    camera.position.set(Math.sin(t) * 120 + shake.x, 70 + shake.y, Math.cos(t) * 120);
    camera.lookAt(0, 0, 0);
    return;
  }
  // Follow: ease the orbit behind the player or car while moving.
  const yaw = game.inCar && game.currentCar ? game.currentCar.yaw : hero.yaw;
  const moving = game.inCar
    ? Math.abs(game.currentCar.speed) > 1
    : hero.moving;
  if (moving) {
    const target = yaw + Math.PI;
    let dy = target - game.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    game.camYaw += dy * Math.min(1, dt * 2.2);
  }
  const dist = game.inCar ? 12 : 9;
  const height = game.inCar ? 5.2 : 4.2;
  const cy = height + Math.sin(game.camPitch) * dist * 0.4;
  camera.position.set(
    focus.x + Math.sin(game.camYaw) * dist + shake.x,
    cy + shake.y,
    focus.z + Math.cos(game.camYaw) * dist,
  );
  camera.lookAt(focus.x, focus.y + 1.6, focus.z);
}

// ---- loop ----
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.frames += 1;
  game.shots.tick();
  const input = readInput();
  const focus = game.focusPos();

  if (game.mode === 'playing') {
    fists.update(dt);
    if (game.inCar && game.currentCar) {
      autos.driveCar(game.currentCar, dt, input);
    } else {
      hero.update(dt, input, game.camYaw, city);
    }
    autos.updateTraffic(dt);
    crowd.update(dt, focus, game.inCar && game.currentCar ? game.currentCar.speed : hero.speed);
    patrol.update(dt, focus, game.inCar, onDamage);
    sparks.update(dt);

    const done = errands.update(dt, focus);
    if (done) {
      game.money += done.pay;
      sound.pickup();
      sparks.burst(done.pos[0], 2, done.pos[1], 0xffd23f, 14);
      display.message('MISSION COMPLETE', `+$${done.pay} — ${done.story}`, 3600);
      if (errands.done) {
        display.message('DEBT PAID', 'Neon Bay is yours — free roam.', 5000);
      }
      updateMissionHud();
      saveGame({ money: game.money, missionIndex: errands.index });
    }

    // HUD, every frame.
    display.setStars(patrol.wanted);
    display.setHealth(game.health);
    display.setMoney(game.money);
    const speedMph = (game.inCar && game.currentCar ? game.currentCar.speed : hero.speed) * 2.2;
    display.setSpeed(speedMph);
    const marker = errands.markerPos();
    if (marker && !errands.done) {
      const bearing = Math.atan2(marker.x - focus.x, marker.z - focus.z);
      const arrowAngle = game.camYaw + Math.PI - bearing;
      display.setCompass(arrowAngle, Math.hypot(marker.x - focus.x, marker.z - focus.z));
    } else {
      display.setCompass(null, 0);
    }
    display.drawMinimap({
      half: city.bounds,
      blocks: [ -112, -56, 0, 56, 112 ],
      streets: [ -140, -84, -28, 28, 84, 140 ],
      player: { x: focus.x, z: focus.z, yaw: game.inCar && game.currentCar ? game.currentCar.yaw : hero.yaw },
      cars: autos.traffic.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      police: patrol.police.map((u) => ({ x: u.pos.x, z: u.pos.z })),
      mission: marker,
      missionDone: errands.done,
    });
    display.setPolice(patrol.units(focus));
    sound.engine(Math.min(1, Math.abs(speedMph) / 60));
    sound.siren(patrol.wanted > 0);
  } else {
    autos.updateTraffic(dt);
    crowd.update(dt, hero.pos, 0);
    sparks.update(dt);
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  if (!window.__ready) {
    window.__ready = true;
    display.hideLoading();
  }
  if (game.shots.isReady()) window.__shotReady = true;
}

// ---- boot ----
const saved = loadSave();
if (saved && saved.money > 0) display.setContinue(saved.money);
display.showStart();
display.setStars(0);
display.setHealth(100);
display.setMoney(0);
display.setMission('Job 1 — The Pickup', 'Pick up the package at the corner of 2nd & Palm. $200.');
display.setStage(1, 4, 'Job 2 — The Drop');
display.setDialogue('VINNIE “THE LEDGER” MARLOW', 'Rico grabs the package. One down — the Ledger is watching.');

const params = new URLSearchParams(window.location.search);
const shotParam = Number(params.get('shot'));
if (shotParam >= 1 && shotParam <= 4) {
  game.shots.stage(shotParam);
}
animate();
