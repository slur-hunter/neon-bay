// Neon Bay — main: renderer, game loop, input, flow, debug hooks.
// Original open-world crime game. Three.js, static files, no network.
import * as THREE from 'three';
import { buildCity, districtAt, CITY_EDGE } from './city.js';
import { buildHero } from './hero.js';
import { buildAutos } from './autos.js';
import { buildCrowd } from './crowd.js';
import { buildPatrol } from './patrol.js';
import { buildErrands } from './errands.js';
import { punchTargets } from './fists.js';
import { buildSparks } from './sparks.js';
import { buildSound } from './sound.js';
import { loadSave, saveGame, clearSave } from './pocket.js';
import { buildDisplay } from './display.js';
import { buildStage } from './stage.js';

// --- Debug hooks first, before anything else can throw ----------------------
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e)));
window.__ready = false;
window.__shotReady = false;
window.__shot = null;

const params = new URLSearchParams(location.search);
const shotParam = params.get('shot');
const shotNum = shotParam ? parseInt(shotParam, 10) : null;

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const city = buildCity(scene, 20261121);
const hero = buildHero(scene);
const autos = buildAutos(scene, 20261121, city.collide, city.clampPos);
const crowd = buildCrowd(scene, 20261121, city.collide, city.clampPos);
const patrol = buildPatrol(scene, 20261121, city.collide, city.clampPos);
const errands = buildErrands(scene);
const sparks = buildSparks(scene);
const sound = buildSound();
const display = buildDisplay(document);

// --- Game state --------------------------------------------------------------
const G = {
  mode: 'menu',
  health: 100,
  inCar: null,
  camYaw: Math.PI,
  camPitch: 0.32,
  cameraMode: 'follow',
  frames: 0,
  time: 0,
  keys: {},
  dragging: false,
  lastX: 0,
  lastY: 0,
  busted: false,
};

const saved = loadSave();
if (saved) {
  errands.state.money = saved.money;
  errands.state.index = saved.index;
  errands.state.rp = saved.rp;
  errands.state.doneByDistrict = {};
  errands.placeMarker();
}

// --- HUD state ---------------------------------------------------------------
function hudState() {
  const job = errands.current();
  const px = G.inCar ? G.inCar.x : hero.state.pos.x;
  const pz = G.inCar ? G.inCar.z : hero.state.pos.z;
  const district = districtAt(px, pz);
  const dx = job.marker[0] - px;
  const dz = job.marker[1] - pz;
  const markerDist = Math.hypot(dx, dz);
  const worldAng = Math.atan2(dx, dz);
  const viewAng = G.inCar ? G.inCar.yaw : hero.state.yaw;
  let compassDeg = (worldAng - viewAng) * 180 / Math.PI;
  while (compassDeg > 180) compassDeg -= 360;
  while (compassDeg < -180) compassDeg += 360;
  return {
    wanted: patrol.getWanted(),
    health: G.health,
    money: errands.state.money,
    rank: errands.rank(),
    rp: errands.state.rp,
    district,
    standing: errands.standingHere(district),
    jobTitle: job.title,
    jobText: job.text,
    jobIndex: errands.state.index,
    nextTitle: errands.nextTitle(),
    policeLines: patrol.panelLines(),
    speaker: job.speaker,
    story: job.story,
    inCar: !!G.inCar,
    speedMph: G.inCar ? Math.abs(G.inCar.v) * 2.2 : hero.state.speed * 2.2,
    compassDeg,
    markerDist,
    markerX: job.marker[0],
    markerZ: job.marker[1],
    damage: G.inCar ? G.inCar.damage : 0,
    stationName: sound.station().name,
    stationTrack: sound.station().track,
    radioOn: sound.isRadioOn(),
    muted: sound.isMuted(),
    banner: errands.state.bannerT > 0 ? errands.state.banner : '',
    playerX: px,
    playerZ: pz,
    playerYaw: viewAng,
    trafficDots: autos.traffic.map((c) => {
      const p = c.mesh.group.position;
      return [p.x, p.z];
    }),
    policeDots: patrol.positions(),
  };
}

