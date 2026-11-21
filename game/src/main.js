// Neon Bay v10 — entry point. Wires the city, hero, cars, pedestrians,
// police, jobs, sound, HUD and staging into one game loop.
// Debug hooks (wired first): window.__errors, __ready, __shotReady, __shot,
// window.__game.debug with live getters.
import * as THREE from 'three';
import { City } from './city.js';
import { Traffic, PlayerCar, makeCarMesh } from './vehicles.js';
import { Pedestrians } from './people.js';
import { Police } from './police.js';
import { JobState } from './jobs.js';
import { Sound } from './sound.js';
import { Fx } from './fx.js';
import { Hud } from './hud.js';
import { Hero } from './hero.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { stageShot } from './stage.js';

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String((e && e.message) || e));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push('rejection: ' + String((e && e.reason) || e));
});
window.__ready = false;
window.__shotReady = false;
window.__shot = null;

const params = new URLSearchParams(window.location.search);
const shotNum = parseInt(params.get('shot') || '0', 10);
const SHOT_MODE = shotNum >= 1 && shotNum <= 4;
if (SHOT_MODE) window.__shot = shotNum;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1700);

// golden-hour light: warm hemisphere + ambient on the ground, low warm sun
scene.add(new THREE.HemisphereLight(0xffc07a, 0x9a7a5a, 1.9));
scene.add(new THREE.AmbientLight(0xffd9a8, 0.85));
const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -130;
sun.shadow.camera.right = 130;
sun.shadow.camera.top = 130;
sun.shadow.camera.bottom = -130;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

// ---------- world ----------
const city = new City(scene);
const traffic = new Traffic(scene, city);
const peds = new Pedestrians(scene, city);
const police = new Police(scene, city);
const jobs = new JobState();
const sound = new Sound();
const fx = new Fx(scene);
const hud = new Hud(document);
const hero = new Hero(scene);
const carMesh = makeCarMesh(0x7ec850, false); // the driven car is always green
carMesh.group.visible = false;
scene.add(carMesh.group);
const car = new PlayerCar(scene, carMesh.group);
car.mesh = carMesh;

const G = {
  mode: SHOT_MODE ? 'shot' : 'menu',
  shot: SHOT_MODE ? shotNum : null,
  frames: 0,
  shotFrame0: 0,
  shotStartedAt: 0,
  jobs,
  health: 100,
  inCar: false,
  car,
  carMesh,
  hero,
  traffic,
  peds,
  police,
  sound,
  fx,
  hud,
  city,
  camera,
  camYaw: Math.PI,
  camPitch: 0.3,
  bannerTimer: 0,
  bannerText: '',
  stolenCar: null,
  saveTimer: 0,
};

function playerPos() {
  return G.inCar ? G.car.pos : G.hero.pos;
}
function playerSpeed() {
  return G.inCar ? G.car.speed : G.hero.speed;
}

// ---------- debug hooks ----------
window.__game = {
  debug: {
    get mode() {
      return G.mode;
    },
    get money() {
      return G.jobs.money;
    },
    get health() {
      return G.health;
    },
    get wanted() {
      return G.police.wanted;
    },
    get missionIndex() {
      return G.jobs.index;
    },
    get missionsDone() {
      return G.jobs.missionsDone;
    },
    get inCar() {
      return G.inCar;
    },
    get playerPos() {
      const p = playerPos();
      return { x: p.x, z: p.z };
    },
    get speed() {
      return playerSpeed();
    },
    get shot() {
      return G.shot;
    },
    get frames() {
      return G.frames;
    },
    get camYaw() {
      return G.camYaw;
    },
    get cameraMode() {
      return G.inCar ? 'car' : 'foot';
    },
    get carYaw() {
      return G.car.yaw;
    },
    get carPos() {
      return { x: G.car.pos.x, z: G.car.pos.z };
    },
    get policeCount() {
      return G.police.cruisers.length;
    },
    get policePos() {
      return G.police.cruisers.map((c) => ({ x: c.x, z: c.z }));
    },
    // parked stealable cars (debug only — the game never reads this)
    get parkedCars() {
      return G.traffic.parked.filter((p) => !p.driven).map((p) => ({ x: p.x, z: p.z }));
    },
  },
};

