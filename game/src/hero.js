// Rico on foot: a simple blocky humanoid with walk bob, arm swing and a
// punch animation. Movement is camera-relative: W walks AWAY from the
// camera, never toward it.
import * as THREE from 'three';
import { clamp } from './rng.js';

export function makeHero(scene) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xff6a1f, roughness: 0.85 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x7fa8c9, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.8 });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), jeans);
  legL.position.set(-0.16, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.78, 0.4), shirt);
  torso.position.y = 1.19;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.24), shirt);
  armL.position.set(-0.48, 1.2, 0);
  const armR = armL.clone();
  armR.position.x = 0.48;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.82;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.44), capMat);
  cap.position.y = 2.06;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.24), capMat);
  brim.position.set(0, 2.0, 0.3);
  group.add(legL, legR, torso, armL, armR, head, cap, brim);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(group);

  return {
    group, legL, legR, armL, armR,
    x: 0, z: 40, yaw: Math.PI, // faces -Z (toward the first marker)
    speed: 0, moving: false, bobPhase: 0,
    punchTimer: 0, punchCooldown: 0,
  };
}

// input: {f, s, l, r} forward/strafe as -1..1, run bool, camYaw number.
// Returns the hero's planar speed for the HUD/engine sound.
export function stepHero(hero, input, dt, city) {
  const walkSpeed = input.run ? 7.0 : 4.4;
  // Camera-relative: forward is the camera's look direction on the ground.
  const fx = Math.sin(input.camYaw);
  const fz = Math.cos(input.camYaw);
  // Camera right = look x up = (-cos, sin) in (x, z).
  const rx = -Math.cos(input.camYaw);
  const rz = Math.sin(input.camYaw);
  let mx = fx * input.f + rx * input.s;
  let mz = fz * input.f + rz * input.s;
  const len = Math.hypot(mx, mz);
  hero.moving = len > 0.01;
  if (hero.moving) {
    mx /= len;
    mz /= len;
    const targetYaw = Math.atan2(mx, mz);
    let dy = targetYaw - hero.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    hero.yaw += clamp(dy, -9 * dt, 9 * dt);
    const nx = hero.x + mx * walkSpeed * dt;
    const nz = hero.z + mz * walkSpeed * dt;
    const fixed = city.collide(nx, nz, 0.55);
    const clamped = city.clampPos(fixed.x, fixed.z);
    hero.x = clamped.x;
    hero.z = clamped.z;
    hero.speed = walkSpeed;
    hero.bobPhase += dt * (input.run ? 11 : 8);
  } else {
    hero.speed = 0;
  }
  // Walk bob + arm swing, eased back to idle when standing still.
  const amp = hero.moving ? 1 : 0;
  const bob = Math.abs(Math.sin(hero.bobPhase)) * 0.07 * amp;
  hero.group.position.set(hero.x, bob, hero.z);
  hero.group.rotation.y = hero.yaw;
  hero.legL.rotation.x = Math.sin(hero.bobPhase) * 0.55 * amp;
  hero.legR.rotation.x = -Math.sin(hero.bobPhase) * 0.55 * amp;
  hero.armL.rotation.x = -Math.sin(hero.bobPhase) * 0.45 * amp;
  hero.armR.rotation.x = Math.sin(hero.bobPhase) * 0.45 * amp;
  // Punch: quick forward swing of the right arm.
  if (hero.punchTimer > 0) {
    hero.punchTimer -= dt;
    const k = 1 - hero.punchTimer / 0.28;
    hero.armR.rotation.x = -1.5 * Math.sin(Math.min(k, 1) * Math.PI);
  }
  if (hero.punchCooldown > 0) hero.punchCooldown -= dt;
  return hero.speed;
}