function refreshHud() {
  display.update(hudState());
}

// --- Stage (shots) -----------------------------------------------------------
const stage = buildStage({
  camera, hero, autos, patrol, errands, crowd, display, sound,
  setInCar: (car) => { G.inCar = car; },
  setMode: (m) => { G.mode = m; },
  refreshHud,
});

// --- Camera follow -----------------------------------------------------------
function followCamera(dt) {
  const target = G.inCar
    ? new THREE.Vector3(G.inCar.x, 1.2, G.inCar.z)
    : new THREE.Vector3(hero.state.pos.x, 1.6, hero.state.pos.z);
  const dist = G.inCar ? 11 : 8.5;
  // Mouse-drag pitch actually moves the camera: dragging down raises the
  // view (a higher, flatter look at the street), dragging up drops it low.
  const height = (G.inCar ? 5.2 : 4.4) * (1 + (G.camPitch - 0.32) * 1.6);
  const cx = target.x - Math.sin(G.camYaw) * dist;
  const cz = target.z - Math.cos(G.camYaw) * dist;
  camera.position.set(cx, height, cz);
  camera.lookAt(target.x, target.y, target.z);
  const [ox, oy] = sparks.offset();
  camera.position.x += ox * 0.1;
  camera.position.y += oy * 0.1;
}

// --- Actions -----------------------------------------------------------------
function tryEnterCar() {
  if (G.inCar) return;
  const { car, dist } = autos.nearestStealable(hero.state.pos.x, hero.state.pos.z);
  if (!car || dist > 4.5) return;
  if (car.police) return;
  const driven = autos.makeDriven(car);
  G.inCar = driven;
  sound.click();
  patrol.raiseWanted(1);
  sound.siren(true);
}

function exitCar() {
  if (!G.inCar) return;
  const car = G.inCar;
  G.inCar = null;
  hero.place(car.x + Math.sin(car.yaw + Math.PI / 2) * 2.5, car.z + Math.cos(car.yaw + Math.PI / 2) * 2.5, car.yaw);
  sound.radioStop();
  sound.click();
}

function doPunch() {
  if (!hero.punch()) return;
  sound.punch();
  const px = hero.state.pos.x;
  const pz = hero.state.pos.z;
  const hit = punchTargets(px, pz, hero.state.yaw, crowd, patrol.cruisers);
  if (!hit) return;
  if (hit.kind === 'cruiser') {
    patrol.raiseWanted(1);
    sound.siren(true);
    sparks.burst(hit.target.x, 1.2, hit.target.z, 0xff4040, 10);
    sparks.shake(0.5, 0.3);
  } else {
    sparks.burst(px + Math.sin(hero.state.yaw) * 2, 1.2, pz + Math.cos(hero.state.yaw) * 2, 0xffd21a, 8);
  }
}

function onRam(cruiser) {
  if (G.inCar) {
    G.inCar.damage = Math.min(100, G.inCar.damage + 7);
    G.inCar.v *= 0.55;
    G.health = Math.max(0, G.health - 6);
  } else {
    G.health = Math.max(0, G.health - 12);
    hero.state.pos.x += (hero.state.pos.x - cruiser.x) * 0.08;
    hero.state.pos.z += (hero.state.pos.z - cruiser.z) * 0.08;
  }
  sound.crash();
  sparks.burst(cruiser.x, 1.2, cruiser.z, 0xff8040, 12);
  sparks.shake(0.7, 0.35);
  checkBusted();
}

function checkBusted() {
  if (G.health <= 0 && !G.busted) {
    G.busted = true;
    G.mode = 'over';
    sound.busted();
    sound.siren(false);
    saveGame(errands.state.money, errands.state.index, errands.state.rp);
    document.getElementById('overlay-over').style.display = 'flex';
    document.getElementById('over-text').textContent =
      `BUSTED — the Ledger still waits. Money $${errands.state.money}, job ${Math.min(errands.state.index + 1, 4)}/4.`;
  }
}

