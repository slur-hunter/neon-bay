// Rico on foot: a simple humanoid with camera-relative movement, walk/run,
// a punch swing and a walk bob. The camera-relative math is the part that
// must be right: forward walks AWAY from the camera, never toward it.

import * as THREE from 'three';
import { pick } from './rng.js';
import { collideBuildings, clampToCity } from './city.js';

const SHIRTS = [0xff5a3c, 0x2f7de1, 0x37c978, 0xf2c200, 0x8b5cf6];
const SKINS = [0xf2c89b, 0xc98d5f, 0x8a5a3b];

export function createHero(scene) {
  const group = new THREE.Group();
  const shirt = pick(Math.random, SHIRTS);
  const skin = pick(Math.random, SKINS);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.7 });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.35), legMat);
  legL.position.set(-0.16, 0.425, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.8, 0.42), torsoMat);
  torso.position.y = 1.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), skinMat);
  head.position.y = 1.95;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.position.y = 2.02;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), torsoMat);
  armL.position.set(-0.48, 1.3, 0);
  const armR = armL.clone();
  armR.position.x = 0.48;

  for (const part of [legL, legR, torso, head, cap, armL, armR]) {
    part.castShadow = true;
    group.add(part);
  }
  scene.add(group);

  const hero = {
    group,
    pos: new THREE.Vector3(28, 0, 0),
    yaw: Math.PI,
    speed: 0,
    walkSpeed: 6,
    runSpeed: 9.5,
    radius: 0.6,
    moving: false,
    punchTimer: 0,
    armL,
    armR,
    bobPhase: 0,
  };

  hero.reset = function reset(x, z, yaw) {
    hero.pos.set(x, 0, z);
    hero.yaw = yaw;
    hero.speed = 0;
    hero.punchTimer = 0;
    hero.group.position.copy(hero.pos);
    hero.group.rotation.y = yaw;
  };

  hero.punch = function punch() {
    if (hero.punchTimer <= 0) hero.punchTimer = 0.25;
  };

  // input: {f, b, l, r, run} booleans; camYaw: camera orbit angle.
  // Returns the planar velocity applied this frame.
  hero.update = function update(dt, input, camYaw, city) {
    // Camera sits at focus + (sin(camYaw), cos(camYaw)) * dist, so the
    // camera looks along (-sin, -cos). Forward is away from the camera.
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let mx = fx * ((input.f ? 1 : 0) - (input.b ? 1 : 0)) + rx * ((input.r ? 1 : 0) - (input.l ? 1 : 0));
    let mz = fz * ((input.f ? 1 : 0) - (input.b ? 1 : 0)) + rz * ((input.r ? 1 : 0) - (input.l ? 1 : 0));
    const len = Math.hypot(mx, mz);
    hero.moving = len > 0.01;
    if (hero.moving) {
      mx /= len;
      mz /= len;
      const targetYaw = Math.atan2(mx, mz);
      // Turn toward the movement direction, shortest way around.
      let dy = targetYaw - hero.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      hero.yaw += dy * Math.min(1, dt * 12);
      const spd = input.run ? hero.runSpeed : hero.walkSpeed;
      hero.speed = spd;
      hero.pos.x += mx * spd * dt;
      hero.pos.z += mz * spd * dt;
      hero.bobPhase += dt * 10;
    } else {
      hero.speed = 0;
    }
    if (city) {
      collideBuildings(hero.pos, hero.radius, city.buildings);
      clampToCity(hero.pos, city.bounds);
    }
    if (hero.punchTimer > 0) hero.punchTimer -= dt;
    // Pose: walk bob, arm swing, punch swing.
    const bob = hero.moving ? Math.sin(hero.bobPhase) * 0.06 : 0;
    group.position.set(hero.pos.x, bob, hero.pos.z);
    group.rotation.y = hero.yaw;
    const swing = hero.moving ? Math.sin(hero.bobPhase) * 0.5 : 0;
    armL.rotation.x = swing;
    armR.rotation.x = hero.punchTimer > 0 ? -1.6 * (hero.punchTimer / 0.25) : -swing;
    legL.rotation.x = swing * 0.7;
    legR.rotation.x = -swing * 0.7;
    return { vx: mx * hero.speed, vz: mz * hero.speed };
  };

  return hero;
}