// ---------- input ----------
const keys = {};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  sound.ensure();
  if (e.code === 'KeyM' && G.inCar) {
    sound.nextStation();
    sound.blip(660, 0.06);
  }
  if (e.code === 'KeyX') sound.toggleMute();
  if (e.code === 'KeyE' && G.mode === 'play') tryEnterExit();
  if (e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
let dragging = false;
let lastMX = 0;
let lastMY = 0;
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastMX = e.clientX;
  lastMY = e.clientY;
  sound.ensure();
  if (G.mode === 'play' && !G.inCar) doPunch();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMX;
  const dy = e.clientY - lastMY;
  lastMX = e.clientX;
  lastMY = e.clientY;
  G.camYaw -= dx * 0.005;
  G.camPitch = Math.max(0.05, Math.min(0.9, G.camPitch + dy * 0.002));
});
window.addEventListener('mouseup', () => {
  dragging = false;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function inputState() {
  return {
    fwd: !!(keys.KeyW || keys.ArrowUp),
    back: !!(keys.KeyS || keys.ArrowDown || keys.Space),
    left: !!keys.KeyA || !!keys.ArrowLeft,
    right: !!keys.KeyD || !!keys.ArrowRight,
    run: !!(keys.ShiftLeft || keys.ShiftRight),
  };
}

function nearestStealable() {
  let best = null;
  let bestD = 3.5;
  for (const p of G.traffic.parked) {
    if (p.driven) continue;
    const d = Math.hypot(p.x - G.hero.pos.x, p.z - G.hero.pos.z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function tryEnterExit() {
  if (!G.inCar) {
    const target = nearestStealable();
    if (!target) return;
    target.driven = true;
    target.mesh.group.visible = false;
    G.stolenCar = target;
    G.carMesh.group.visible = true;
    G.car.place(target.x, target.z, target.yaw);
    G.car.damage = target.damage || 0;
    G.hero.group.visible = false;
    G.inCar = true;
    G.police.raiseWanted(1);
    G.police.spawnNear(G.hero.pos);
    sound.blip(520, 0.1, 'square', 0.15);
  } else {
    const c = G.stolenCar;
    if (c) {
      c.x = G.car.pos.x;
      c.z = G.car.pos.z;
      c.yaw = G.car.yaw;
      c.damage = G.car.damage;
      c.driven = false;
      c.mesh.group.position.set(c.x, 0, c.z);
      c.mesh.group.rotation.y = c.yaw;
      c.mesh.group.visible = true;
    }
    G.stolenCar = null;
    G.carMesh.group.visible = false;
    const side = { x: Math.cos(G.car.yaw), z: -Math.sin(G.car.yaw) };
    G.hero.place(G.car.pos.x + side.x * 2.6, G.car.pos.z + side.z * 2.6, G.car.yaw);
    G.hero.group.visible = true;
    G.inCar = false;
    sound.blip(440, 0.08);
  }
}

function doPunch() {
  if (!G.hero.tryPunch()) return;
  sound.blip(180, 0.07, 'square', 0.14);
  const pt = G.hero.punchPoint();
  // a police car in reach: wanted rises (the ONLY punch that raises it)
  for (const c of G.police.cruisers) {
    if (Math.hypot(c.x - pt.x, c.z - pt.z) < 2.8) {
      G.police.raiseWanted(1);
      G.fx.burst(c.x, 1, c.z, 0xffd23e, 10, 4);
      G.fx.shake(0.3);
      sound.blip(120, 0.12, 'sawtooth', 0.16);
      return;
    }
  }
  const hit = G.peds.nearest(pt.x, pt.z, 2.4);
  if (hit) {
    G.peds.knockDown(hit.ped);
    G.fx.burst(hit.ped.x, 1, hit.ped.z, 0xffffff, 8, 3);
  }
}

function togglePause() {
  if (G.mode === 'play') {
    G.mode = 'pause';
    document.getElementById('pause-overlay').style.display = 'flex';
  } else if (G.mode === 'pause') {
    G.mode = 'play';
    document.getElementById('pause-overlay').style.display = 'none';
  }
}

function showBanner(text, seconds = 4) {
  G.bannerText = text;
  G.bannerTimer = seconds;
}

// ---------- mission flow ----------
function checkMission() {
  if (G.jobs.finished) return;
  const job = G.jobs.current;
  const p = playerPos();
  if (Math.hypot(job.marker[0] - p.x, job.marker[1] - p.z) < 6) {
    const done = G.jobs.complete();
    showBanner('MISSION COMPLETE — ' + done.title + ' +$' + done.pay, 4);
    sound.blip(880, 0.14, 'sine', 0.18);
    sound.blip(1320, 0.2, 'sine', 0.14);
    G.fx.burst(job.marker[0], 2, job.marker[1], 0xffd23e, 22, 6);
    writeSave(G.jobs);
  }
}

// ---------- per-frame play update ----------
function updatePlay(dt) {
  const input = inputState();
  if (G.inCar) {
    const crash = G.car.drive(dt, input, G.city);
    if (crash > 8) {
      G.fx.shake(0.35);
      G.fx.burst(G.car.pos.x, 1, G.car.pos.z, 0xff9030, 10, 4);
      sound.blip(110, 0.12, 'sawtooth', 0.16);
    }
    sound.setEngine(G.car.speed, true);
  } else {
    G.hero.walk(dt, input, G.camYaw, G.city);
    sound.setEngine(0, false);
  }
  G.traffic.update(dt, false);
  G.peds.update(dt, playerPos(), playerSpeed(), false);
  G.police.update(dt, playerPos(), playerSpeed(), false, (c) => {
    if (G.inCar) {
      G.car.damage = Math.min(100, G.car.damage + 7);
      G.health = Math.max(0, G.health - 2);
    } else {
      G.health = Math.max(0, G.health - 5);
    }
    G.fx.shake(0.45);
    G.fx.burst(c.x, 1, c.z, 0xff4040, 12, 5);
    sound.blip(90, 0.15, 'sawtooth', 0.18);
  });
  sound.setSiren(G.police.wanted > 0);
  checkMission();
  if (G.police.wanted === 0 && G.health < 100) G.health = Math.min(100, G.health + 2 * dt);
  if (G.bannerTimer > 0) G.bannerTimer -= dt;
  G.saveTimer -= dt;
  if (G.saveTimer <= 0) {
    G.saveTimer = 15;
    writeSave(G.jobs);
  }
  if (G.health <= 0) {
    G.mode = 'over';
    document.getElementById('over-overlay').style.display = 'flex';
    clearSave();
  }
}

// ---------- camera ----------
function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function updateCamera(dt) {
  if (G.mode === 'shot') return; // staged cameras never move
  const p = playerPos();
  if (G.mode === 'menu') {
    G.camYaw += dt * 0.06;
    const a = G.camYaw;
    camera.position.set(p.x + Math.sin(a) * 26, 12, p.z + Math.cos(a) * 26);
    camera.lookAt(p.x, 2, p.z - 10);
    return;
  }
  if (G.inCar) {
    let diff = wrapPi(G.car.yaw - G.camYaw);
    G.camYaw += diff * Math.min(1, dt * 1.4);
  }
  const dist = G.inCar ? 12 : 9;
  const height = 3 + G.camPitch * 6;
  const fx = Math.sin(G.camYaw);
  const fz = Math.cos(G.camYaw);
  camera.position.set(p.x - fx * dist, height, p.z - fz * dist);
  const look = new THREE.Vector3(p.x + fx * 5, 1.4, p.z + fz * 5);
  camera.lookAt(look);
  const sh = G.fx.offset();
  camera.position.x += sh.x;
  camera.position.y += sh.y;
  // low warm sun follows the player so shadows stay long everywhere
  sun.position.set(p.x + 30, 55, p.z - 110);
  sun.target.position.set(p.x, 0, p.z);
  sun.target.updateMatrixWorld();
}

// ---------- overlays / start ----------
const saved = loadSave();
if (saved) {
  const row = document.getElementById('continue-row');
  if (row) row.style.display = '';
}
document.getElementById('start-btn').addEventListener('click', () => {
  sound.ensure();
  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  G.mode = 'play';
});
document.getElementById('continue-btn').addEventListener('click', () => {
  const s = loadSave();
  if (!s) return;
  G.jobs.money = s.money;
  G.jobs.index = s.index;
  G.jobs.rp = s.rp;
  sound.ensure();
  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  G.mode = 'play';
});
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('over-overlay').style.display = 'none';
  G.health = 100;
  G.jobs = new JobState();
  G.hero.place(0, 60, Math.PI);
  G.camYaw = Math.PI;
  G.mode = 'play';
});
document.getElementById('sound').addEventListener('click', () => {
  sound.ensure();
  sound.toggleMute();
});

// ---------- main loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  G.frames += 1;
  if (G.mode === 'shot') {
    // staged world: entities hold their staged spots, panels stay live
    G.traffic.update(dt, true);
    G.peds.update(dt, playerPos(), 0, true);
    G.police.update(dt, playerPos(), 0, true, null);
    G.fx.update(dt);
    if (
      !window.__shotReady &&
      performance.now() - G.shotStartedAt >= 4000 &&
      G.frames - G.shotFrame0 >= 5
    ) {
      window.__shotReady = true;
    }
  } else if (G.mode === 'play') {
    updatePlay(dt);
    G.fx.update(dt);
  } else if (G.mode === 'menu') {
    G.traffic.update(dt, false);
    G.peds.update(dt, playerPos(), 0, false);
  }
  updateCamera(dt);
  G.hud.update(G, dt);
  sound.update(dt, G.inCar);
  renderer.render(scene, camera);
  if (!window.__ready) {
    window.__ready = true;
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  }
}

// ---------- boot ----------
if (SHOT_MODE) {
  stageShot(G, shotNum);
} else {
  // menu backdrop: hero on a street at golden hour
  G.hero.place(0, 60, Math.PI);
  G.camYaw = Math.PI;
  camera.position.set(0, 12, 86);
  camera.lookAt(0, 2, 50);
}
animate();
