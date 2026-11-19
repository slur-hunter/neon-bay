// Neon Bay — combat.js: fists, the pistol at the docks, and the three bank guards.
// One clear job: let the player fight, and make fights cost health and heat.
import * as THREE from 'three';
import { LANDMARKS } from './city.js';

const PISTOL_DAMAGE = 34;
const PUNCH_DAMAGE = 25;
const GUARD_HEALTH = 100;
const MAX_AMMO = 12;

/** Builds one bank guard: dark suit, cap, and a pistol. */
function buildGuard() {
  const g = new THREE.Group();
  g.name = 'guard';
  const suit = new THREE.MeshStandardMaterial({ color: 0x1c1c26, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.8 });
  const tie = new THREE.MeshStandardMaterial({ color: 0xd81f2a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.5), suit);
  body.position.y = 1.25;
  body.castShadow = true;
  g.add(body);
  const tieMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.06), tie);
  tieMesh.position.set(0, 1.35, 0.28);
  g.add(tieMesh);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.44), skin);
  head.position.y = 2.0;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 10), suit);
  cap.position.y = 2.28;
  g.add(cap);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.4, metalness: 0.6 }));
  gun.position.set(0.5, 1.4, 0.3);
  g.add(gun);
  return g;
}

/** Runs fists, the pistol, the guards and the player's health. */
export function createCombat(scene, city, G) {
  void city;
  let hasPistol = false;
  let ammo = 0;
  let punchCooldown = 0;
  let shootCooldown = 0;
  let lastHurt = -100;
  const guards = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 70;

  // The pistol pickup on the docks: a floating gun over a gold ring.
  const pickup = new THREE.Group();
  pickup.name = 'pistol-pickup';
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.7), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.3, metalness: 0.7, emissive: 0x332200, emissiveIntensity: 0.5 }));
  pickup.add(gunBody);
  const pickupRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.2, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
  pickupRing.rotation.x = -Math.PI / 2;
  pickupRing.position.y = -0.9;
  pickup.add(pickupRing);
  pickup.position.set(LANDMARKS.docks.x, 1.2, LANDMARKS.docks.z - 4);
  scene.add(pickup);

  function hitTargets() {
    const list = [];
    for (const gd of guards) {
      if (gd.alive) list.push({ mesh: gd.group, kind: 'guard', ref: gd });
    }
    for (const p of G.pedestrians.peds) {
      if (!p.down) list.push({ mesh: p.group, kind: 'ped', ref: p });
    }
    return list;
  }

  return {
    get hasPistol() { return hasPistol; },
    get ammo() { return ammo; },
    guardsAlive() { return guards.filter((gd) => gd.alive).length; },
    /** Puts the three guards on the bank steps for the Spire Job. */
    spawnGuards() {
      if (guards.length) return;
      const spots = [
        [LANDMARKS.bank.x - 8, LANDMARKS.bank.z + 4],
        [LANDMARKS.bank.x, LANDMARKS.bank.z + 6],
        [LANDMARKS.bank.x + 8, LANDMARKS.bank.z + 4],
      ];
      for (const [x, z] of spots) {
        const group = buildGuard();
        group.position.set(x, 0, z);
        scene.add(group);
        guards.push({ group, health: GUARD_HEALTH, alive: true, shootTimer: 1 + Math.random() });
      }
      G.hud.toast('Three guards on the bank steps. They are armed.');
    },
    punch() {
      if (punchCooldown > 0 || G.player.inCar) return;
      punchCooldown = 0.45;
      if (G.audio) G.audio.punch();
      const p = G.player.pos;
      const fwd = { x: Math.sin(G.player.heading), z: Math.cos(G.player.heading) };
      // Guards first: a punch in the arc in front of the player.
      for (const gd of guards) {
        if (!gd.alive) continue;
        const dx = gd.group.position.x - p.x, dz = gd.group.position.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.4 && (dx * fwd.x + dz * fwd.z) / (d || 1) > 0.3) {
          gd.health -= PUNCH_DAMAGE;
          if (G.fx) G.fx.sparks(gd.group.position.x, 1.4, gd.group.position.z, 8);
          if (gd.health <= 0) {
            gd.alive = false;
            gd.group.rotation.x = -Math.PI / 2;
            gd.group.position.y = 0.3;
            G.hud.toast('Guard down.');
          }
          return;
        }
      }
      // Then pedestrians: they go down and run, and the law notices.
      for (const ped of G.pedestrians.peds) {
        if (ped.down) continue;
        const dx = ped.pos.x - p.x, dz = ped.pos.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.4 && (dx * fwd.x + dz * fwd.z) / (d || 1) > 0.3) {
          ped.down = true;
          ped.group.rotation.x = -Math.PI / 2;
          ped.group.position.y = 0.3;
          G.pedestrians.frighten(p.x, p.z, 30);
          G.police.addWanted(1, G.time);
          G.hud.toast('You punched a pedestrian. The police are coming.');
          return;
        }
      }
    },
    shoot() {
      if (!hasPistol || shootCooldown > 0 || G.player.inCar) return;
      if (ammo <= 0) {
        if (G.audio) G.audio.click();
        G.hud.toast('Click. Empty — press R to reload.');
        return;
      }
      shootCooldown = 0.28;
      ammo -= 1;
      if (G.audio) G.audio.gunshot();
      if (G.fx) {
        const c = G.camera;
        const dir = new THREE.Vector3();
        c.getWorldDirection(dir);
        const mx = c.position.x + dir.x * 2, my = c.position.y + dir.y * 2, mz = c.position.z + dir.z * 2;
        G.fx.flash(mx, my, mz);
      }
      // A ray down the crosshair: the first guard or pedestrian it meets takes the hit.
      const dir = new THREE.Vector3();
      G.camera.getWorldDirection(dir);
      raycaster.set(G.camera.position, dir);
      const targets = hitTargets().map((t) => t.mesh);
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length) {
        const hit = hits[0];
        let obj = hit.object;
        while (obj.parent && obj.parent !== scene) obj = obj.parent;
        const entry = hitTargets().find((t) => t.mesh === obj);
        if (entry && entry.kind === 'guard') {
          entry.ref.health -= PISTOL_DAMAGE;
          if (G.fx) G.fx.sparks(hit.point.x, hit.point.y, hit.point.z, 10);
          if (entry.ref.health <= 0) {
            entry.ref.alive = false;
            entry.ref.group.rotation.x = -Math.PI / 2;
            entry.ref.group.position.y = 0.3;
            G.hud.toast('Guard down.');
          }
        } else if (entry && entry.kind === 'ped') {
          entry.ref.down = true;
          entry.ref.group.rotation.x = -Math.PI / 2;
          entry.ref.group.position.y = 0.3;
          G.pedestrians.frighten(entry.ref.pos.x, entry.ref.pos.z, 30);
          G.police.addWanted(1, G.time);
          if (G.fx) G.fx.sparks(hit.point.x, hit.point.y, hit.point.z, 8);
        }
      } else {
        // Missed: sparks where the shot lands, and everyone nearby runs.
        const end = G.camera.position.clone().add(dir.multiplyScalar(50));
        if (G.fx) G.fx.sparks(end.x, Math.max(0.4, end.y), end.z, 5);
        G.pedestrians.frighten(G.player.pos.x, G.player.pos.z, 25);
        G.police.addWanted(1, G.time);
      }
    },
    reload() {
      if (!hasPistol || ammo === MAX_AMMO) return;
      ammo = MAX_AMMO;
      if (G.audio) G.audio.reload();
      G.hud.toast('Reloaded. 12 rounds.');
    },
    /** Guard shooting, health regen, the pickup. Returns 'wasted' at zero health. */
    update(dt) {
      punchCooldown = Math.max(0, punchCooldown - dt);
      shootCooldown = Math.max(0, shootCooldown - dt);
      // The pistol pickup bobs until the player walks over it.
      if (!hasPistol) {
        pickup.rotation.y += dt * 1.5;
        pickup.position.y = 1.2 + Math.sin(performance.now() * 0.003) * 0.15;
        const d = Math.hypot(G.player.pos.x - pickup.position.x, G.player.pos.z - pickup.position.z);
        if (d < 2.5 && !G.player.inCar) {
          hasPistol = true;
          ammo = MAX_AMMO;
          scene.remove(pickup);
          G.hud.toast('Pistol picked up. Click to shoot, R to reload.');
          if (G.audio) G.audio.pickup();
        }
      }
      // Guards shoot back when the player is close and the job is on.
      for (const gd of guards) {
        if (!gd.alive) continue;
        const p = G.player.pos;
        const d = Math.hypot(gd.group.position.x - p.x, gd.group.position.z - p.z);
        gd.group.lookAt(p.x, 0, p.z);
        if (d < 46) {
          gd.shootTimer -= dt;
          if (gd.shootTimer <= 0) {
            gd.shootTimer = 1.1 + Math.random() * 0.7;
            if (G.fx) G.fx.flash(gd.group.position.x, 1.5, gd.group.position.z);
            if (G.audio) G.audio.gunshot();
            const hitChance = 0.42 * (1 - d / 60);
            if (Math.random() < hitChance) {
              G.health = Math.max(0, G.health - 9);
              lastHurt = G.time;
              if (G.fx) G.fx.sparks(p.x, 1.4, p.z, 6);
              if (G.audio) G.audio.hurt();
            }
          }
        }
      }
      // Slow health regen when nobody has hurt the player lately.
      if (G.time - lastHurt > 6 && G.health > 0 && G.health < 100) {
        G.health = Math.min(100, G.health + 2 * dt);
      }
      if (G.health <= 0) return 'wasted';
      return null;
    },
  };
}
