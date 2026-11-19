// Neon Bay — police.js: the wanted level, the police who chase it, and getting busted.
// One clear job: make crime attract heat, and make heat something to escape.
import * as THREE from 'three';
import { CITY, isWalkable, resolveCollision, mulberry32 } from './city.js';
import { buildCarMesh } from './vehicles.js';
import { LANDMARKS } from './city.js';

const MAX_POLICE = 4;

/** Spawns the wanted system and its police cars. */
export function createPolice(scene, city) {
  const rng = mulberry32(99);
  let stars = 0;
  let lastCrime = -100;
  let quietTime = 0;
  let bustTimer = 0;
  const policeCars = [];

  function spawnPoliceCar(near) {
    const { group, wheels, lightBar } = buildCarMesh(0x1c1c22, true);
    // Drop the car on a road 60-90 units from the player.
    let x = near.x, z = near.z;
    for (let tries = 0; tries < 12; tries += 1) {
      const a = rng() * Math.PI * 2;
      const d = 60 + rng() * 30;
      x = near.x + Math.sin(a) * d;
      z = near.z + Math.cos(a) * d;
      const s = CITY.streets.reduce((best, v) => (Math.abs(v - z) < Math.abs(best - z) ? v : best), CITY.streets[0]);
      const sx = CITY.streets.reduce((best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best), CITY.streets[0]);
      if (Math.abs(z - s) < Math.abs(x - sx)) z = s; else x = sx;
      if (isWalkable(x, z)) break;
    }
    group.position.set(x, 0, z);
    scene.add(group);
    const car = {
      mesh: group, wheels, lightBar,
      pos: new THREE.Vector3(x, 0, z),
      heading: rng() * Math.PI * 2,
      speed: 0, stuck: 0,
    };
    policeCars.push(car);
    return car;
  }

  function removePoliceCar(car) {
    scene.remove(car.mesh);
    const i = policeCars.indexOf(car);
    if (i !== -1) policeCars.splice(i, 1);
  }

  return {
    get stars() { return stars; },
    get policeCars() { return policeCars; },
    /** Spawns one police car at an exact spot (used by the chase screenshot). */
    spawnAt(x, z, speed) {
      const { group, wheels, lightBar } = buildCarMesh(0x1c1c22, true);
      group.position.set(x, 0, z);
      scene.add(group);
      const car = {
        mesh: group, wheels, lightBar,
        pos: new THREE.Vector3(x, 0, z),
        heading: Math.PI / 2,
        speed: speed || 0, stuck: 0,
      };
      policeCars.push(car);
      return car;
    },
    addWanted(n, now) {
      stars = Math.min(5, stars + n);
      lastCrime = now;
      quietTime = 0;
    },
    clear() {
      stars = 0;
      while (policeCars.length) removePoliceCar(policeCars[0]);
    },
    /** Runs the pursuit. Returns 'busted' when the police catch the player. */
    update(dt, G) {
      const now = G.time;
      const playerPos = G.player.inCar && G.drivenCar ? G.drivenCar.pos : G.player.pos;
      const playerSpeed = G.player.inCar && G.drivenCar ? Math.abs(G.drivenCar.speed) : Math.abs(G.player.speed);

      // Keep the right number of police cars on the streets.
      const want = Math.min(stars, MAX_POLICE);
      while (policeCars.length < want) spawnPoliceCar(playerPos);
      while (policeCars.length > want) removePoliceCar(policeCars[policeCars.length - 1]);

      // Heat cools when the player stays quiet and out of sight.
      let nearest = 1e9;
      for (const p of policeCars) nearest = Math.min(nearest, Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z));
      if (stars > 0 && nearest > 70 && now - lastCrime > 15) {
        quietTime += dt;
        if (quietTime > 8) { stars -= 1; quietTime = 0; lastCrime = now; }
      } else {
        quietTime = 0;
      }

      // Flash the light bars and sound the siren while any police are out.
      const flash = Math.sin(now * 10) > 0;
      for (const p of policeCars) {
        if (p.lightBar) {
          p.lightBar.red.emissiveIntensity = flash ? 3 : 0.3;
          p.lightBar.blue.emissiveIntensity = flash ? 0.3 : 3;
        }
      }
      if (G.audio) G.audio.setSiren(policeCars.length > 0);

      // Pursuit: steer at the player, ram the car, corner the pedestrian.
      for (const p of policeCars) {
        const dx = playerPos.x - p.pos.x, dz = playerPos.z - p.pos.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const wantHeading = Math.atan2(dx, dz);
        let diff = wantHeading - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += diff * Math.min(1, dt * 2.6);
        const targetSpeed = dist > 26 ? 42 : 30;
        p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 1.2);
        const nx = p.pos.x + Math.sin(p.heading) * p.speed * dt;
        const nz = p.pos.z + Math.cos(p.heading) * p.speed * dt;
        const before = { x: p.pos.x, z: p.pos.z };
        if (isWalkable(nx, nz)) { p.pos.x = nx; p.pos.z = nz; }
        const fixed = resolveCollision(p.pos.x, p.pos.z, 2.0, city.colliders);
        p.pos.set(fixed.x, 0, fixed.z);
        const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z);
        if (moved < p.speed * dt * 0.25 && p.speed > 5) {
          p.stuck += dt;
          if (p.stuck > 1.5) {
            // Back out and try another angle instead of grinding the wall.
            p.heading += Math.PI * 0.7;
            p.stuck = 0;
          }
        } else {
          p.stuck = 0;
        }
        p.mesh.position.set(p.pos.x, 0, p.pos.z);
        p.mesh.rotation.y = p.heading;
        const spin = (p.speed * dt) / 0.38;
        for (const w of p.wheels) w.rotation.x += spin;

        // Ram: shove the player's car and shake it when we connect.
        // The push is scaled by dt so it is the same at any frame rate.
        if (G.drivenCar && dist < 4.5) {
          G.drivenCar.speed *= Math.max(0.5, 1 - dt * 1.4);
          G.drivenCar.pos.x += (dx / dist) * -1.2 * dt * 10;
          G.drivenCar.pos.z += (dz / dist) * -1.2 * dt * 10;
          if (G.fx) G.fx.sparks(G.drivenCar.pos.x, 1, G.drivenCar.pos.z, 6);
          if (G.audio) G.audio.thud();
        }
      }

      // Busted: cornered on foot, or boxed in while driving.
      if (stars > 0) {
        const close = nearest < (G.player.inCar ? 5.5 : 4);
        const slow = playerSpeed < 4;
        if (close && slow) {
          bustTimer += dt;
          if (bustTimer > (G.player.inCar ? 2.5 : 1.2)) {
            bustTimer = 0;
            return 'busted';
          }
        } else {
          bustTimer = Math.max(0, bustTimer - dt * 2);
        }
      }
      return null;
    },
    /** Puts the player back on the street after a bust: bail paid, heat gone. */
    respawn(G) {
      G.money = Math.max(0, G.money - 200);
      G.health = 100;
      stars = 0;
      while (policeCars.length) removePoliceCar(policeCars[0]);
      if (G.drivenCar) {
        G.drivenCar.kind = 'parked';
        G.drivenCar = null;
      }
      G.player.setInCar(false);
      G.player.placeAt(LANDMARKS.station.x, LANDMARKS.station.z, 0);
    },
  };
}
