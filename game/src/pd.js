// Neon Bay v7 — Bay City PD. One cruiser per wanted star (up to 4). Cruisers
// chase Rico, flash their light bars, ram when close, and each carries a callsign
// plus a live role and distance for the HUD's police-response panel.
import * as THREE from 'three';
import { buildCarMesh } from './traffic.js';
import { GRID, collideSolids, clampToBounds } from './metropolis.js';

const CALLSIGNS = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9'];

export function createPD(scene, city, traffic) {
  const units = []; // active cruisers
  let wanted = 0;
  let spawnTimer = 0;
  let decayTimer = 0;
  let nextCallsign = 0;

  function spawnAt(x, z) {
    // Place exactly where asked: the caller picks street coordinates.
    const mesh = buildCarMesh(0x1a1d24, true);
    const car = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      yaw: 0,
      speed: 0,
      isPolice: true,
      kind: 'police',
      radius: 2.0,
      sirenPhase: Math.random() * 6,
      callsign: CALLSIGNS[nextCallsign % CALLSIGNS.length],
      prevDist: Infinity,
      role: 'RESPONDING',
    };
    nextCallsign += 1;
    scene.add(mesh);
    units.push(car);
    traffic.cars.push(car);
    return car;
  }

  function spawnNear(target) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 15;
    const x = target.x + Math.cos(angle) * dist;
    const z = target.z + Math.sin(angle) * dist;
    return spawnAt(Math.max(-GRID.half, Math.min(GRID.half, x)), Math.max(-GRID.half, Math.min(GRID.half, z)));
  }

  function removeUnit(car) {
    scene.remove(car.mesh);
    const i = units.indexOf(car);
    if (i >= 0) units.splice(i, 1);
    const j = traffic.cars.indexOf(car);
    if (j >= 0) traffic.cars.splice(j, 1);
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(4, n));
  }

  // Live roster for the HUD: callsign, role from real behaviour, distance in metres.
  function roster(targetPos) {
    return units.map((u) => {
      const dist = Math.round(Math.hypot(u.pos.x - targetPos.x, u.pos.z - targetPos.z));
      let role = 'RESPONDING';
      if (dist < 8) role = 'RAMMING';
      else if (dist < u.prevDist) role = 'PURSUIT';
      u.prevDist = dist;
      u.role = role;
      return { callsign: u.callsign, role, dist };
    });
  }

  function update(dt, targetPos, targetSpeed, onDamage, now, inCar) {
    spawnTimer -= dt;
    // Keep one cruiser per wanted star.
    while (units.length < wanted && spawnTimer <= 0) {
      spawnNear(targetPos);
      spawnTimer = 1.2;
    }
    while (units.length > wanted) removeUnit(units[units.length - 1]);

    let nearest = Infinity;
    for (const u of units) {
      const dx = targetPos.x - u.pos.x;
      const dz = targetPos.z - u.pos.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      // Steer toward Rico.
      const want = Math.atan2(dx, dz);
      let d = want - u.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      u.yaw += d * Math.min(1, dt * 3.2);
      const cruise = 15 + wanted * 2.2;
      u.speed = Math.min(cruise, u.speed + dt * 1.4);
      u.pos.x += Math.sin(u.yaw) * u.speed * dt;
      u.pos.z += Math.cos(u.yaw) * u.speed * dt;
      collideSolids(u.pos, u.radius, city.solids);
      clampToBounds(u.pos, city.bounds);
      u.mesh.position.copy(u.pos);
      u.mesh.rotation.y = u.yaw;
      // Light bar flashes red/blue every 350 ms.
      const phase = Math.floor(now * 1000 / 350) % 2 === 0;
      const bar = u.mesh.userData.lightBar;
      if (bar) {
        bar.userData.red.emissiveIntensity = phase ? 2.4 : 0.15;
        bar.userData.blue.emissiveIntensity = phase ? 0.15 : 2.4;
      }
      // Ram: shove + damage when very close, with a cooldown. A cruiser hits
      // harder against a car than against a man on foot.
      u.ramCooldown = (u.ramCooldown || 0) - dt;
      if (dist < 3.4 && u.ramCooldown <= 0) {
        u.ramCooldown = 1.8;
        const push = new THREE.Vector3(dx / (dist || 1), 0, dz / (dist || 1));
        onDamage(inCar ? 10 : 4, push, inCar);
      }
    }
    // Wanted decays when Rico has escaped far away.
    if (wanted > 0 && nearest > 45) {
      decayTimer += dt;
      if (decayTimer > 8) { wanted -= 1; decayTimer = 0; }
    } else {
      decayTimer = 0;
    }
  }

  return {
    units,
    get wanted() { return wanted; },
    setWanted,
    addWanted(n) { setWanted(wanted + n); },
    spawnAt,
    spawnNear,
    roster,
    update,
  };
}
