// player.js — Rico on foot: WASD movement relative to the camera, so forward
// always walks away from the camera in the direction faced (never inverted).
import * as THREE from 'three';
import { collideBuildings, clampToCity } from './city.js';

const SKIN = [0xf2c89b, 0xc98d5f, 0x8a5a3b];
const SHIRT = [0xff5a3c, 0x2f7de1, 0x37c978, 0xf2c200, 0x8b5cf6];

export function createPlayer(scene, city) {
  const group = new THREE.Group();
  group.name = 'player';

  const skin = SKIN[Math.floor(Math.random() * SKIN.length)];
  const shirt = SHIRT[Math.floor(Math.random() * SHIRT.length)];

  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.85, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 }),
  );
  legs.position.y = 0.425;
  legs.castShadow = true;
  group.add(legs);

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.8, 0.42),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 }),
  );
  torso.position.y = 1.25;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 14, 12),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }),
  );
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);

  // A cap, so the player reads at a glance in screenshots.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.7 }),
  );
  cap.position.y = 2.02;
  group.add(cap);

  // Arms, used for the punch swing.
  const armMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), armMat);
  armL.position.set(-0.48, 1.3, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);

  scene.add(group);

  const player = {
    group,
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

  player.reset = function (x, z, yaw) {
    player.pos.set(x, 0, z);
    player.yaw = yaw;
    player.speed = 0;
    player.group.position.copy(player.pos);
    player.group.rotation.y = yaw;
  };

  // input: {f,b,l,r,run} in camera space; camYaw is the camera's yaw.
  player.update = function (dt, input, camYaw) {
    let mx = 0; let mz = 0;
    if (input.f) mz += 1;
    if (input.b) mz -= 1;
    if (input.l) mx -= 1;
    if (input.r) mx += 1;
    player.moving = (mx !== 0 || mz !== 0);
    if (!player.moving) { player.speed = 0; return; }

    // Camera-relative: forward is where the camera looks on the ground plane.
    const sin = Math.sin(camYaw); const cos = Math.cos(camYaw);
    const fx = -sin; const fz = -cos;
    const rx = -cos; const rz = sin;
    let dx = fx * mz + rx * mx;
    let dz = fz * mz + rz * mx;
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;

    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - player.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    player.yaw += dy * Math.min(1, dt * 12);

    const speed = input.run ? player.runSpeed : player.walkSpeed;
    player.speed = speed;
    player.pos.x += dx * speed * dt;
    player.pos.z += dz * speed * dt;
    collideBuildings(player.pos, player.radius, city.buildings);
    clampToCity(player.pos, city.bounds - 2);

    // Walk bob.
    const t = performance.now() / 1000;
    player.group.position.set(player.pos.x, Math.abs(Math.sin(t * 10)) * 0.06, player.pos.z);
    player.group.rotation.y = player.yaw;
    player.armL.rotation.x = Math.sin(t * 10) * 0.5;
    player.armR.rotation.x = -Math.sin(t * 10) * 0.5;

    if (player.punchTimer > 0) {
      player.punchTimer -= dt;
      player.armR.rotation.x = -1.6 * Math.max(0, player.punchTimer / 0.25);
    }
  };

  player.punch = function () {
    player.punchTimer = 0.25;
  };

  return player;
}
