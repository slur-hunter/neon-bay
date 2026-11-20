// Bay City PD: one cruiser per wanted star, up to four. Cruisers spawn near
// the player, chase, flash their light bars and ram when they get close.
// Each cruiser carries a callsign and reports a live role and distance so
// the HUD's police panel shows the response as it really is.

import * as THREE from 'three';
import { buildCarMesh } from './autos.js';
import { collideBuildings, clampToCity, nearestStreet } from './city.js';

export const CALLSIGNS = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9'];

export function createPatrol(scene, city, autos) {
  const police = [];
  let wanted = 0;
  let spawnCooldown = 0;
  let decayTimer = 0;
  let flashPhase = 0;

  function spawnAt(x, z) {
    const snappedX = nearestStreet(x);
    const mesh = buildCarMesh(0x1a1d24, true);
    mesh.position.set(snappedX, 0, z);
    scene.add(mesh);
    const unit = {
      mesh,
      pos: mesh.position,
      yaw: 0,
      speed: 0,
      isPolice: true,
      kind: 'police',
      radius: 2.0,
      callsign: CALLSIGNS[police.length % CALLSIGNS.length],
      prevDist: null,
      ramCooldown: 0,
      sirenPhase: Math.random() * 6,
    };
    police.push(unit);
    autos.cars.push(unit);
    return unit;
  }

  function spawnNear(target) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 15;
    const x = target.x + Math.cos(angle) * dist;
    const z = target.z + Math.sin(angle) * dist;
    const clamped = clampToCity(new THREE.Vector3(x, 0, z), city.bounds);
    return spawnAt(clamped.x, clamped.z);
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(4, n));
  }

  function addWanted(n) {
    setWanted(wanted + n);
  }

  // The HUD panel reads this every frame: callsign, live role, live metres.
  function units(target) {
    return police.map((unit) => {
      const dist = Math.hypot(unit.pos.x - target.x, unit.pos.z - target.z);
      let role = 'RESPONDING';
      if (dist < 8) role = 'RAMMING';
      else if (unit.prevDist !== null && dist < unit.prevDist - 0.05) role = 'PURSUIT';
      unit.prevDist = dist;
      return { callsign: unit.callsign, role, dist: Math.round(dist) };
    });
  }

  function update(dt, targetPos, inCar, onDamage) {
    spawnCooldown -= dt;
    flashPhase += dt;
    // Keep one cruiser per wanted star.
    while (police.length < wanted && spawnCooldown <= 0) {
      spawnNear(targetPos);
      spawnCooldown = 1.2;
    }
    while (police.length > wanted) {
      const unit = police.pop();
      scene.remove(unit.mesh);
      const idx = autos.cars.indexOf(unit);
      if (idx !== -1) autos.cars.splice(idx, 1);
    }

    let nearest = Infinity;
    for (const unit of police) {
      const dx = targetPos.x - unit.pos.x;
      const dz = targetPos.z - unit.pos.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);

      // Steer toward the player and accelerate.
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - unit.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      unit.yaw += dy * Math.min(1, dt * 3.2);
      const cruise = 15 + wanted * 2.2;
      unit.speed = Math.min(cruise, unit.speed + 14 * dt);
      unit.pos.x += Math.sin(unit.yaw) * unit.speed * dt;
      unit.pos.z += Math.cos(unit.yaw) * unit.speed * dt;
      collideBuildings(unit.pos, unit.radius, city.buildings);
      clampToCity(unit.pos, city.bounds);
      unit.mesh.position.copy(unit.pos);
      unit.mesh.rotation.y = unit.yaw;

      // Light bar: red and blue alternate every 350 ms.
      const bar = unit.mesh.userData.lightBar;
      if (bar) {
        const on = Math.floor(flashPhase / 0.35) % 2 === 0;
        bar.userData.red.material.emissiveIntensity = on ? 2.4 : 0.15;
        bar.userData.blue.material.emissiveIntensity = on ? 0.15 : 2.4;
      }

      // Ram: a shove plus damage, with a cooldown so it never stun-locks.
      unit.ramCooldown -= dt;
      if (dist < 3.4 && unit.ramCooldown <= 0) {
        unit.ramCooldown = 1.8;
        const push = 9 * dt;
        const px = dx / (dist || 1);
        const pz = dz / (dist || 1);
        onDamage(inCar ? 10 : 4, { x: px * push, z: pz * push });
      }
    }

    // Wanted fades when the nearest cruiser is far away for a while.
    if (wanted > 0 && nearest > 45) {
      decayTimer += dt;
      if (decayTimer > 8) {
        decayTimer = 0;
        setWanted(wanted - 1);
      }
    } else {
      decayTimer = 0;
    }
  }

  return {
    police,
    get wanted() {
      return wanted;
    },
    setWanted,
    addWanted,
    update,
    spawnAt,
    units,
  };
}
