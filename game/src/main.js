// main.js bootstraps Neon Bay: renderer, input, camera, the game loop, the
// state machine (title, playing, paused, busted) and the ?shot= scene modes.
import * as THREE from 'three';
import { createCity } from './city.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1);
const shot = params.get('shot') || '';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 40, 120);

const city = createCity(scene, seed);
const player = createPlayer(scene, city);
const vehicles = createVehicles(scene, city, seed);
const pedestrians = createPedestrians(scene, city, seed);
const police = createPolice(scene, city, seed);
const missions = createMissions();
const combat = createCombat(scene, city, seed);
const effects = createEffects(scene);
const hud = createHud();
const audio = createAudio();

const G = {
  scene, camera, renderer,
  money: 0,
  health: 100,
  wanted: 0,
  day: 1,
  minutes: 18 * 60 + 20,
  time: 0,
  objective: '',
  marker: null,
  playerPos: new THREE.Vector3(0, 0, 20),
  playerHeading: Math.PI,
  inCar: null,
  hasWeapon: false,
  missionsDone: 0,
  missionIndex: 0,
  policeCars: police.policeCars,
  mode: 'title',
  frozen: false,
  drivingYaw: Math.PI,
};
window.__game = G;

const keys = {};
const camPos = new THREE.Vector3(0, 40, 120);
let fpsFrames = 0;
let fpsWallStart = performance.now();
window.__fps = 0;
let saveTimer = 0;
let orbitT = 0;

// mission beacon: a tall gold column over the current target
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.8, 0.8, 70, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
);
beacon.visible = false;
scene.add(beacon);
const beaconGem = new THREE.Mesh(
  new THREE.OctahedronGeometry(2.2),
  new THREE.MeshBasicMaterial({ color: 0xffd23e })
);
beaconGem.visible = false;
scene.add(beaconGem);

function refreshObjective() {
  const m = missions.current();
  if (!m) {
    G.objective = 'All jobs done. Free roam the Bay.';
    G.marker = null;
    beacon.visible = false;
    return;
  }
  G.objective = 'JOB: ' + m.title;
  G.marker = missions.targetFor();
  if (G.marker) {
    beacon.visible = true;
    beacon.position.set(G.marker.x, 35, G.marker.z);
    beaconGem.visible = true;
    beaconGem.position.set(G.marker.x, 12, G.marker.z);
  } else {
    beacon.visible = false;
    beaconGem.visible = false;
  }
}

function enterCar(car) {
  if (!car) return;
  if (car.kind === 'traffic') {
    police.addWanted(1, 'stolen car');
    hud.showMessage('Car stolen! The PD is on its way.', 3);
  } else if (car.kind === 'parked') {
    police.addWanted(1, 'stolen car');
    hud.showMessage('Car stolen! The PD is on its way.', 3);
  }
  if (car.kind !== 'player') {
    car.kind = 'player';
    const i = vehicles.parked.indexOf(car);
    if (i >= 0) vehicles.parked.splice(i, 1);
    const j = vehicles.traffic.indexOf(car);
    if (j >= 0) vehicles.traffic.splice(j, 1);
  }
  G.inCar = car;
  player.setVisible(false);
  audio.pickup();
}

function exitCar() {
  const car = G.inCar;
  if (!car) return;
  G.inCar = null;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  player.teleport(car.pos.x + side.x * 3, car.pos.z + side.z * 3, car.heading);
  player.setVisible(true);
}

function startGame(fromSave) {
  const data = fromSave ? loadGame() : null;
  if (data) {
    G.money = data.money;
    G.missionsDone = data.missionsDone;
    G.missionIndex = data.missionIndex;
    G.health = data.health;
    G.hasWeapon = data.hasWeapon;
    G.day = data.day;
    G.minutes = data.minutes;
    missions.setIndex(data.missionIndex, data.missionsDone);
    player.teleport(data.x, data.z, Math.PI);
  } else {
    missions.setIndex(0, 0);
    player.teleport(0, 20, Math.PI);
  }
  audio.unlock();
  G.mode = 'playing';
  hud.hideTitle();
  hud.showBusted(false);
  hud.showMessage(missions.startBriefing(), 5);
  refreshObjective();
}

function pauseGame(paused) {
  if (G.mode !== 'playing' && G.mode !== 'paused') return;
  G.mode = paused ? 'paused' : 'playing';
  hud.showPause(paused);
  if (paused) saveGame(G);
}

function busted(reason) {
  if (G.mode !== 'playing') return;
  G.mode = 'busted';
  audio.busted();
  audio.siren(false);
  police.clearWanted();
  G.money = Math.max(0, G.money - 200);
  hud.showBusted(true, reason + ' You lost $200.');
  setTimeout(() => {
    if (G.inCar) exitCar();
    G.health = 100;
    player.teleport(0, 40, Math.PI);
    G.mode = 'playing';
    hud.showBusted(false);
    hud.showMessage('Back on the streets. Mara has work if you want it.', 4);
    refreshObjective();
  }, 3200);
}

