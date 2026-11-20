// main.js — Neon Bay: bootstrap, game loop, camera, input, and the wiring that
// ties the city, the player, the cars, the police, the missions and the HUD
// together. The debug hooks are wired first, before any shot is staged.
import * as THREE from 'three';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame, clearSave } from './save.js';
import { createShots } from './shots.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- debug hooks, wired before anything else runs (and before shots stage) ----
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.__ready = false;
window.__shotReady = false;
window.__shot = null;

const city = buildCity(scene);
const player = createPlayer(scene, city);
const vehicles = createVehicles(scene, city);
const pedestrians = createPedestrians(scene, city);
const police = createPolice(scene, city, vehicles);
const missions = createMissions(scene);
const combat = createCombat();
const effects = createEffects(scene);
const hud = createHud();
const audio = createAudio();
const clock = new THREE.Clock();

const game = {
  scene, camera, renderer, city, player, vehicles, pedestrians, police, missions,
  combat, effects, hud, audio,
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
  focusPos() {
    return game.inCar && game.currentCar ? game.currentCar.pos : player.pos;
  },
};

game.shots = createShots(game);

// Debug handle for tests and screenshots: state, staged shot, live values.
window.__game = {
  debug: {
    get mode() { return game.mode; },
    get money() { return game.money; },
    get health() { return game.health; },
    get wanted() { return police.wanted; },
    get missionIndex() { return missions.index; },
    get missionsDone() { return missions.done; },
    get inCar() { return game.inCar; },
    get playerPos() { return { x: player.pos.x, z: player.pos.z }; },
    get speed() { return game.inCar && game.currentCar ? game.currentCar.speed : player.speed; },
    get shot() { return game.shotNumber; },
    get frames() { return game.frames; },
    get camYaw() { return game.camYaw; },
    get cameraMode() { return game.cameraMode; },
    get carYaw() { return game.inCar && game.currentCar ? game.currentCar.yaw : null; },
    get carPos() { return game.inCar && game.currentCar ? { x: game.currentCar.pos.x, z: game.currentCar.pos.z } : null; },
    get policeCount() { return police.police.length; },
    get policePos() { return police.police.map((c) => ({ x: Math.round(c.pos.x), z: Math.round(c.pos.z) })); },
  },
};

// ---- input ----
const keys = {};
let dragging = false;
let lastPointer = { x: 0, y: 0 };
let downAt = null;

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.mode === 'playing') pauseGame();
    else if (game.mode === 'paused') resumeGame();
  }
  if (e.code === 'KeyM') audio.setMuted(!audio.muted);
  if (e.code === 'KeyE' && game.mode === 'playing') toggleCar();
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastPointer = { x: e.clientX, y: e.clientY };
  downAt = { x: e.clientX, y: e.clientY };
  audio.init();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  game.camYaw -= (e.clientX - lastPointer.x) * 0.005;
  game.camPitch = Math.max(0.08, Math.min(1.1, game.camPitch + (e.clientY - lastPointer.y) * 0.003));
  lastPointer = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', (e) => {
  dragging = false;
  // A click (barely moved) is a punch; a drag is just looking around, and
  // must not punch — dragging to look used to swing at pedestrians and raise
  // the wanted level by accident.
  if (downAt && game.mode === 'playing' && !game.inCar) {
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    if (moved < 8) doPunch();
  }
  downAt = null;
});

function readInput() {
  return {
    f: !!keys.KeyW || !!keys.ArrowUp,
    b: !!keys.KeyS || !!keys.ArrowDown,
    l: !!keys.KeyA || !!keys.ArrowLeft,
    r: !!keys.KeyD || !!keys.ArrowRight,
    run: !!keys.ShiftLeft || !!keys.ShiftRight,
    brake: !!keys.Space,
  };
}

// ---- car enter / exit ----
game.enterCar = function (car) {
  if (!car || car.isPolice) return false;
  if (game.inCar) return false;
  game.inCar = true;
  game.currentCar = car;
  car.kind = 'driven';
  player.group.visible = false;
  police.addWanted(1);
  hud.message('CAR STOLEN', 'The heat is on — lose the cops or outrun them.', 2600);
  audio.crash();
  return true;
};

game.exitCar = function (silent) {
  if (!game.inCar || !game.currentCar) return;
  const car = game.currentCar;
  player.reset(car.pos.x + Math.sin(car.yaw + Math.PI / 2) * 3, car.pos.z + Math.cos(car.yaw + Math.PI / 2) * 3, car.yaw);
  car.speed = 0;
  game.inCar = false;
  game.currentCar = null;
  player.group.visible = true;
  if (!silent) audio.click();
};

