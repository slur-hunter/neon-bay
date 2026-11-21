// Neon Bay v8: bootstrap, renderer, camera, input, game loop, debug
// hooks. Golden-hour open world, four jobs, real progression (RP, rank,
// district standing, car damage, radio) — every HUD number comes from
// live state.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { makeHero } from './hero.js';
import { buildAutos, driveCar } from './autos.js';
import { buildCrowd } from './crowd.js';
import { buildPatrol } from './patrol.js';
import { makeErrands, JOBS } from './errands.js';
import { makeFists } from './fists.js';
import { makeSparks, makeShake } from './sparks.js';
import { makeSound } from './sound.js';
import { loadSave, writeSave, clearSave } from './pocket.js';
import { makeDisplay } from './display.js';
import { applyShot } from './stage.js';

window.__errors = [];
window.__ready = false;
window.__shotReady = false;
window.__shot = null;
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error || 'error'));
});

const rng = makeRng(20261124);
const params = new URLSearchParams(location.search);
const shotParam = Number(params.get('shot') || 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);

const city = buildCity(scene, rng);
const hero = makeHero(scene);
const autos = buildAutos(scene, rng, city.collide);
const crowd = buildCrowd(scene, rng);
const patrol = buildPatrol(scene, rng, city.collide);
const errands = makeErrands(scene, city.districtAt);
const fists = makeFists();
const sparks = makeSparks(scene);
const shake = makeShake();
const sound = makeSound();
const display = makeDisplay();

const G = {
  mode: 'loading',
  shot: 0,
  shotFrames: 0,
  shotStartedAt: 0,
  wanted: 0,
  health: 100,
  car: null,
  camYaw: Math.PI,
  camPitch: 0.42,
  frames: 0,
  elapsed: 0,
  hero, autos, crowd, patrol, errands, camera, display,
  refreshHud,
};
G.city = city;

let wantedQuietT = 0;
let dead = false;

function playerPos() {
  return G.car ? { x: G.car.x, z: G.car.z } : { x: hero.x, z: hero.z };
}
function playerYaw() {
  return G.car ? G.car.yaw : hero.yaw;
}
function playerSpeed() {
  return G.car ? G.car.speed : hero.speed;
}

function refreshHud(dt = 0.016) {
  const p = playerPos();
  const job = errands.job();
  const st = errands.state;
  display.update({
    wanted: G.wanted,
    health: G.health,
    money: st.money,
    rank: errands.rank(),
    rp: st.rp,
    district: errands.districtHere(p.x, p.z),
    standing: errands.standingHere(p.x, p.z),
    jobTitle: st.index < JOBS.length ? job.title : 'Free Roam',
    jobText: st.index < JOBS.length ? job.text : 'The debt is paid. Neon Bay is yours.',
    jobIndex: Math.min(st.index, 3),
    nextTitle: errands.nextTitle(),
    police: patrol.cops.map((c) => ({ callsign: c.callsign, role: c.role, dist: c.dist })),
    speaker: st.index < JOBS.length ? job.speaker : 'VINNIE "THE LEDGER" MARLOW',
    story: st.index < JOBS.length ? job.story : 'Debt paid. Neon Bay is Rico\u2019s again.',
    inCar: !!G.car,
    speed: playerSpeed(),
    marker: { x: job.x, z: job.z },
    px: p.x, pz: p.z, yaw: playerYaw(),
    damage: G.car ? G.car.damage : 0,
    station: sound.station(),
    banner: st.banner,
    bannerT: st.bannerT,
    traffic: autos.traffic,
    peds: crowd.peds,
  }, dt);
}

function raiseWanted(n) {
  G.wanted = Math.min(4, G.wanted + n);
  wantedQuietT = 0;
}

function onRam(cop) {
  const inCar = !!G.car;
  G.health -= inCar ? 5 : 9;
  if (G.car) G.car.damage = Math.min(100, G.car.damage + 7);
  shake.add(0.5);
  sparks.burst(cop.x, 1.2, cop.z, 0xff5040, 12);
  sound.crash();
  if (G.health <= 0) bust();
}

function bust() {
  if (dead) return;
  dead = true;
  G.health = 0;
  G.mode = 'over';
  sound.busted();
  sound.radioOff();
  writeSave(errands.state);
  display.showOverlay('gameoverov');
}

