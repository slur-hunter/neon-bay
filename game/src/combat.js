// createCombat runs fists, the pistol pickup, gunfire and the bank guards.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

export function createCombat(scene, city, seed) {
  const rng = mulberry32(seed + 55);
  const enemies = [];
  let weaponPickup = null;
  let lastPunch = 0;
  let lastShot = 0;
  let lastHurt = -10;

  // pistol pickup glowing at the docks
  const pickup = new THREE.Group();
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.9),
    new THREE.MeshLambertMaterial({ color: 0x222228 }));
  gun.position.y = 0.6;
  pickup.add(gun);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.35 }));
  glow.position.y = 0.6;
  pickup.add(glow);
  pickup.position.set(222, 0, -18);
  scene.add(pickup);
  weaponPickup = pickup;

  function makeGuard(x, z) {
    const group = new THREE.Group();
    const suit = new THREE.MeshLambertMaterial({ color: 0x8a1f2e });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.4), suit);
    torso.position.y = 1.15;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.82;
    group.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), suit);
    legL.position.set(-0.18, 0.38, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.18;
    group.add(legR);
    group.position.set(x, 0, z);
    scene.add(group);
    const e = { group, pos: group.position, health: 60, speed: 4.2, cooldown: 0, dead: false, fade: 0 };
    enemies.push(e);
    return e;
  }

  function spawnGuards() {
    if (enemies.length > 0) return;
    makeGuard(34, -34);
    makeGuard(46, -46);
    makeGuard(40, -30);
  }

  return {
    enemies,
    spawnGuards,
    update(dt, G, onEvent) {
      const now = G.time;
      // pickup
      if (weaponPickup && !G.hasWeapon) {
        weaponPickup.rotation.y += dt;
        const d = Math.hypot(G.playerPos.x - 222, G.playerPos.z - (-18));
        if (d < 2.5) {
          G.hasWeapon = true;
          scene.remove(weaponPickup);
          weaponPickup = null;
          onEvent({ type: 'weapon', text: 'Pistol picked up. Click to shoot.' });
        }
      }
      // guards chase and punch
      for (const e of [...enemies]) {
        if (e.dead) {
          e.fade += dt;
          e.group.position.y -= dt * 0.5;
          if (e.fade > 3) {
            scene.remove(e.group);
            enemies.splice(enemies.indexOf(e), 1);
          }
          continue;
        }
        const dx = G.playerPos.x - e.pos.x;
        const dz = G.playerPos.z - e.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.5) {
          e.pos.x += (dx / d) * e.speed * dt;
          e.pos.z += (dz / d) * e.speed * dt;
          e.group.rotation.y = Math.atan2(dx, dz);
        }
        city.collide(e.pos, 0.6);
        e.cooldown -= dt;
        if (d < 2 && e.cooldown <= 0 && !G.inCar) {
          e.cooldown = 1.1;
          G.health -= 8;
          lastHurt = now;
          onEvent({ type: 'hurt', text: '' });
        }
      }
      // slow health regen when safe
      if (now - lastHurt > 5 && G.health > 0 && G.health < 100) {
        G.health = Math.min(100, G.health + 2 * dt);
      }
    },
    punch(G, onEvent) {
      const now = G.time;
      if (now - lastPunch < 0.45) return;
      lastPunch = now;
      let hit = false;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(G.playerPos.x - e.pos.x, G.playerPos.z - e.pos.z);
        if (d < 2.4) {
          e.health -= 25;
          e.pos.x += Math.sin(G.playerHeading) * 1.2;
          e.pos.z += Math.cos(G.playerHeading) * 1.2;
          hit = true;
          if (e.health <= 0) {
            e.dead = true;
            e.group.rotation.x = -Math.PI / 2;
            G.money += 50;
            onEvent({ type: 'kill', text: 'Guard down. +$50' });
          }
        }
      }
      onEvent({ type: 'punch', hit });
    },
    shoot(G, camera, onEvent) {
      const now = G.time;
      if (!G.hasWeapon || now - lastShot < 0.35 || G.inCar) return;
      lastShot = now;
      // raycast-ish: nearest enemy near the camera forward line
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      let best = null;
      let bestD = 60;
      for (const e of enemies) {
        if (e.dead) continue;
        const to = new THREE.Vector3(e.pos.x - camera.position.x, 1.4 - camera.position.y, e.pos.z - camera.position.z);
        const dist = to.length();
        if (dist < bestD && to.normalize().dot(dir) > 0.94) {
          best = e;
          bestD = dist;
        }
      }
      if (best) {
        best.health -= 40;
        if (best.health <= 0) {
          best.dead = true;
          best.group.rotation.x = -Math.PI / 2;
          G.money += 50;
          onEvent({ type: 'kill', text: 'Guard down. +$50' });
        } else {
          onEvent({ type: 'shot', hit: true, at: best.pos });
        }
      } else {
        onEvent({ type: 'shot', hit: false });
      }
    },
  };
}