function toggleCar() {
  if (game.inCar) {
    game.exitCar(false);
    return;
  }
  const car = vehicles.nearestCar(player.pos, 4.5);
  if (car) game.enterCar(car);
}

// ---- combat ----
function doPunch() {
  if (game.inCar) return;
  player.punch();
  combat.punch(player.pos, player.yaw, [
    ...pedestrians.list.map((p) => ({ pos: p.pos, radius: 0.5, kind: 'ped', ref: p })),
    ...police.police.map((c) => ({ pos: c.pos, radius: 2.0, kind: 'police', ref: c })),
  ]).forEach((t) => {
    if (t.kind === 'ped') {
      pedestrians.knockDown(t.ref, player.pos);
      effects.burst(t.pos.x, 1.2, t.pos.z, 0xffe45e, 10);
      if (police.police.some((c) => Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 40)) {
        police.addWanted(1);
      }
    } else {
      effects.burst(t.pos.x, 1.2, t.pos.z, 0xff9040, 14);
      effects.shake(0.35);
      police.addWanted(1);
    }
  });
  audio.punch();
}

// ---- damage / game over ----
function onDamage(amount, push) {
  if (game.mode !== 'playing') return;
  game.health -= amount;
  effects.shake(0.5);
  audio.crash();
  if (game.inCar && game.currentCar && push) {
    game.currentCar.pos.x += push.x;
    game.currentCar.pos.z += push.z;
  } else if (push) {
    player.pos.x += push.x;
    player.pos.z += push.z;
  }
  if (game.health <= 0) {
    game.health = 0;
    game.mode = 'gameover';
    audio.busted();
    hud.showGameOver('The Bay City PD finally caught up with Rico. The debt is still due — $' + game.money + ' earned.');
    saveGame({ money: game.money, missionIndex: missions.index });
  }
}

// ---- flow ----
function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  game.money = save ? save.money : 0;
  game.health = 100;
  missions.reset(save ? save.missionIndex : 0);
  police.setWanted(0);
  player.reset(0, 20, Math.PI);
  player.group.visible = true;
  game.inCar = false;
  game.currentCar = null;
  game.mode = 'playing';
  game.cameraMode = 'follow';
  hud.hideStart();
  hud.hideGameOver();
  hud.hideLoading();
  audio.init();
  audio.click();
  updateMissionHud();
  hud.message('NEON BAY', 'Pay off the $1,200 debt — four jobs.', 3200);
}

function pauseGame() {
  game.mode = 'paused';
  hud.showPause();
  saveGame({ money: game.money, missionIndex: missions.index });
}

function resumeGame() {
  game.mode = 'playing';
  hud.hidePause();
  audio.click();
}

// Mission block + stage + dialogue, refreshed whenever the mission changes.
function updateMissionHud() {
  if (missions.done) {
    hud.setMission('<b>DEBT PAID</b><br>Neon Bay is yours — free roam.');
    hud.setStage(missions.total(), missions.total(), missions.nextTitle());
    hud.setDialogue('VINNIE \u201cTHE LEDGER\u201d MARLOW', missions.current().story);
  } else {
    const def = missions.current();
    hud.setMission('<b>' + def.title + '</b><br>' + def.text);
    hud.setStage(missions.index + 1, missions.total(), missions.nextTitle());
    const speaker = missions.index === 2 ? 'RICO' : 'VINNIE \u201cTHE LEDGER\u201d MARLOW';
    hud.setDialogue(speaker, def.story);
  }
}
game.updateMissionHud = updateMissionHud;

document.getElementById('startBtn').addEventListener('click', () => startGame(false));
document.getElementById('continueBtn').addEventListener('click', () => startGame(true));
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('restartBtn').addEventListener('click', () => { clearSave(); startGame(false); });

