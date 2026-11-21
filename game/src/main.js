// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between three
// screens: title, play and paused. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. In shot mode the actors are frozen in their
// staged places (only the clock, the timer and the light bars move), so the frame
// is exactly the staged late-game state.
import { STEP, WORLD } from './config.js';
import { createRandom, clamp } from './util.js';
import { createWorld } from './world.js';
import { createActors } from './actors.js';
import { createPolice } from './police.js';
import { createJobs, JOB_MARKERS } from './jobs.js';
import { createHud } from './hud.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

const THREE = globalThis.THREE;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message ?? event.error ?? 'error'));
});

const canvas = document.getElementById('game');
const random = createRandom(seed);
const world = createWorld(random);
const actors = createActors(world.scene, random);
const police = createPolice(actors);
const jobs = createJobs();
const hud = createHud();
const sound = createSound();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 700);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const game = {
  actors,
  police,
  jobs,
  world,
  camera,
  clockMinutes: 18 * 60,
  damage: 0,
  titleCard: false,
  time: 0,
  shotMode: Boolean(shot),
  screen: 'title',
  camYaw: 0,
  camPitch: 0,

  step(dt, input = {}, frozen = false) {
    this.time += dt;
    this.clockMinutes += dt * 0.5;
    jobs.step(dt);
    if (frozen) {
      police.flash(dt, this.time);
      return;
    }
    const player = actors.player;
    if (input.forward || input.strafe || input.turn) {
      actors.walkPlayer(dt, input.forward || 0, input.strafe || 0, input.turn || 0);
    }
    if (player.car) {
      actors.drivePlayer(dt, input.throttle || 0, input.steer || 0, input.brake || 0);
    }
    actors.stepTraffic(dt);
    actors.stepPeds(dt);
    police.step(dt, this.time);
    sound.step(police.wanted, Boolean(player.car), player.car ? player.car.speed : 0);
    // A cruiser touching the car damages it; the armour absorbs it first.
    if (player.car) {
      for (const cruiser of actors.cruisers) {
        if (cruiser.active && cruiser.distance < 2.5) {
          this.damage = clamp(this.damage + 8 * dt, 0, 100);
          if (jobs.state.armour > 0) jobs.state.armour = Math.max(0, jobs.state.armour - 8 * dt);
          else jobs.state.health = Math.max(0, jobs.state.health - 8 * dt);
        }
      }
    }
    // Reaching the marker finishes the job (live play only, never in a staged shot).
    if (!this.shotMode && this.screen === 'play') {
      const marker = JOB_MARKERS[jobs.state.jobIndex];
      const d = Math.hypot(player.x - marker.x, player.z - marker.z);
      if (d < 3.5) {
        jobs.completeJob();
        sound.jobDone();
        const next = JOB_MARKERS[jobs.state.jobIndex];
        world.setMarker(next.x, next.z);
        jobs.state.district = next.district;
      }
    }
  },

  placeShotCamera(offset, look) {
    const player = actors.player;
    camera.position.set(player.x + offset.dx, offset.dy, player.z + offset.dz);
    camera.lookAt(player.x + look.dx, look.dy, player.z + look.dz);
  },

  followCamera(dt) {
    const player = actors.player;
    const behind = player.onFoot ? 9 : 12;
    const height = player.onFoot ? 4.5 : 6;
    const yaw = player.heading + this.camYaw;
    const targetX = player.x - Math.sin(yaw) * behind;
    const targetZ = player.z - Math.cos(yaw) * behind;
    const targetY = height + this.camPitch * 4;
    camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 6);
    camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 6);
    camera.lookAt(player.x + Math.sin(player.heading) * 6, 2, player.z + Math.cos(player.heading) * 6);
  },

  view() {
    const player = actors.player;
    const marker = JOB_MARKERS[jobs.state.jobIndex];
    const car = player.car;
    const speed = car ? car.speed : 0;
    const gear = speed < 5 ? 'G1' : speed < 13 ? 'G2' : speed < 20 ? 'G3' : 'G4';
    return {
      jobs,
      wanted: police.wanted,
      clockMinutes: this.clockMinutes,
      onFoot: player.onFoot,
      speed,
      compass: Math.hypot(player.x - marker.x, player.z - marker.z),
      cruisers: actors.cruisers,
      radio: sound.radio,
      soundOn: sound.on,
      carName: car ? car.name : '',
      carCondition: car ? car.condition : 0,
      gear,
      damage: this.damage,
      titleCard: this.titleCard,
      marker,
      traffic: actors.traffic,
      player: { x: player.x, z: player.z, heading: player.heading },
    };
  },

  render() {
    hud.update(this.view());
    renderer.render(world.scene, camera);
  },
};

window.__game = game;

// ---- input ----
const keys = {};
let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  keys[event.code] = true;
  if (event.code === 'KeyM') sound.nextRadio();
  if (event.code === 'KeyX') sound.toggle();
  if (event.code === 'KeyP' && game.screen === 'play') {
    game.screen = 'paused';
    hud.showPause();
  } else if (event.code === 'KeyP' && game.screen === 'paused') {
    game.screen = 'play';
    hud.hidePause();
  }
  if (event.code === 'Enter' && game.screen === 'title') startGame();
  if (event.code === 'KeyE' && game.screen === 'play') {
    const player = actors.player;
    if (player.onFoot) {
      const car = actors.nearestParked(player.x, player.z, 5);
      if (car) {
        actors.enterCar(car);
        police.onSteal();
        sound.collect();
      }
    } else {
      actors.exitCar();
    }
  }
});
window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});
canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});
window.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  game.camYaw -= (event.clientX - lastPointerX) * 0.004;
  game.camPitch = clamp(game.camPitch + (event.clientY - lastPointerY) * 0.002, -0.6, 0.8);
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});
window.addEventListener('pointerup', () => {
  dragging = false;
});
canvas.addEventListener('click', () => {
  if (game.screen !== 'play' || !actors.player.onFoot) return;
  const player = actors.player;
  const hit = actors.punchNear(player.x + Math.sin(player.heading) * 1.6, player.z + Math.cos(player.heading) * 1.6);
  if (hit === 'ped') sound.punch();
  if (hit === 'cruiser') {
    police.onPunchCruiser();
    sound.punch();
  }
});

function startGame() {
  jobs.load();
  const marker = JOB_MARKERS[jobs.state.jobIndex];
  world.setMarker(marker.x, marker.z);
  jobs.state.district = marker.district;
  game.screen = 'play';
  hud.hideTitle();
  sound.unlock();
}

function readInput() {
  const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  return {
    forward,
    strafe,
    turn: 0,
    throttle: keys.KeyW ? 1 : 0,
    steer: (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0),
    brake: keys.Space ? 1 : 0,
  };
}

function runShot(name) {
  try {
    game.screen = 'play';
    hud.hideTitle();
    stageShot(name, game);
    let painted = 0;
    const paint = () => {
      game.render();
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else window.__shotReady = true;
    };
    requestAnimationFrame(paint);
  } catch (error) {
    window.__errors.push('stageShot: ' + String(error && error.message ? error.message : error));
    window.__shotReady = true;
  }
}

function runGame() {
  hud.showTitle(jobs.load());
  hud.onStart(startGame);
  let accumulator = 0;
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    if (game.screen === 'play') {
      while (accumulator >= STEP) {
        game.step(STEP, readInput());
        accumulator -= STEP;
      }
      game.followCamera(frameDt);
    } else {
      accumulator = 0;
    }
    game.render();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'paused';
      hud.showPause();
    }
  });
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
