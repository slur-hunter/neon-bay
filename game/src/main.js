// Neon Bay — main.js: boots the game, runs the loop, and wires every system together.
// One clear job: own the frame, the input and the game state; the systems do the rest.
import * as THREE from 'three';
import { createCity, LANDMARKS } from './city.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { loadSave, hasSave, writeSave } from './save.js';
import { setupShot } from './shots.js';

// Debug hooks the maker and the tests read: fps, errors, readiness and the game.
window.__errors = [];
window.__fps = 0;
window.__ready = false;
window.__shotReady = false;
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(-60, 55, 120);

// The shared game state every system reads and writes.
const G = {
  scene, camera, renderer,
  time: 0,
  dayTime: 15.5, // bright late afternoon, 15:30
  day: 1,
  money: 200,
  health: 100,
  state: 'title', // title | playing | busted | wasted
  drivenCar: null,
  cam: { yaw: Math.PI, pitch: 0.32, dist: 10 },
  shot: null,
  shotMode: 'orbit',
};
window.__game = G;

G.city = createCity(scene);
G.fx = createEffects(scene);
G.audio = createAudio();
G.hud = createHud();
G.player = createPlayer(scene, G.city);
G.vehicles = createVehicles(scene, G.city);
G.pedestrians = createPedestrians(scene, G.city);
G.police = createPolice(scene, G.city);
G.combat = createCombat(scene, G.city, G);
G.missions = createMissions(scene, G);
G.save = { save: () => writeSave(G) };

// Keyboard and mouse input, gathered here and read by the systems.
const keys = new Set();
const input = { forward: false, back: false, left: false, right: false, sprint: false };
function refreshInput() {
  input.forward = keys.has('KeyW') || keys.has('ArrowUp');
  input.back = keys.has('KeyS') || keys.has('ArrowDown');
  input.left = keys.has('KeyA') || keys.has('ArrowLeft');
  input.right = keys.has('KeyD') || keys.has('ArrowRight');
  input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  refreshInput();
  if (G.state !== 'playing') return;
  if (e.code === 'KeyE') toggleCar();
  if (e.code === 'KeyF') G.combat.punch();
  if (e.code === 'KeyR') G.combat.reload();
  if (e.code === 'KeyM') G.audio.setMuted(!G.audio.isMuted);
});
window.addEventListener('keyup', (e) => { keys.delete(e.code); refreshInput(); });

let dragging = false;
let lastX = 0, lastY = 0;
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  if (G.state === 'playing' && G.combat.hasPistol && !G.player.inCar) G.combat.shoot();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  G.cam.yaw -= (e.clientX - lastX) * 0.005;
  G.cam.pitch += (e.clientY - lastY) * 0.004;
  G.cam.pitch = Math.max(0.05, Math.min(1.1, G.cam.pitch));
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('wheel', (e) => {
  G.cam.dist = Math.max(6, Math.min(16, G.cam.dist + Math.sign(e.deltaY) * 1.5));
}, { passive: true });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/** Steals the nearest car, or steps out of the one being driven. */
function toggleCar() {
  if (G.player.inCar) {
    const car = G.drivenCar;
    car.kind = 'parked';
    car.speed = 0;
    G.drivenCar = null;
    G.player.setInCar(false);
    G.player.placeAt(car.pos.x + 2.5, car.pos.z + 1.5, car.heading);
    G.audio.engine(0);
    return;
  }
  const car = G.vehicles.nearestStealable(G.player.pos);
  if (!car) {
    G.hud.toast('No car in reach. Walk up to a parked car and press E.');
    return;
  }
  car.kind = 'player';
  G.drivenCar = car;
  G.player.setInCar(true);
  G.player.pos.copy(car.pos);
  G.police.addWanted(1, G.time);
  G.hud.toast('You stole the car! The police are on their way.');
  if (G.audio) G.audio.thud();
}

/** The busted and wasted overlays share one screen. */
function showEnd(title, text) {
  G.state = title === 'BUSTED' ? 'busted' : 'wasted';
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  document.getElementById('end-screen').classList.remove('hidden');
  G.audio.engine(0);
  G.audio.setSiren(false);
}