function startGame(fromSave) {
  sound.unlock();
  if (fromSave) {
    const s = loadSave();
    if (s) {
      const st = errands.state;
      st.money = s.money; st.index = s.index; st.rp = s.rp;
      st.done = Math.min(s.index, 4);
      errands.placeMarker();
    }
  }
  G.mode = 'playing';
  display.hideOverlays();
  refreshHud();
}

// ---- input ----
const keys = new Set();
let dragging = false, lastX = 0, lastY = 0, moved = 0;
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyP' && (G.mode === 'playing' || G.mode === 'paused')) {
    G.mode = G.mode === 'playing' ? 'paused' : 'playing';
    display.showOverlay(G.mode === 'paused' ? 'pauseov' : null);
    if (G.mode === 'playing') display.hideOverlays();
  }
  if (e.code === 'KeyM' && G.mode === 'playing') {
    if (G.car) { sound.nextStation(); sound.click(); }
    else sound.setMuted(!sound.isMuted());
  }
  if (e.code === 'KeyE' && G.mode === 'playing') tryEnterExit();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  G.camYaw -= dx * 0.005;
  G.camPitch = Math.max(0.15, Math.min(0.9, G.camPitch + dy * 0.003));
});
window.addEventListener('mouseup', () => {
  if (dragging && moved < 6 && G.mode === 'playing' && !G.car) punch();
  dragging = false;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function tryEnterExit() {
  const p = playerPos();
  if (G.car) {
    const car = G.car;
    G.car = null;
    hero.x = car.x + Math.sin(car.yaw + Math.PI / 2) * 2.5;
    hero.z = car.z + Math.cos(car.yaw + Math.PI / 2) * 2.5;
    hero.yaw = car.yaw;
    hero.group.visible = true;
    sound.radioOff();
    sound.click();
    return;
  }
  const car = autos.nearestStealable(p.x, p.z);
  if (!car) return;
  car.stolen = true;
  G.car = car;
  hero.group.visible = false;
  raiseWanted(1);
  sound.radioOn();
  sound.click();
  refreshHud();
}

function punch() {
  if (!fists.ready()) return;
  const p = playerPos();
  const res = fists.swing(p.x, p.z, hero.yaw, crowd, patrol);
  hero.punchT = 0.22;
  if (res.hit) {
    sound.punch();
    shake.add(0.25);
    sparks.burst(p.x + Math.sin(hero.yaw) * 2, 1.2, p.z + Math.cos(hero.yaw) * 2, 0xffd27a, 8);
    raiseWanted(1);
    refreshHud();
  }
}

// ---- camera ----
function updateCamera(dt) {
  const p = playerPos();
  const yaw = G.camYaw;
  const dist = G.car ? 13 : 9;
  const height = G.car ? 5.5 : 4.2;
  const tx = p.x - Math.sin(yaw) * dist;
  const tz = p.z - Math.cos(yaw) * dist;
  const sh = shake.offset(dt);
  camera.position.set(tx + sh.x, height + sh.y, tz);
  camera.lookAt(p.x, 1.6, p.z);
}

// ---- debug hooks ----
window.__game = {
  debug: {
    get mode() { return G.mode; },
    get money() { return errands.state.money; },
    get health() { return Math.round(G.health); },
    get wanted() { return G.wanted; },
    get missionIndex() { return errands.state.index; },
    get missionsDone() { return errands.state.done; },
    get inCar() { return !!G.car; },
    get playerPos() { const p = playerPos(); return [p.x, p.z]; },
    get speed() { return playerSpeed(); },
    get shot() { return G.shot; },
    get frames() { return G.frames; },
    get camYaw() { return G.camYaw; },
    get cameraMode() { return G.shot ? 'staged' : 'follow'; },
    get carYaw() { return G.car ? G.car.yaw : null; },
    get carPos() { return G.car ? [G.car.x, G.car.z] : null; },
    get policeCount() { return patrol.cops.length; },
    get policePos() { return patrol.cops.map((c) => [c.x, c.z]); },
    get rp() { return errands.state.rp; },
    get rank() { return errands.rank(); },
    get damage() { return G.car ? G.car.damage : 0; },
    get nearestCar() {
      const p = playerPos();
      const c = autos.nearestStealable(p.x, p.z);
      if (!c) {
        let best = null, bd = 1e9;
        for (const pc of autos.parked) {
          if (pc.stolen) continue;
          const d = Math.hypot(pc.x - p.x, pc.z - p.z);
          if (d < bd) { bd = d; best = pc; }
        }
        return best ? { dist: bd, x: best.x, z: best.z } : null;
      }
      return { dist: Math.hypot(c.x - p.x, c.z - p.z), x: c.x, z: c.z };
    },
  },
};

// ---- overlays ----
document.getElementById('startbtn').addEventListener('click', () => startGame(false));
const contBtn = document.getElementById('continuebtn');
if (contBtn) contBtn.addEventListener('click', () => startGame(true));
const againBtn = document.getElementById('againbtn');
if (againBtn) againBtn.addEventListener('click', () => {
  clearSave();
  location.reload();
});
const resumeBtn = document.getElementById('resumebtn');
if (resumeBtn) resumeBtn.addEventListener('click', () => {
  G.mode = 'playing';
  display.hideOverlays();
});
const muteBtn = document.getElementById('mutebtn');
if (muteBtn) muteBtn.addEventListener('click', () => {
  sound.unlock();
  sound.setMuted(!sound.isMuted());
  muteBtn.textContent = sound.isMuted() ? 'SOUND OFF' : 'SOUND ON';
});

const saved = loadSave();
if (saved && saved.index > 0) {
  display.setContinue(true, `CONTINUE — $${saved.money} · JOB ${Math.min(saved.index + 1, 4)}/4`);
}

// ---- main loop ----
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.elapsed += dt;
  G.frames += 1;
  const t = clock.elapsedTime;

  if (G.mode === 'shot') {
    G.shotFrames += 1;
    const real = (performance.now() - G.shotStartedAt) / 1000;
    if (real >= 4 && G.shotFrames >= 5) window.__shotReady = true;
    errands.update(dt, t);
    patrol.update(dt, playerPos().x, playerPos().z, G.wanted, () => {});
    crowd.update(dt, playerPos().x, playerPos().z, 0);
    autos.updateTraffic(dt);
    sparks.update(dt);
    refreshHud(dt);
    renderer.render(scene, camera);
    if (!window.__ready) window.__ready = true;
    return;
  }

  if (G.mode === 'playing') {
    fists.tick(dt);
    const p = playerPos();
    if (G.car) {
      const input = {
        forward: keys.has('KeyW') || keys.has('ArrowUp'),
        back: keys.has('KeyS') || keys.has('ArrowDown') || keys.has('Space'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
      };
      driveCar(G.car, input, dt, city.collide);
      if (keys.has('Space')) G.car.speed *= Math.max(0, 1 - 3 * dt);
    } else {
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const str = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const moving = fwd !== 0 || str !== 0;
      const run = 7.5;
      const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
      const rx = Math.cos(G.camYaw), rz = -Math.sin(G.camYaw);
      let mx = fx * fwd + rx * str;
      let mz = fz * fwd + rz * str;
      const ml = Math.hypot(mx, mz);
      if (ml > 0) { mx /= ml; mz /= ml; }
      const nx = hero.x + mx * run * dt;
      const nz = hero.z + mz * run * dt;
      const fixed = city.collide(nx, nz, 0.6);
      hero.x = fixed.x; hero.z = fixed.z;
      hero.speed = moving ? run : 0;
      if (moving) hero.yaw = Math.atan2(mx, mz);
      hero.update(dt, moving, false);
    }
    // Wanted decay: quiet and far from every cruiser for a while.
    patrol.sync(G.wanted, p.x, p.z);
    patrol.update(dt, p.x, p.z, G.wanted, onRam);
    let nearest = 1e9;
    for (const c of patrol.cops) nearest = Math.min(nearest, Math.hypot(c.x - p.x, c.z - p.z));
    if (G.wanted > 0 && nearest > 45) {
      wantedQuietT += dt;
      if (wantedQuietT > 6) { G.wanted -= 1; wantedQuietT = 0; refreshHud(); }
    } else wantedQuietT = 0;
    crowd.update(dt, p.x, p.z, playerSpeed());
    autos.updateTraffic(dt);
    errands.update(dt, t);
    if (errands.tryComplete(p.x, p.z)) {
      sound.pickup();
      sparks.burst(p.x, 1.5, p.z, 0xffc94d, 22);
      writeSave(errands.state);
      refreshHud();
    }
    sparks.update(dt);
    sound.update(dt, playerSpeed(), G.wanted);
    refreshHud(dt);
    updateCamera(dt);
  }

  renderer.render(scene, camera);
  if (!window.__ready) window.__ready = true;
}

// ---- boot ----
if (shotParam >= 1 && shotParam <= 4) {
  window.__shot = shotParam;
  errands.placeMarker();
  applyShot(shotParam, G);
  display.hideOverlays();
} else {
  display.showOverlay('startov');
}
frame();
