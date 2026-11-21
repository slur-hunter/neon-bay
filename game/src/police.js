// Police: wanted level 0-4, one cruiser per star. Cruisers chase, flash
// their light bars, and ram. The panel role is derived from the LIVE distance:
// RAMMING under 7 m, PURSUIT under 30 m, RESPONDING otherwise.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';
import { Rng } from './rng.js';
import { PITCH } from './city.js';

export const CALLSIGNS = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9'];

export function roleFor(dist) {
  if (dist < 7) return 'RAMMING';
  if (dist < 30) return 'PURSUIT';
  return 'RESPONDING';
}

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(99);
    this.wanted = 0;
    this.cruisers = [];
    this.decayTimer = 0;
    this.flashT = 0;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(4, n));
    this.syncCruisers();
  }

  raiseWanted(n) {
    this.setWanted(this.wanted + n);
  }

  syncCruisers() {
    while (this.cruisers.length < this.wanted) {
      const mesh = makeCarMesh(0x16161f, true);
      this.scene.add(mesh.group);
      this.cruisers.push({
        mesh,
        callsign: CALLSIGNS[this.cruisers.length],
        x: 0,
        z: 0,
        yaw: 0,
        speed: 0,
        ramCd: 0,
        dist: 999,
      });
    }
    while (this.cruisers.length > this.wanted) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh.group);
    }
  }

  spawnNear(playerPos) {
    for (const c of this.cruisers) {
      // a street point roughly 45 m from the player
      for (let tries = 0; tries < 12; tries++) {
        const p = this.city.streetPoint();
        const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
        if (d > 35 && d < 60) {
          c.x = p.x;
          c.z = p.z;
          c.yaw = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
          c.speed = 0;
          break;
        }
      }
    }
  }

  // Place a cruiser at an exact spot for a staged shot.
  placeAt(i, x, z, yaw) {
    const c = this.cruisers[i];
    if (!c) return null;
    c.x = x;
    c.z = z;
    c.yaw = yaw;
    c.speed = 0;
    c.ramCd = 1;
    c.mesh.group.position.set(x, 0, z);
    c.mesh.group.rotation.y = yaw;
    return c;
  }

  panel() {
    return this.cruisers.map((c) => ({
      name: c.callsign,
      role: roleFor(c.dist),
      dist: Math.round(c.dist),
    }));
  }

  update(dt, playerPos, playerSpeed, frozen, onRam) {
    this.flashT += dt;
    const on = Math.floor(this.flashT * 6) % 2 === 0;
    for (const c of this.cruisers) {
      if (c.mesh.barL) c.mesh.barL.material.emissiveIntensity = on ? 3 : 0.4;
      if (c.mesh.barR) c.mesh.barR.material.emissiveIntensity = on ? 0.4 : 3;
      c.dist = Math.hypot(c.x - playerPos.x, c.z - playerPos.z);
      if (frozen) {
        c.mesh.group.position.set(c.x, 0, c.z);
        c.mesh.group.rotation.y = c.yaw;
        continue;
      }
      c.ramCd -= dt;
      const want = Math.atan2(playerPos.x - c.x, playerPos.z - c.z);
      let diff = want - c.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const target = 11 + this.wanted * 2.4;
      c.speed += (target - c.speed) * Math.min(1, dt * 0.8);
      if (c.dist < 4) c.speed = Math.min(c.speed, 6);
      c.x += Math.sin(c.yaw) * c.speed * dt;
      c.z += Math.cos(c.yaw) * c.speed * dt;
      this.city.collideCircle(c, 1.7);
      c.mesh.group.position.set(c.x, 0, c.z);
      c.mesh.group.rotation.y = c.yaw;
      if (c.dist < 3.4 && c.ramCd <= 0) {
        c.ramCd = 1.6;
        if (onRam) onRam(c);
      }
    }
    // wanted decays when every cruiser is far away for a while
    if (this.wanted > 0) {
      const far = this.cruisers.every((c) => c.dist > 60);
      if (far) {
        this.decayTimer += dt;
        if (this.decayTimer > 6) {
          this.decayTimer = 0;
          this.setWanted(this.wanted - 1);
        }
      } else {
        this.decayTimer = 0;
      }
    }
  }
}