// --- Input -------------------------------------------------------------------
const keyMap = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', Space: 'space', ShiftLeft: 'shift', ShiftRight: 'shift' };
window.addEventListener('keydown', (e) => {
  if (keyMap[e.code]) {
    G.keys[keyMap[e.code]] = true;
    if (e.code === 'Space') e.preventDefault();
  }
  if (e.code === 'KeyE') {
    if (G.mode === 'play') {
      if (G.inCar) exitCar();
      else tryEnterCar();
    }
  }
  if (e.code === 'KeyM') {
    if (G.mode === 'play') {
      if (G.inCar) sound.nextStation();
      else sound.toggleMute();
      refreshHud();
    }
  }
  if (e.code === 'KeyP') {
    if (G.mode === 'play') {
      G.mode = 'pause';
      document.getElementById('overlay-pause').style.display = 'flex';
    } else if (G.mode === 'pause') {
      G.mode = 'play';
      document.getElementById('overlay-pause').style.display = 'none';
    }
  }
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code]) G.keys[keyMap[e.code]] = false;
});
canvas.addEventListener('pointerdown', (e) => {
  G.dragging = true;
  G.lastX = e.clientX;
  G.lastY = e.clientY;
  if (G.mode === 'play' && !G.inCar) doPunch();
});
window.addEventListener('pointermove', (e) => {
  if (!G.dragging) return;
  G.camYaw -= (e.clientX - G.lastX) * 0.005;
  G.camPitch = Math.max(0.12, Math.min(0.7, G.camPitch + (e.clientY - G.lastY) * 0.002));
  G.lastX = e.clientX;
  G.lastY = e.clientY;
});
window.addEventListener('pointerup', () => { G.dragging = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Overlays ----------------------------------------------------------------
const startBtn = document.getElementById('btn-start');
const continueRow = document.getElementById('continue-row');
const continueBtn = document.getElementById('btn-continue');
if (saved) {
  continueRow.style.display = 'block';
  continueBtn.textContent = `CONTINUE — $${saved.money}, JOB ${Math.min(saved.index + 1, 4)}/4`;
  continueBtn.addEventListener('click', () => {
    sound.ensure();
    sound.click();
    document.getElementById('overlay-start').style.display = 'none';
    G.mode = 'play';
  });
}
startBtn.addEventListener('click', () => {
  sound.ensure();
  sound.click();
  clearSave();
  errands.state.money = 0;
  errands.state.index = 0;
  errands.state.rp = 0;
  errands.state.doneByDistrict = {};
  errands.placeMarker();
  document.getElementById('overlay-start').style.display = 'none';
  G.mode = 'play';
});
document.getElementById('btn-resume').addEventListener('click', () => {
  G.mode = 'play';
  document.getElementById('overlay-pause').style.display = 'none';
});
document.getElementById('btn-restart').addEventListener('click', () => {
  location.reload();
});
document.getElementById('btn-again').addEventListener('click', () => {
  clearSave();
  location.reload();
});

// --- Debug hooks -------------------------------------------------------------
window.__game = {
  // Camera setter so the automated test can face the hero without a 40-second
  // mouse drag in headless SwiftShader (the drag itself was verified
  // separately); gameplay still uses real keyboard input.
  setCamYaw: (y) => { G.camYaw = y; },
  debug: {
    get mode() { return G.mode; },
    get money() { return errands.state.money; },
    get health() { return G.health; },
    get wanted() { return patrol.getWanted(); },
    get missionIndex() { return errands.state.index; },
    get missionsDone() { return errands.state.index; },
    get inCar() { return !!G.inCar; },
    get playerPos() {
      return G.inCar ? [G.inCar.x, G.inCar.z] : [hero.state.pos.x, hero.state.pos.z];
    },
    get speed() { return G.inCar ? Math.abs(G.inCar.v) : hero.state.speed; },
    get shot() { return stage.current(); },
    get frames() { return G.frames; },
    get camYaw() { return G.camYaw; },
    get cameraMode() { return G.cameraMode; },
    get carYaw() { return G.inCar ? G.inCar.yaw : 0; },
    get carPos() { return G.inCar ? [G.inCar.x, G.inCar.z] : [0, 0]; },
    get policeCount() { return patrol.count(); },
    get policePos() { return patrol.positions(); },
    get rp() { return errands.state.rp; },
    get rank() { return errands.rank(); },
    get damage() { return G.inCar ? G.inCar.damage : 0; },
    get markerPos() {
      const j = errands.current();
      return [j.marker[0], j.marker[1]];
    },
    get nearestCar() {
      const r = autos.nearestStealable(hero.state.pos.x, hero.state.pos.z);
      return r.car ? { x: r.car.x, z: r.car.z, dist: r.dist } : null;
    },
  },
};

// --- Main loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let firstFrame = true;

if (shotNum && shotNum >= 1 && shotNum <= 4) {
  window.__shot = shotNum;
  document.getElementById('overlay-start').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  stage.applyShot(shotNum);
  G.mode = 'shot';
} else {
  document.getElementById('loading').style.display = 'none';
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.1);
  G.time += dt;
  G.frames++;
  if (G.mode === 'play') {
    const px = G.inCar ? G.inCar.x : hero.state.pos.x;
    const pz = G.inCar ? G.inCar.z : hero.state.pos.z;
    const pSpeed = G.inCar ? Math.abs(G.inCar.v) : hero.state.speed;
    if (G.inCar) {
      autos.driveCar(G.inCar, dt, G.keys, city.collide, city.clampPos);
      sound.engine(Math.min(1, Math.abs(G.inCar.v) / 34));
      sound.radioStart();
    } else {
      hero.step(dt, G.keys, G.camYaw, city.collide, city.clampPos);
      sound.engine(0);
    }
    autos.stepTraffic(dt);
    crowd.step(dt, { x: px, z: pz }, pSpeed);
    patrol.step(dt, px, pz, !!G.inCar, onRam);
    errands.step(dt, G.time);
    sparks.step(dt);
    sound.siren(patrol.getWanted() > 0);
    // Driving: the camera eases behind the car so it follows the car's
    // heading (mouse drag still overrides while the player is dragging).
    if (G.inCar && !G.dragging) {
      let d = G.inCar.yaw - G.camYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      G.camYaw += d * Math.min(1, dt * 1.5);
    }
    const job = errands.current();
    const d = Math.hypot(px - job.marker[0], pz - job.marker[1]);
    if (d < 6 && errands.state.index < 4) {
      if (errands.tryComplete(px, pz)) {
        sound.pickup();
        sparks.burst(job.marker[0], 2, job.marker[1], 0xffd21a, 16);
        saveGame(errands.state.money, errands.state.index, errands.state.rp);
      }
    }
    followCamera(dt);
    refreshHud();
  } else if (G.mode === 'shot') {
    stage.tick();
    autos.stepTraffic(dt);
    errands.step(dt, G.time);
    sparks.step(dt);
    // No patrol.step here: the staged cruisers must stay where the shot
    // placed them. Letting them chase would ram the nearest one into the
    // player car and hide it behind a cruiser.
    refreshHud();
    if (stage.ready()) window.__shotReady = true;
  } else {
    // Menu / pause / over: keep the city alive behind the overlay.
    autos.stepTraffic(dt);
    errands.step(dt, G.time);
    const t = G.time * 0.04;
    camera.position.set(Math.sin(t) * 60, 34, Math.cos(t) * 60);
    camera.lookAt(0, 4, 0);
    refreshHud();
  }
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    window.__ready = true;
  }
}
loop();