function handleMissionEvent(ev) {
  if (!ev) return;
  if (ev.type === 'complete') {
    audio.jingle();
    effects.pickupSparkle(G.playerPos);
    hud.showMessage(ev.text + ' Next: ' + (missions.current() ? missions.current().title : 'free roam'), 5);
    G.missionsDone = missions.done;
    G.missionIndex = missions.index;
    saveGame(G);
    refreshObjective();
  } else if (ev.type === 'stage') {
    hud.showMessage(ev.text, 4);
    if (ev.grab) {
      police.addWanted(2, 'bank alarm');
      combat.spawnGuards();
    }
    refreshObjective();
  }
}

function handleCombatEvent(ev) {
  if (ev.type === 'weapon') {
    audio.pickup();
    hud.showMessage(ev.text, 3);
  } else if (ev.type === 'punch') {
    audio.punch();
  } else if (ev.type === 'shot') {
    audio.gunshot();
    if (ev.hit) effects.muzzle(ev.at);
    police.addWanted(0, '');
  } else if (ev.type === 'kill') {
    hud.showMessage(ev.text, 3);
  } else if (ev.type === 'hurt') {
    hud.flashDamage();
    audio.punch();
  }
}

// input
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyE' && G.mode === 'playing') {
    if (G.inCar) exitCar();
    else {
      const car = vehicles.nearestCar(G.playerPos, 6, ['parked', 'traffic']);
      if (car) enterCar(car);
    }
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (G.mode === 'playing' || G.mode === 'paused') pauseGame(G.mode !== 'paused');
  }
  if (e.code === 'KeyM' && G.mode === 'playing') {
    const list = document.getElementById('missionList');
    const show = list.style.display !== 'block';
    if (show) {
      const rows = missions.all.map((m, i) => {
        const mark = i < missions.index ? '✓' : i === missions.index ? '▶' : '·';
        return '<div>' + mark + ' ' + m.title + ' — $' + m.reward + '</div>';
      }).join('');
      hud.setMissionList('<h3>MARA\'S JOBS</h3>' + rows);
    }
    hud.showMissions(show);
  }
  if (e.code === 'KeyF' && G.mode === 'playing' && !G.inCar) {
    combat.punch(G, handleCombatEvent);
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('mousedown', (e) => player.onMouseDown(e.clientX, e.clientY));
window.addEventListener('mouseup', () => player.onMouseUp());
window.addEventListener('mousemove', (e) => {
  if (player.state.dragging) player.onMouseMove(e.movementX || 0, e.movementY || 0);
});
window.addEventListener('wheel', (e) => player.onWheel(e.deltaY), { passive: true });
renderer.domElement.addEventListener('click', () => {
  if (G.mode === 'playing' && G.hasWeapon && !G.inCar) {
    combat.shoot(G, camera, handleCombatEvent);
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('startBtn').addEventListener('click', () => startGame(false));
document.getElementById('continueBtn').addEventListener('click', () => startGame(true));
document.getElementById('resumeBtn').addEventListener('click', () => pauseGame(false));
document.getElementById('quitBtn').addEventListener('click', () => {
  saveGame(G);
  G.mode = 'title';
  hud.showPause(false);
  hud.showTitle(hasSave());
});

// one fixed update step, used by the live loop and by ?shot= setups
function step(dt) {
  G.time += dt;
  G.minutes += dt * (1440 / 300);
  if (G.minutes >= 1440) {
    G.minutes -= 1440;
    G.day += 1;
  }
  city.update(dt, G.minutes);
  if (G.inCar) {
    const skidding = vehicles.drivePlayer(G.inCar, dt, keys);
    if (skidding && Math.random() < 0.3) {
      effects.dust(G.inCar.pos);
      audio.skid();
    }
    G.playerPos.copy(G.inCar.pos);
    G.playerHeading = G.inCar.heading;
  } else {
    player.update(dt, keys);
    G.playerPos.copy(player.pos);
    G.playerHeading = player.heading;
  }
  vehicles.update(dt);
  pedestrians.update(dt, G.inCar, () => {
    police.addWanted(1, 'hit a pedestrian');
    hud.showMessage('You hit a pedestrian! Wanted level up.', 3);
  });
  police.update(dt, G, busted, () => {
    G.health -= 6;
    hud.flashDamage();
    if (G.health <= 0) busted('Wasted. The Bay PD scraped you off the road.');
  });
  G.wanted = police.wanted;
  const mev = missions.update(G);
  handleMissionEvent(mev);
  combat.update(dt, G, handleCombatEvent);
  effects.update(dt);
  audio.engine(G.inCar ? Math.abs(G.inCar.speed) / 46 : 0);
  audio.siren(G.wanted > 0);
  if (G.health <= 0 && G.mode === 'playing') busted('Wasted. You got beaten down.');
  saveTimer += dt;
  if (saveTimer > 15) {
    saveTimer = 0;
    if (G.mode === 'playing') saveGame(G);
  }
}

function updateCamera(dt) {
  let target;
  let desired;
  if (G.mode === 'title' && !shot) {
    orbitT += dt * 0.04;
    target = new THREE.Vector3(0, 12, 0);
    desired = new THREE.Vector3(Math.sin(orbitT) * 130, 46, Math.cos(orbitT) * 130);
  } else if (G.inCar) {
    const car = G.inCar;
    let diff = (car.heading + Math.PI) - G.drivingYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.drivingYaw += diff * Math.min(1, dt * 2.2);
    target = new THREE.Vector3(car.pos.x, car.pos.y + 2, car.pos.z);
    desired = new THREE.Vector3(
      car.pos.x + Math.sin(G.drivingYaw) * 13,
      6,
      car.pos.z + Math.cos(G.drivingYaw) * 13
    );
  } else {
    target = player.cameraTarget();
    desired = target.clone().add(player.cameraOffset());
  }
  const k = 1 - Math.exp(-dt * 7);
  camPos.lerp(desired, k);
  camera.position.copy(camPos);
  camera.lookAt(target);
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  fpsFrames++;
  const wallNow = performance.now();
  if (wallNow - fpsWallStart >= 1000) {
    window.__fps = Math.round(fpsFrames * 1000 / (wallNow - fpsWallStart));
    fpsFrames = 0;
    fpsWallStart = wallNow;
  }
  if (!G.frozen && G.mode === 'playing') step(dt);
  else if (!G.frozen && G.mode === 'title') city.update(dt, G.minutes);
  if (beacon.visible) {
    beacon.material.opacity = 0.1 + Math.sin(G.time * 3) * 0.04;
    beacon.rotation.y += dt * 0.5;
    beaconGem.rotation.y += dt * 1.2;
    beaconGem.position.y = 12 + Math.sin(G.time * 2) * 1.2;
  }
  updateCamera(dt);
  hud.update(dt, G);
  renderer.render(scene, camera);
  if (!window.__ready) window.__ready = true;
}

// ?shot= deterministic scenes for screenshots
function setupShot() {
  startGame(false);
  hud.showMessage('', 0.1);
  if (shot === 'start') {
    G.mode = 'title';
    hud.showTitle(false);
    window.__shotReady = true;
    return;
  }
  if (shot === 'drive') {
    const car = vehicles.nearestCar(new THREE.Vector3(20, 0, -60), 200, ['parked']);
    enterCar(car);
    G.inCar.pos.set(20, 0, -60);
    G.inCar.heading = 0;
    G.inCar.speed = 24;
    G.playerPos.copy(G.inCar.pos);
    for (let i = 0; i < 90; i++) step(1 / 60);
    G.frozen = true;
  } else if (shot === 'chase') {
    const car = vehicles.nearestCar(new THREE.Vector3(20, 0, -60), 200, ['parked']);
    enterCar(car);
    G.inCar.pos.set(20, 0, -60);
    G.inCar.heading = 0;
    G.inCar.speed = 30;
    police.addWanted(3, 'shot setup');
    for (let i = 0; i < 90; i++) step(1 / 60);
    // stage one police car ahead of the player so the chase reads in frame
    const nearest = police.policeCars.slice().sort((a, b) =>
      Math.hypot(a.pos.x - G.playerPos.x, a.pos.z - G.playerPos.z) -
      Math.hypot(b.pos.x - G.playerPos.x, b.pos.z - G.playerPos.z))[0];
    if (nearest) {
      const fwdX = Math.sin(G.inCar.heading);
      const fwdZ = Math.cos(G.inCar.heading);
      nearest.pos.set(G.playerPos.x + fwdX * 24 + fwdZ * 7, 0, G.playerPos.z + fwdZ * 24 - fwdX * 7);
      nearest.heading = G.inCar.heading;
      nearest.speed = 30;
      nearest.group.position.copy(nearest.pos);
      nearest.group.rotation.y = nearest.heading;
    }
    G.frozen = true;
  } else if (shot === 'mission') {
    // First Wheels at the docks: player on the east road facing the piers,
    // containers, crane and water, mission beacon over the target.
    player.teleport(170, -40, Math.PI / 2);
    G.playerPos.copy(player.pos);
    refreshObjective();
    for (let i = 0; i < 60; i++) step(1 / 60);
    G.frozen = true;
  }
  window.__shotReady = true;
}

refreshObjective();
if (shot) setupShot();
else hud.showTitle(hasSave());
frame();
