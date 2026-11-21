// Police: one cruiser per wanted star (0-4). Cruisers spawn near the player,
// chase, flash their light bars, and ram when very close. Wanted decays when
// the player escapes far away. Each cruiser has a fixed callsign and exposes
// its live role and distance for the HUD panel.
import * as THREE from 'three';
import { makeRng, range, pick } from './rng.js';
import { buildCarMesh } from './autos.js';

export const CALLSIGNS = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9'];

export function buildPatrol(scene, seed, collide, clampPos) {
  const rng = makeRng(seed + 33);
  const cruisers = [];
  for (let i = 0; i < 4; i++) {
    const mesh = buildCarMesh(0x1a1a22, true);
    mesh.group.visible = false;
    scene.add(mesh.group);
    cruisers.push({
      mesh, callsign: CALLSIGNS[i],
      x: 0, z: 0, yaw: 0, v: 0, active: false,
      ramCooldown: 0, role: 'RESPONDING', dist: 0,
    });
  }

  let wanted = 0;
  let farTimer = 0;

  function setWanted(n) {
    wanted = Math.max(0, Math.min(4, n));
  }
  function raiseWanted(n) {
    setWanted(wanted + n);
  }
  function getWanted() {
    return wanted;
  }

  function spawnNear(px, pz) {
    for (let i = 0; i < wanted; i++) {
      const c = cruisers[i];
      if (c.active) continue;
      const a = range(rng, 0, Math.PI * 2);
      const d = range(rng, 26, 40);
      c.x = px + Math.cos(a) * d;
      c.z = pz + Math.sin(a) * d;
      const [kx, kz] = clampPos(c.x, c.z);
      c.x = kx;
      c.z = kz;
      c.yaw = Math.atan2(px - c.x, pz - c.z);
      c.v = 0;
      c.active = true;
      c.mesh.group.visible = true;
    }
    for (let i = wanted; i < 4; i++) {
      cruisers[i].active = false;
      cruisers[i].mesh.group.visible = false;
    }
  }

  // Chase: steer toward the player, cruise speed rising with wanted.
  // Returns the ram event (damage + shove) when a cruiser hits the player.
  function step(dt, px, pz, playerInCar, onRam) {
    spawnNear(px, pz);
    const cruise = 13 + wanted * 2.5;
    let nearest = 1e9;
    for (const c of cruisers) {
      if (!c.active) continue;
      const dx = px - c.x;
      const dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      c.dist = d;
      nearest = Math.min(nearest, d);
      const want = Math.atan2(dx, dz);
      let diff = want - c.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      c.v = Math.min(cruise, c.v + 12 * dt);
      const nx = c.x + Math.sin(c.yaw) * c.v * dt;
      const nz = c.z + Math.cos(c.yaw) * c.v * dt;
      const [cx, cz] = collide(nx, nz, 1.6);
      const [kx, kz] = clampPos(cx, cz);
      c.x = kx;
      c.z = kz;
      c.mesh.group.position.set(c.x, 0, c.z);
      c.mesh.group.rotation.y = c.yaw;
      // Flash the light bar, alternating red and blue.
      const phase = Math.floor(performance.now() / 180) % 2 === 0;
      if (c.mesh.barL) c.mesh.barL.material.emissiveIntensity = phase ? 4 : 0.4;
      if (c.mesh.barR) c.mesh.barR.material.emissiveIntensity = phase ? 0.4 : 4;
      // Role from real behaviour.
      c.role = d < 7 ? 'RAMMING' : d < 30 ? 'PURSUIT' : 'RESPONDING';
      if (c.ramCooldown > 0) c.ramCooldown -= dt;
      if (d < 4.2 && c.ramCooldown <= 0) {
        c.ramCooldown = 1.4;
        if (onRam) onRam(c);
      }
    }
    // Wanted decays when the player is far from every cruiser.
    if (wanted > 0) {
      if (nearest > 95) {
        farTimer += dt;
        if (farTimer > 6) {
          setWanted(wanted - 1);
          farTimer = 0;
        }
      } else {
        farTimer = 0;
      }
    }
    return nearest;
  }

  function panelLines() {
    const lines = [];
    for (const c of cruisers) {
      if (!c.active) continue;
      lines.push(`${c.callsign} · ${c.role} · ${Math.round(c.dist)}m`);
    }
    return lines;
  }

  function count() {
    let n = 0;
    for (const c of cruisers) if (c.active) n++;
    return n;
  }

  function positions() {
    return cruisers.filter((c) => c.active).map((c) => [c.x, c.z]);
  }

  // Place cruisers at fixed offsets for a staged shot (chase shot).
  // The car faces north; the near cruisers sit to its SIDES (west-behind
  // and east-behind), never directly behind it, so from the south-east
  // camera none of them hides the player car. The far pair sit ahead.
  function stageChase(px, pz, playerYaw) {
    setWanted(4);
    const spots = [
      { dx: -12, dz: 10 },
      { dx: 15, dz: 5 },
      { dx: -10, dz: -16 },
      { dx: 10, dz: -14 },
    ];
    for (let i = 0; i < 4; i++) {
      const c = cruisers[i];
      c.x = px + spots[i].dx;
      c.z = pz + spots[i].dz;
      c.yaw = Math.atan2(px - c.x, pz - c.z);
      c.v = 0;
      c.active = true;
      c.dist = Math.hypot(px - c.x, pz - c.z);
      c.role = c.dist < 30 ? 'PURSUIT' : 'RESPONDING';
      if (i === 0) c.role = 'RAMMING';
      c.mesh.group.visible = true;
      c.mesh.group.position.set(c.x, 0, c.z);
      c.mesh.group.rotation.y = c.yaw;
    }
  }

  function hideAll() {
    for (const c of cruisers) {
      c.active = false;
      c.mesh.group.visible = false;
    }
  }

  return {
    setWanted, raiseWanted, getWanted, step, panelLines, count, positions,
    stageChase, hideAll, cruisers,
  };
}