function startGame(restore) {
  G.audio.unlock();
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('end-screen').classList.add('hidden');
  G.hud.show();
  G.state = 'playing';
  if (restore) {
    const s = loadSave();
    if (s) {
      G.money = s.money ?? 200;
      G.health = s.health ?? 100;
      G.dayTime = s.dayTime ?? 15.5;
      G.player.placeAt(s.playerX ?? 8, s.playerZ ?? 24, Math.PI);
      G.missions.restore(s.jobIndex ?? 0);
      if (s.hasPistol) { /* the pistol is re-found at the docks on a fresh life */ }
      G.hud.toast('Welcome back. Mara has work for you.');
      return;
    }
  }
  G.missions.start();
}

document.getElementById('start-btn').addEventListener('click', () => startGame(false));
document.getElementById('continue-btn').addEventListener('click', () => startGame(true));
document.getElementById('respawn-btn').addEventListener('click', () => {
  G.police.respawn(G);
  G.save.save();
  document.getElementById('end-screen').classList.add('hidden');
  G.state = 'playing';
  G.hud.toast('Back on the streets. Mara is still waiting.');
});
if (hasSave()) document.getElementById('continue-btn').style.display = '';

// Screenshot modes: ?shot=start|drive|chase|mission (see shots.js).
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
if (shotName) {
  G.shot = shotName;
  G.shotMode = setupShot(G, shotName);
}

// The frame loop: fixed clamp so headless slowness never breaks the logic.
const clock = new THREE.Clock();
const bootReal = performance.now();
let frames = 0;
let fpsTime = 0;
let saveTimer = 0;
let shotReadySet = false;

function tick() {
  requestAnimationFrame(tick);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  try {
    G.time += dt;
    G.dayTime += dt / 240; // one game hour every four real minutes
    frames += 1;
    fpsTime += rawDt;
    if (fpsTime >= 0.5) {
      window.__fps = Math.round(frames / fpsTime);
      frames = 0; fpsTime = 0;
    }
    G.city.update(dt);
    G.fx.update(dt);

    // In the driving shots the car keeps its foot down so the chase stays live.
    const driveInput = (G.shot === 'drive' || G.shot === 'chase')
      ? { ...input, forward: true }
      : input;

    if (G.state === 'playing') {
      if (G.player.inCar && G.drivenCar) {
        G.vehicles.drive(G.drivenCar, dt, driveInput, G.fx);
        G.player.pos.copy(G.drivenCar.pos);
        G.audio.engine(Math.abs(G.drivenCar.speed) / 46);
      } else {
        G.player.update(dt, input, G.cam);
        G.audio.engine(0);
      }
      G.vehicles.update(dt, G);
      G.pedestrians.update(dt);
      const busted = G.police.update(dt, G);
      G.missions.update(dt);
      const wasted = G.combat.update(dt);
      if (busted === 'busted') {
        G.police.respawn(G);
        G.save.save();
        showEnd('BUSTED', 'The Neon Bay police took $200 in bail.');
      } else if (wasted === 'wasted') {
        G.police.respawn(G);
        G.save.save();
        showEnd('WASTED', 'The hospital took $200. Mara is not impressed.');
      }
      saveTimer += dt;
      if (saveTimer > 30) { saveTimer = 0; G.save.save(); }
      G.hud.update(G);
    }

    // Camera: cinematic orbit on the title screen, chase in a car, orbit on foot.
    if (G.state === 'title' || G.shotMode === 'cinematic') {
      const a = G.time * 0.03;
      camera.position.set(Math.sin(a) * 150, 85, Math.cos(a) * 150);
      camera.lookAt(0, 10, 0);
    } else if (G.player.inCar && G.drivenCar) {
      G.vehicles.updateCamera(camera, G.drivenCar, dt);
    } else {
      G.player.updateCamera(camera, G.cam, dt);
    }

    // Crosshair only when the pistol is out and the player is on foot.
    G.hud.setCrosshair(G.state === 'playing' && G.combat.hasPistol && !G.player.inCar);

    renderer.render(scene, camera);
    if (!window.__ready) window.__ready = true;
    // A shot is ready once the scene has settled for a few real seconds.
    // (Real time, not game time: headless rendering runs at ~1 fps, so the
    // game clock crawls and a game-time wait would never arrive.)
    if (G.shot && !shotReadySet && performance.now() - bootReal > 4000) {
      shotReadySet = true;
      window.__shotReady = true;
    }
  } catch (err) {
    window.__errors.push(String(err && err.message ? err.message : err));
  }
}
tick();
