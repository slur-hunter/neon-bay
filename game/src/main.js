// main.js — boots Neon Bay: renderer, lights, systems, input, and the game loop.
import * as THREE from 'three';
import { City, makeRng } from './city.js';
import { Player } from './player.js';
import { Vehicles } from './vehicles.js';
import { Police } from './police.js';
import { Pedestrians } from './pedestrians.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { Save } from './save.js';
import { AudioSys } from './audio.js';
import { Effects } from './effects.js';
import { Shots } from './shots.js';

const query = new URLSearchParams(window.location.search);
const seedParam = parseInt(query.get('seed') || '7', 10);
const SEED = Number.isFinite(seedParam) ? seedParam : 7;

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9cc8e8);
    this.scene.fog = new THREE.Fog(0xa8c4de, 200, 480);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 90, 180);

    // Bright late-afternoon sun.
    const hemi = new THREE.HemisphereLight(0x9fc8e8, 0x8a7a66, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9a8, 2.4);
    sun.position.set(140, 110, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -170;
    sun.shadow.camera.right = 170;
    sun.shadow.camera.top = 170;
    sun.shadow.camera.bottom = -170;
    sun.shadow.camera.far = 500;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    this.rng = makeRng(SEED);
    this.city = new City(this.scene, SEED);
    this.vehicles = new Vehicles(this.scene, this.city, this.rng);
    this.player = new Player(this.scene, this.city, this.vehicles);
    this.police = new Police(this.scene, this.city, this.rng);
    this.pedestrians = new Pedestrians(this.scene, this.city, this.rng);
    this.effects = new Effects(this.scene);
    this.audio = new AudioSys();
    this.hud = new Hud(this);
    this.save = new Save(this);
    this.missions = new Missions(this.scene, this.city, this);
    this.combat = new Combat(this);
    this.shots = new Shots(this);

    this.state = 'menu';
    this.money = 0;
    this.health = 100;
    this.wanted = 0;
    this.score = 0;
    this.time = 0;
    this.heatTimer = 0;
    this.cinematicAngle = 0;
    this.frames = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;

    this.input = { forward: false, back: false, left: false, right: false, brake: false, sprint: false };
    this.keys = new Set();
    this.dragging = false;
    this.dragMoved = 0;
    this.dragStart = 0;
    this.lastMouse = { x: 0, y: 0 };

    this.bindInput();
    this.bindButtons();
    this.debug = this.debugApi();
    window.__game = this.debug;
    this.shots.parse();
    this.shots.stage();
    if (this.shots.mode === 0) this.offerContinue();

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.loop());
  }

  offerContinue() {
    const data = this.save.load();
    if (!data) return;
    const btn = document.getElementById('continueBtn');
    const note = document.getElementById('saveNote');
    btn.classList.remove('hidden');
    note.textContent = 'Saved game found: $' + data.money + ', job ' + Math.min(data.missionIndex + 1, 4) + ' of 4.';
    btn.addEventListener('click', () => {
      this.save.apply(data);
      this.startGame();
    }, { once: true });
  }

  addScore(n) { this.score += n; }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(4, n));
    this.heatTimer = 0;
  }

  startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    this.hud.show();
    this.state = 'playing';
    this.audio.init();
    this.audio.click();
  }

  setCinematicCamera() {
    this.cinematicAngle = 0.6;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.save.write();
    const stats = document.getElementById('pauseStats');
    stats.textContent = 'Money $' + this.money + ' · Job ' + Math.min(this.missions.index + 1, 4) +
      ' of 4 · Wanted ' + this.wanted + '★ · Health ' + Math.round(this.health);
    document.getElementById('pauseScreen').classList.remove('hidden');
  }

  resume() {
    document.getElementById('pauseScreen').classList.add('hidden');
    this.state = 'playing';
    this.audio.init();
  }

  gameOver() {
    this.state = 'gameover';
    this.save.write();
    document.getElementById('gameOverScreen').classList.remove('hidden');
  }

  retry() {
    this.health = 100;
    this.setWanted(0);
    this.police.clear();
    if (this.player.inCar) this.player.exitCar();
    const spawn = this.city.spawnPos;
    this.player.mesh.position.set(spawn.x, 0, spawn.z);
    this.player.heading = Math.PI;
    this.player.camYaw = Math.PI;
    document.getElementById('gameOverScreen').classList.add('hidden');
    this.state = 'playing';
  }

  bindButtons() {
    document.getElementById('startBtn').addEventListener('click', () => {
      this.save.clear();
      this.startGame();
    });
    document.getElementById('resumeBtn').addEventListener('click', () => this.resume());
    document.getElementById('retryBtn').addEventListener('click', () => this.retry());
    document.getElementById('restartBtn').addEventListener('click', () => {
      this.save.clear();
      window.location.href = window.location.pathname;
    });
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.syncInput();
      if (e.code === 'KeyE' && this.state === 'playing') this.pressInteract();
      if ((e.code === 'KeyP' || e.code === 'Escape') && (this.state === 'playing' || this.state === 'paused')) {
        if (this.state === 'playing') this.pause();
        else this.resume();
      }
      if (e.code === 'KeyM') {
        const muted = this.audio.toggleMute();
        this.hud.showToast(muted ? 'Sound off' : 'Sound on');
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.syncInput();
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.dragMoved = 0;
      this.dragStart = performance.now();
      this.lastMouse = { x: e.clientX, y: e.clientY };
      try { this.canvas.requestPointerLock(); } catch { /* ignore */ }
    });
    window.addEventListener('mouseup', (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      const quick = performance.now() - this.dragStart < 300;
      if (this.dragMoved < 6 && quick && e.target === this.canvas) this.combat.tryPunch();
    });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.player.look(e.movementX, e.movementY);
        return;
      }
      if (!this.dragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.player.look(dx, dy);
    });
  }

  syncInput() {
    const k = this.keys;
    this.input.forward = k.has('KeyW') || k.has('ArrowUp');
    this.input.back = k.has('KeyS') || k.has('ArrowDown');
    this.input.left = k.has('KeyA') || k.has('ArrowLeft');
    this.input.right = k.has('KeyD') || k.has('ArrowRight');
    this.input.brake = k.has('Space');
    this.input.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
  }

  pressInteract() {
    if (this.player.inCar) {
      this.player.exitCar();
      return;
    }
    const car = this.player.tryEnterCar();
    if (car) {
      if (this.wanted < 1) {
        this.setWanted(1);
        this.hud.showToast('You stole the car. That is 1 star — drive!');
      } else {
        this.hud.showToast('New ride. Keep moving.');
      }
      this.audio.click();
    }
  }

  updateWanted(dt) {
    if (this.wanted === 0) return;
    const d = this.police.nearestDistance(this.player.pos);
    if (d > 45) {
      this.heatTimer += dt;
      if (this.heatTimer > 6) {
        this.heatTimer = 0;
        this.setWanted(this.wanted - 1);
        if (this.wanted === 0) this.hud.showToast('You lost them. The heat is off — for now.');
      }
    } else {
      this.heatTimer = 0;
    }
  }

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.frames += 1;
    this.fpsFrames += 1;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      const note = document.getElementById('fpsnote');
      if (note) note.textContent = Math.round(this.fpsFrames / this.fpsTime) + ' fps · ' +
        this.renderer.info.render.calls + ' draw calls';
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    if (this.state === 'playing') {
      this.player.update(dt, this.input, this.camera);
      this.vehicles.update(dt, this.player.car);
      this.police.update(dt, this.player.pos, this.player.heading,
        this.player.inCar && this.player.car ? this.player.car.speed : 0, this.wanted);
      this.pedestrians.update(dt);
      this.missions.update(dt, this.player.pos, this.time);
      this.combat.update(dt);
      this.updateWanted(dt);
      const driving = this.player.inCar && this.player.car;
      const speed01 = driving ? Math.min(1, Math.abs(this.player.car.speed) / 30) : 0;
      this.audio.engine(speed01, !!driving);
      this.audio.siren(this.wanted > 0 && this.police.nearestDistance(this.player.pos) < 70, dt);
      this.hud.update(dt);
    } else if (this.state === 'menu') {
      this.vehicles.update(dt, null);
      this.pedestrians.update(dt);
      this.cinematicAngle += dt * 0.05;
      const r = 175;
      this.camera.position.set(Math.sin(this.cinematicAngle) * r, 95, Math.cos(this.cinematicAngle) * r);
      this.camera.lookAt(0, 0, 0);
    }
    this.effects.update(dt, this.camera);
    this.renderer.render(this.scene, this.camera);
    if (!window.__ready) window.__ready = true;
    this.shots.tick();
  }

  // Test hooks for the local play test and the screenshot staging.
  debugApi() {
    const game = this;
    const api = {
      get state() { return game.state; },
      get money() { return game.money; },
      get wanted() { return game.wanted; },
      get health() { return game.health; },
      get missionIndex() { return game.missions.index; },
      get inCar() { return game.player.inCar; },
      get playerPos() { return { x: game.player.pos.x, z: game.player.pos.z }; },
      get missionTarget() { return game.missions.targetPos(); },
      get carSpeed() { return game.player.car ? game.player.car.speed : 0; },
      get carHeading() { return game.player.car ? game.player.car.heading : game.player.heading; },
      teleport(x, z) {
        if (game.player.inCar) game.player.exitCar();
        game.player.mesh.position.set(x, 0, z);
      },
      enterSpawnCar() {
        const car = game.vehicles.spawnCar();
        if (!car) return null;
        game.player.mesh.position.set(car.mesh.position.x + 3, 0, car.mesh.position.z);
        const got = game.player.tryEnterCar();
        return got ? car : null;
      },
      setWanted(n) { game.setWanted(n); },
      start() { game.startGame(); },
      completeMission() {
        const def = game.missions.current();
        if (def) game.missions.complete(def);
      },
    };
    api.debug = api;
    return api;
  }
}

new Game();
