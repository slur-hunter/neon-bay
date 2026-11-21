// Police: one cruiser per wanted star. Cruisers spawn near the player,
// chase, flash their light bars, and ram when very close. Each carries a
// callsign and exposes its live role and distance for the HUD panel.
import * as THREE from 'three';
import { makeCarMesh } from './autos.js';
import { CITY_HALF } from './city.js';

export const CALLSIGNS = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9'];

export function buildPatrol(scene, rng, collide) {
  const cops = [];
  let flash = 0;
  return {
    cops,
    count: () => cops.length,
    sync(wanted, px, pz) {
      while (cops.length < wanted) {
        const a = rng.range(0, Math.PI * 2);
        const d = rng.range(26, 40);
        const x = Math.max(-CITY_HALF + 6, Math.min(CITY_HALF - 6, px + Math.sin(a) * d));
        const z = Math.max(-CITY_HALF + 6, Math.min(CITY_HALF - 6, pz + Math.cos(a) * d));
        const { group, barL, barR } = makeCarMesh(0x1a1a22, true);
        group.position.set(x, 0, z);
        scene.add(group);
        cops.push({
          group, barL, barR,
          callsign: CALLSIGNS[cops.length % CALLSIGNS.length],
          x, z, yaw: 0, speed: 0, ramCooldown: 0, role: 'RESPONDING', dist: d,
        });
      }
      while (cops.length > wanted) {
        const c = cops.pop();
        scene.remove(c.group);
      }
    },
    update(dt, px, pz, wanted, onRam) {
      flash += dt * 9;
      const phase = Math.sin(flash) > 0;
      for (const c of cops) {
        const dx = px - c.x, dz = pz - c.z;
        const dist = Math.hypot(dx, dz);
        c.dist = dist;
        const targetYaw = Math.atan2(dx, dz);
        let dy = targetYaw - c.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        c.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
        const cruise = 13 + wanted * 2.2;
        c.speed += (cruise - c.speed) * Math.min(1, dt * 0.8);
        const nx = c.x + Math.sin(c.yaw) * c.speed * dt;
        const nz = c.z + Math.cos(c.yaw) * c.speed * dt;
        const fixed = collide(nx, nz, 2.2);
        c.x = fixed.x; c.z = fixed.z;
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.yaw;
        c.ramCooldown -= dt;
        if (dist < 3.4 && c.ramCooldown <= 0) {
          c.ramCooldown = 2.0;
          onRam(c);
        }
        c.role = dist < 8 ? 'RAMMING' : (dist < 30 ? 'PURSUIT' : 'RESPONDING');
        if (c.barL && c.barR) {
          c.barL.material.color.setHex(phase ? 0xff2020 : 0x551010);
          c.barR.material.color.setHex(phase ? 0x102050 : 0x2050ff);
        }
      }
    },
    placeNear(px, pz, n) {
      // Stage n cruisers in a visible fan ahead of the player for a shot.
      const out = [];
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 9;
        const x = px + off;
        const z = pz + 16 + i * 5;
        const { group, barL, barR } = makeCarMesh(0x1a1a22, true);
        group.position.set(x, 0, z);
        group.rotation.y = Math.PI;
        scene.add(group);
        out.push({
          group, barL, barR,
          callsign: CALLSIGNS[i % CALLSIGNS.length],
          x, z, yaw: Math.PI, speed: 0, ramCooldown: 0, role: 'PURSUIT', dist: 18 + i * 5,
        });
      }
      for (const c of out) cops.push(c);
      return out;
    },
  };
}