// ---- camera ----
function updateCamera(dt) {
  const shake = effects.shakeOffset();
  if (game.cameraMode === 'shot' && game.shotCam) {
    // Snap: position is set directly from the staged offset every frame.
    const focus = game.focusPos();
    camera.position.set(
      focus.x + game.shotCam.offset.x + shake.x,
      focus.y + game.shotCam.offset.y + shake.y,
      focus.z + game.shotCam.offset.z,
    );
    camera.lookAt(
      focus.x + game.shotCam.lookOffset.x,
      focus.y + game.shotCam.lookOffset.y,
      focus.z + game.shotCam.lookOffset.z,
    );
    return;
  }

  const focus = game.focusPos();
  if (game.cameraMode === 'menu') {
    const t = performance.now() / 1000 * 0.05;
    camera.position.set(Math.sin(t) * 120, 70, Math.cos(t) * 120);
    camera.lookAt(0, 0, 0);
    return;
  }

  // Follow: ease the orbit yaw toward behind the player/car, mouse drag overrides.
  const targetYaw = (game.inCar && game.currentCar ? game.currentCar.yaw : player.yaw) + Math.PI;
  let dy = targetYaw - game.camYaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  game.camYaw += dy * Math.min(1, dt * 2.2);

  const dist = game.inCar ? 12 : 9;
  const height = game.inCar ? 5.2 : 4.2;
  const cx = focus.x + Math.sin(game.camYaw) * dist;
  const cz = focus.z + Math.cos(game.camYaw) * dist;
  const cy = height + Math.sin(game.camPitch) * dist * 0.4;
  camera.position.set(cx + shake.x, cy + shake.y, cz);
  camera.lookAt(focus.x, focus.y + 1.6, focus.z);
}

// ---- main loop ----
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.frames += 1;

  if (game.mode === 'playing') {
    const input = readInput();
    combat.update(dt);

    if (game.inCar && game.currentCar) {
      vehicles.driveCar(game.currentCar, dt, input);
    } else {
      player.update(dt, input, game.camYaw);
    }
    vehicles.updateTraffic(dt);
    pedestrians.update(dt, player.pos, game.inCar && game.currentCar ? Math.abs(game.currentCar.speed) : player.speed);
    police.update(dt, game.focusPos(), game.inCar && game.currentCar ? Math.abs(game.currentCar.speed) : player.speed, onDamage, game.inCar && !!game.currentCar);
    effects.update(dt);

    // Missions.
    const done = missions.update(dt, game.focusPos());
    if (done) {
      game.money += done.pay;
      audio.pickup();
      effects.burst(game.focusPos().x, 2, game.focusPos().z, 0xffd23f, 24);
      hud.message('MISSION COMPLETE', '+$' + done.pay + ' — ' + done.story, 3600);
      if (missions.done) {
        hud.message('DEBT PAID', 'Neon Bay is Rico\u2019s again — free roam.', 5000);
      }
      updateMissionHud();
      saveGame({ money: game.money, missionIndex: missions.index });
    }

    // HUD.
    hud.setStars(police.wanted);
    hud.setHealth(game.health);
    hud.setMoney(game.money);
    hud.setPolice(police.units());
    const mph = (game.inCar && game.currentCar ? Math.abs(game.currentCar.speed) : player.speed) * 2.2;
    hud.setSpeed(mph);
    // Compass: point the arrow at the mission marker, relative to the camera.
    if (!missions.done) {
      const mp = missions.markerPos();
      const fp = game.focusPos();
      const dx = mp.x - fp.x;
      const dz = mp.z - fp.z;
      const headingToMarker = Math.atan2(dx, dz);
      const cameraForward = game.camYaw + Math.PI;
      let rel = headingToMarker - cameraForward;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      hud.setCompass(-rel, Math.hypot(dx, dz));
    } else {
      hud.setCompass(null, 0);
    }
    hud.drawMinimap({
      player: { x: player.pos.x, z: player.pos.z, yaw: player.yaw },
      cars: vehicles.cars.filter((c) => !c.isPolice),
      police: police.police,
      mission: missions.done ? null : missions.markerPos(),
      missionDone: missions.done,
    });
    audio.engine(game.inCar && game.currentCar ? Math.abs(game.currentCar.speed) / 26 : 0);
    audio.siren(police.wanted > 0);
  } else {
    vehicles.updateTraffic(dt);
    pedestrians.update(dt, player.pos, 0);
    effects.update(dt);
  }

  updateCamera(dt);
  renderer.render(scene, camera);

  if (!window.__ready) {
    window.__ready = true;
    hud.hideLoading();
  }
  if (game.shots.isReady()) window.__shotReady = true;
}

// ---- boot ----
(function boot() {
  const save = loadSave();
  if (save && save.money > 0) hud.setContinue(save.money);
  hud.showStart();
  hud.setStars(0);
  hud.setHealth(100);
  hud.setMoney(0);
  updateMissionHud();
  hud.hideLoading();

  // A staged screenshot starts the game at once, after the hooks above.
  const params = new URLSearchParams(window.location.search);
  const shot = parseInt(params.get('shot') || '', 10);
  if (shot >= 1 && shot <= 4) {
    game.shots.stage(shot);
  }
  animate();
})();
