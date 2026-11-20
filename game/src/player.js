// player.js — Rico on foot. WASD moves relative to the camera, so forward
// always walks away from the camera, in the direction the player faces.
import * as THREE from 'three';
import { collideBuildings, clampToCity } from './city.js';

const SKINS = [0xf2c89b, 0xc98d5f, 0x8a5a3b];
const SHIRTS = [0xff5a3c, 0x2f7de1, 0x37c978, 0xf2c200, 0x8b5cf6];

export function createPlayer(scene, city) {
  const figure = new THREE.Group();
  figure.name = 'player';

  const skinTone = SKINS[Math.floor(Math.random() * SKINS.length)];
  const shirtTone = SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const cloth = new THREE.MeshStandardMaterial({ color: shirtTone, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.7 });

  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.85, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 }),
  );
  legs.position.y = 0.425;
  legs.castShadow = true;
  figure.add(legs);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.8, 0.42), cloth);
  torso.position.y = 1.25;
  torso.castShadow = true;
  figure.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  figure.add(head);

  // A yellow cap, so Rico reads at a glance in screenshots.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.7 }),
  );
  cap.position.y = 2.02;
  figure.add(cap);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), cloth);
  armL.position.set(-0.48, 1.3, 0);
  armL.castShadow = true;
  figure.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  figure.add(armR);

  scene.add(figure);

  const rico = {
    group: figure,
    pos: new THREE.Vector3(0, 0, 20),
    yaw: Math.PI,
    speed: 0,
    walkSpeed: 6,
    runSpeed: 9.5,
    radius: 0.6,
    moving: false,
    punchTimer: 0,
    armR,
    armL,
  };

  rico.reset = function place(x, z, yaw) {
    rico.pos.set(x, 0, z);
    rico.yaw = yaw;
    rico.speed = 0;
    rico.group.position.copy(rico.pos);
    rico.group.rotation.y = yaw;
  };

  // input: {f,b,l,r,run}; camYaw is the camera's yaw on the ground plane.
  rico.update = function step(dt, input, camYaw) {
    let mx = 0;
    let mz = 0;
    if (input.f) mz += 1;
    if (input.b) mz -= 1;
    if (input.l) mx -= 1;
    if (input.r) mx += 1;
    rico.moving = mx !== 0 || mz !== 0;
    if (!rico.moving) {
      rico.speed = 0;
      return;
    }

    // Camera space: forward is where the camera looks, so W walks away
    // from the camera. Screen-right is (cos, -sin): facing +z (camYaw 0)
    // the camera looks along -z and +x is screen-right, so D must move +x.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const fx = -sin;
    const fz = -cos;
    const rx = cos;
    const rz = -sin;
    let dx = fx * mz + rx * mx;
    let dz = fz * mz + rz * mx;
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;

    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - rico.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    rico.yaw += dy * Math.min(1, dt * 12);

    const pace = input.run ? rico.runSpeed : rico.walkSpeed;
    rico.speed = pace;
    rico.pos.x += dx * pace * dt;
    rico.pos.z += dz * pace * dt;
    collideBuildings(rico.pos, rico.radius, city.buildings);
    clampToCity(rico.pos, city.bounds - 2);

    // Walk bob and arm swing.
    const t = performance.now() / 1000;
    rico.group.position.set(rico.pos.x, Math.abs(Math.sin(t * 10)) * 0.06, rico.pos.z);
    rico.group.rotation.y = rico.yaw;
    rico.armL.rotation.x = Math.sin(t * 10) * 0.5;
    rico.armR.rotation.x = -Math.sin(t * 10) * 0.5;

    if (rico.punchTimer > 0) {
      rico.punchTimer -= dt;
      rico.armR.rotation.x = -1.6 * Math.max(0, rico.punchTimer / 0.25);
    }
  };

  rico.punch = function swing() {
    rico.punchTimer = 0.25;
  };

  return rico;
}
