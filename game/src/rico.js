// Neon Bay v7 — Rico on foot. A small procedural humanoid with camera-relative
// WASD movement, walk/run, a punch swing and a walk bob. No imported assets.
import * as THREE from 'three';
import { pickFrom } from './seed.js';
import { collideSolids, clampToBounds } from './metropolis.js';

const SHIRTS = [0xff5a3c, 0x2f7de1, 0x37c978, 0xf2c200, 0x8b5cf6, 0x2fd4c4];
const SKINS = [0xf2c89b, 0xc98d5f, 0x8a5a3b, 0xe8b98a];

export function createRico(scene, city) {
  const shirt = pickFrom(Math.random, SHIRTS);
  const skin = pickFrom(Math.random, SKINS);
  const group = new THREE.Group();

  const legMat = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6 });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.32), legMat);
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
  for (const m of [legL, legR, torso, head, cap, armL, armR]) {
    m.castShadow = true;
    group.add(m);
  }
  scene.add(group);

  const rico = {
    group,
    pos: new THREE.Vector3(16, 0, 40),
    heading: Math.PI,
    walkSpeed: 6,
    runSpeed: 9.5,
    radius: 0.6,
    moving: false,
    speed: 0,
    punchTimer: 0,
    walkPhase: 0,
    armL, armR, legL, legR, torso, head,
    reset(x, z, heading) {
      this.pos.set(x, 0, z);
      this.heading = heading;
      this.group.position.copy(this.pos);
      this.group.rotation.y = heading;
      this.punchTimer = 0;
    },
    punch() {
      if (this.punchTimer <= 0) this.punchTimer = 0.25;
    },
    update(dt, input, camYaw) {
      // Camera-relative: W walks away from the camera, D strafes right.
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      let mx = fx * (input.f - input.b) + rx * (input.r - input.l);
      let mz = fz * (input.f - input.b) + rz * (input.r - input.l);
      const len = Math.hypot(mx, mz);
      this.moving = len > 0.01;
      if (this.moving) {
        mx /= len; mz /= len;
        const spd = input.run ? this.runSpeed : this.walkSpeed;
        this.speed = spd;
        this.pos.x += mx * spd * dt;
        this.pos.z += mz * spd * dt;
        // Turn toward the movement direction.
        const target = Math.atan2(mx, mz);
        let d = target - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * Math.min(1, dt * 12);
        this.walkPhase += dt * 10;
        const bob = Math.sin(this.walkPhase) * 0.06;
        this.group.position.set(this.pos.x, bob, this.pos.z);
        this.legL.rotation.x = Math.sin(this.walkPhase) * 0.5;
        this.legR.rotation.x = -Math.sin(this.walkPhase) * 0.5;
        this.armL.rotation.x = -Math.sin(this.walkPhase) * 0.4;
      } else {
        this.speed = 0;
        this.group.position.set(this.pos.x, 0, this.pos.z);
        this.legL.rotation.x = 0; this.legR.rotation.x = 0;
        this.armL.rotation.x = 0;
      }
      this.group.rotation.y = this.heading;
      // Punch swing on the right arm.
      if (this.punchTimer > 0) {
        this.punchTimer -= dt;
        this.armR.rotation.x = -1.6 * Math.max(0, this.punchTimer / 0.25);
      } else {
        this.armR.rotation.x = this.moving ? Math.sin(this.walkPhase) * 0.4 : 0;
      }
      collideSolids(this.pos, this.radius, city.solids);
      clampToBounds(this.pos, city.bounds);
      this.group.position.x = this.pos.x;
      this.group.position.z = this.pos.z;
    },
  };
  rico.reset(16, 40, Math.PI);
  return rico;
}
