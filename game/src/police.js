// police.js — the wanted system: stealing a car raises stars, police cars spawn
// and chase, rams are dt-scaled so they hit the same at any frame rate, and the
// heat decays once the player escapes their sight.
import * as THREE from 'three';
import { collideBuildings, clampToCity, CITY } from './city.js';
import { buildCarMesh } from './vehicles.js';

export function createPolice(scene, city, vehicles) {
  const police = [];
  let wanted = 0;
  let decayTimer = 0;
  let ramCooldown = 0;
  let spawnCooldown = 0;

  function spawnPoliceNear(targetPos) {
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
    const car = {
      mesh, pos: new THREE.Vector3(nearest, 0, z), yaw: 0, speed: 0,
      isPolice: true, kind: 'police', radius: 2.0, sirenPhase: Math.random() * 6,
    };
    police.push(car);
    vehicles.cars.push(car);
    return car;
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(4, n));
    decayTimer = 0;
  }

  function addWanted(n) {
    setWanted(wanted + n);
  }

  function update(dt, targetPos, targetSpeed, onDamage) {
    if (ramCooldown > 0) ramCooldown -= dt;
    if (spawnCooldown > 0) spawnCooldown -= dt;

    // Keep one cruiser per star, up to four.
    if (wanted > police.length && spawnCooldown <= 0) {
      spawnPoliceNear(targetPos);
      spawnCooldown = 1.2;
    }
    // Extra cruisers leave when the heat drops.
    while (police.length > wanted) {
      const car = police.pop();
      scene.remove(car.mesh);
      const i = vehicles.cars.indexOf(car);
      if (i >= 0) vehicles.cars.splice(i, 1);
    }

    // Chase: steer toward the player, accelerate, ram on contact (dt-scaled).
    for (const car of police) {
      const dx = targetPos.x - car.pos.x;
      const dz = targetPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetYaw = Math.atan2(dx, dz);
      let dy = targetYaw - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      car.yaw += dy * Math.min(1, dt * 3.2);

      const cruise = 15 + wanted * 2.2;
      car.speed += (cruise - car.speed) * Math.min(1, dt * 1.4);
      car.pos.x += Math.sin(car.yaw) * car.speed * dt;
      car.pos.z += Math.cos(car.yaw) * car.speed * dt;
      collideBuildings(car.pos, car.radius, city.buildings);
      clampToCity(car.pos, city.bounds - 2);
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.yaw;

      // Light bar flashes red / blue, alternating by time.
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        const phase = Math.floor(performance.now() / 350) % 2 === 0;
        bar.userData.red.material.emissiveIntensity = phase ? 2.4 : 0.15;
        bar.userData.blue.material.emissiveIntensity = phase ? 0.15 : 2.4;
      }

      // Ram: a dt-scaled shove and damage, with a cooldown so it is not a blender.
      if (dist < 3.4 && ramCooldown <= 0) {
        ramCooldown = 0.9;
        const push = 9 * dt * 60 / 60; // dt-scaled impulse, same at any frame rate
        const nx = dx / Math.max(0.1, dist);
        const nz = dz / Math.max(0.1, dist);
        onDamage(9, { x: nx * push, z: nz * push });
      }
    }

    // Wanted decays once no cruiser is close enough to see the player.
    if (wanted > 0) {
      const nearest = police.reduce((m, c) =>
        Math.min(m, Math.hypot(c.pos.x - targetPos.x, c.pos.z - targetPos.z)), Infinity);
      if (nearest > 45) {
        decayTimer += dt;
        if (decayTimer > 8) { setWanted(wanted - 1); decayTimer = 0; }
      } else {
        decayTimer = 0;
      }
    }
  }

  return { police, get wanted() { return wanted; }, setWanted, addWanted, update, spawnAt };
}
