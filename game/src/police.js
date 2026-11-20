// police.js — the wanted system: stealing a car raises stars, cruisers spawn
// and chase, rams are dt-scaled so they hit the same at any frame rate, and
// the heat decays once Rico escapes their sight.
import * as THREE from 'three';
import { collideBuildings, clampToCity, CITY } from './city.js';
import { buildCarMesh } from './vehicles.js';

// Callsigns handed out in spawn order, so the HUD can name each unit.
const CALLSIGNS = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9'];

export function createPolice(scene, city, vehicles) {
  const cruisers = [];
  let wanted = 0;
  let decayTimer = 0;
  let ramCooldown = 0;
  let spawnCooldown = 0;
  let spawnCount = 0;
  let lastTarget = { x: 0, z: 0 };

  function spawnNear(targetPos) {
    // Spawn on a street a little way from the player, so the chase reads.
    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 15;
    let x = targetPos.x + Math.cos(angle) * dist;
    let z = targetPos.z + Math.sin(angle) * dist;
    x = Math.max(-CITY.half + 4, Math.min(CITY.half - 4, x));
    z = Math.max(-CITY.half + 4, Math.min(CITY.half - 4, z));
    return spawnAt(x, z);
  }

  // Spawn a cruiser at an exact spot (used to stage a close chase for shots).
  function spawnAt(x, z) {
    // Snap onto the nearest street centre so the cruiser starts on a road.
    const nearest = CITY.streetCenters.reduce((a, b) =>
      Math.abs(b - x) < Math.abs(a - x) ? b : a, CITY.streetCenters[0]);
    const mesh = buildCarMesh(0x1a1d24, true);
    mesh.position.set(nearest, 0, z);
    scene.add(mesh);
    const unit = {
      mesh,
      pos: new THREE.Vector3(nearest, 0, z),
      yaw: 0,
      speed: 0,
      isPolice: true,
      kind: 'police',
      radius: 2.0,
      sirenPhase: Math.random() * 6,
      callsign: CALLSIGNS[spawnCount % CALLSIGNS.length],
      prevDist: Infinity,
    };
    spawnCount += 1;
    cruisers.push(unit);
    vehicles.cars.push(unit);
    return unit;
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(4, n));
    decayTimer = 0;
  }

  function addWanted(n) {
    setWanted(wanted + n);
  }

  // What the HUD shows: one line per active cruiser — callsign, the role its
  // live behaviour gives it, and its distance to the player in whole metres.
  function units() {
    return cruisers.map((unit) => {
      const dist = Math.hypot(unit.pos.x - lastTarget.x, unit.pos.z - lastTarget.z);
      let role = 'RESPONDING';
      if (dist < 8) role = 'RAMMING';
      else if (dist < unit.prevDist) role = 'PURSUIT';
      unit.prevDist = dist;
      return { callsign: unit.callsign, role, dist: Math.round(dist) };
    });
  }

  function update(dt, targetPos, targetSpeed, onDamage, inCar) {
    lastTarget = targetPos;
    if (ramCooldown > 0) ramCooldown -= dt;
    if (spawnCooldown > 0) spawnCooldown -= dt;

    // Keep one cruiser per star, up to four.
    if (wanted > cruisers.length && spawnCooldown <= 0) {
      spawnNear(targetPos);
      spawnCooldown = 1.2;
    }
    // Extra cruisers leave when the heat drops.
    while (cruisers.length > wanted) {
      const unit = cruisers.pop();
      scene.remove(unit.mesh);
      const i = vehicles.cars.indexOf(unit);
      if (i >= 0) vehicles.cars.splice(i, 1);
    }

    // Chase: steer toward the player, accelerate, ram on contact (dt-scaled).
    for (const unit of cruisers) {
      const dx = targetPos.x - unit.pos.x;
      const dz = targetPos.z - unit.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - unit.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      unit.yaw += dy * Math.min(1, dt * 3.2);

      const cruise = 15 + wanted * 2.2;
      unit.speed += (cruise - unit.speed) * Math.min(1, dt * 1.4);
      unit.pos.x += Math.sin(unit.yaw) * unit.speed * dt;
      unit.pos.z += Math.cos(unit.yaw) * unit.speed * dt;
      collideBuildings(unit.pos, unit.radius, city.buildings);
      clampToCity(unit.pos, city.bounds - 2);
      unit.mesh.position.copy(unit.pos);
      unit.mesh.rotation.y = unit.yaw;

      // Light bar flashes red / blue, alternating by time.
      const bar = unit.mesh.userData.lightBar;
      if (bar) {
        const redOn = Math.floor(performance.now() / 350) % 2 === 0;
        bar.userData.red.material.emissiveIntensity = redOn ? 2.4 : 0.15;
        bar.userData.blue.material.emissiveIntensity = redOn ? 0.15 : 2.4;
      }

      // Ram: a dt-scaled shove and damage, with a cooldown so it is not a blender.
      // A cruiser ramming a car hits hard; ramming a man on foot is a shove,
      // not a killing blow — an on-foot Rico must be able to outrun the heat
      // to the next job instead of dying on the sidewalk.
      if (dist < 3.4 && ramCooldown <= 0) {
        ramCooldown = 2.0;
        const shove = 9 * dt;
        const nx = dx / Math.max(0.1, dist);
        const nz = dz / Math.max(0.1, dist);
        onDamage(inCar ? 9 : 3, { x: nx * shove, z: nz * shove });
      }
    }

    // Wanted decays once no cruiser is close enough to see the player.
    if (wanted > 0) {
      const nearest = cruisers.reduce((m, c) =>
        Math.min(m, Math.hypot(c.pos.x - targetPos.x, c.pos.z - targetPos.z)), Infinity);
      if (nearest > 45) {
        decayTimer += dt;
        if (decayTimer > 8) {
          setWanted(wanted - 1);
          decayTimer = 0;
        }
      } else {
        decayTimer = 0;
      }
    }
  }

  return { police: cruisers, get wanted() { return wanted; }, setWanted, addWanted, update, spawnAt, units };
}
