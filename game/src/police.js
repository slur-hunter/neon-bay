// Police: wanted level 0-4, one cruiser per star. Cruisers chase the
// player, flash their light bars and ram when very close. Each cruiser
// carries a callsign and exposes a live role and distance for the HUD
// panel. Role is derived from real behaviour only: RAMMING under 7 m,
// PURSUIT under 30 m, RESPONDING otherwise. No staged overrides.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';
import { clamp, dist2, yawTo } from './rng.js';

export const CALLSIGNS = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9'];

export function roleFor(dist) {
  if (dist < 7) return 'RAMMING';
  if (dist < 30) return 'PURSUIT';
  return 'RESPONDING';
}

export function makePolice(scene, city) {
  const list = [];
  let wanted = 0;
  let quietTimer = 0;

  function spawnNear(px, pz, callsign) {
    const { group, barL, barR } = makeCarMesh(0, true);
    const a = Math.random() * Math.PI * 2;
    const x = clamp(px + Math.sin(a) * 26, -180, 180);
    const z = clamp(pz + Math.cos(a) * 26, -180, 180);
    group.position.set(x, 0, z);
    scene.add(group);
    const cruiser = {
      group, barL, barR, callsign,
      x, z, yaw: 0, speed: 0, dist: 99, role: 'RESPONDING',
      ramCooldown: 0, flash: Math.random() * 0.5,
    };
    list.push(cruiser);
    return cruiser;
  }

  function syncWanted(target) {
    wanted = clamp(target, 0, 4);
    while (list.length < wanted) spawnNear(0, 40, CALLSIGNS[list.length]);
    while (list.length > wanted) {
      const c = list.pop();
      scene.remove(c.group);
    }
  }

  function setWanted(n) {
    syncWanted(n);
  }

  function raiseWanted(n) {
    syncWanted(wanted + n);
  }

  // dt step: chase, ram, flash bars, decay wanted when the player escapes.
  // Returns total ram damage dealt this frame (for the HUD damage bar).
  function step(dt, px, pz, playerSpeed, onRam) {
    let ramDamage = 0;
    let anyClose = false;
    for (const c of list) {
      const d = dist2(c.x, c.z, px, pz);
      c.dist = d;
      c.role = roleFor(d);
      if (d < 60) anyClose = true;
      // Staged cruisers hold their marks (a shot freezes them so the
      // framing survives the 4 s readiness wait); only their distance,
      // role and light bar stay live.
      if (!c.staged) {
        const targetSpeed = 10 + wanted * 2.4;
        c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 0.8);
        const want = yawTo(c.x, c.z, px, pz);
        let dy = want - c.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        c.yaw += clamp(dy, -2.4 * dt, 2.4 * dt);
        const nx = c.x + Math.sin(c.yaw) * c.speed * dt;
        const nz = c.z + Math.cos(c.yaw) * c.speed * dt;
        const fixed = city.collide(nx, nz, 1.7);
        const cl = city.clampPos(fixed.x, fixed.z);
        c.x = cl.x;
        c.z = cl.z;
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.yaw;
      }
      // Flash the light bar: alternate red/blue halves.
      c.flash += dt * 9;
      const on = Math.floor(c.flash) % 2 === 0;
      if (c.barL && c.barR) {
        c.barL.material.color.setHex(on ? 0xff2020 : 0x501010);
        c.barR.material.color.setHex(on ? 0x102050 : 0x2050ff);
      }
      if (c.ramCooldown > 0) c.ramCooldown -= dt;
      if (!c.staged && d < 3.4 && c.ramCooldown <= 0) {
        c.ramCooldown = 1.6;
        ramDamage += 7;
        if (onRam) onRam(c);
      }
    }
    // Wanted decays after 6 s with every cruiser far away.
    if (wanted > 0 && !anyClose) {
      quietTimer += dt;
      if (quietTimer > 6) {
        syncWanted(wanted - 1);
        quietTimer = 0;
      }
    } else {
      quietTimer = 0;
    }
    return ramDamage;
  }

  function placeStaged(x, z, yaw, callsign) {
    const { group, barL, barR } = makeCarMesh(0, true);
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    scene.add(group);
    const cruiser = {
      group, barL, barR, callsign,
      x, z, yaw, speed: 0, dist: 99, role: 'RESPONDING',
      ramCooldown: 0, flash: Math.random() * 0.5, staged: true,
    };
    list.push(cruiser);
    return cruiser;
  }

  function clear() {
    for (const c of list) scene.remove(c.group);
    list.length = 0;
    wanted = 0;
  }

  return {
    list, syncWanted, setWanted, raiseWanted, step, placeStaged, clear,
    get wanted() { return wanted; },
  };
}
