// police.js — wanted-level response: police cars spawn, chase, and ram.
// Every ram and every movement is dt-scaled so the chase is frame-rate independent.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';
import { ROAD_LINES } from './city.js';

const MAX_COPS = 4;

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cops = [];
    this.sirenTime = 0;
    // damage dealt to the player in the last frame (the combat system reads it)
    this.ramDamage = 0;
    this.rammed = false;
  }

  get count() { return this.cops.length; }

  nearestDistance(playerPos) {
    let best = 1e9;
    for (const cop of this.cops) {
      const d = Math.hypot(cop.mesh.position.x - playerPos.x, cop.mesh.position.z - playerPos.z);
      if (d < best) best = d;
    }
    return best;
  }

  // How many cops the wanted level calls for.
  wantedToCount(stars) {
    return Math.min(MAX_COPS, stars);
  }

  spawnCop(playerPos) {
    const mesh = makeCarMesh(0xf2f2f2, true);
    this.scene.add(mesh);
    const road = ROAD_LINES[Math.floor(this.rng() * ROAD_LINES.length)];
    const along = (this.rng() - 0.5) * 200;
    const horizontal = this.rng() > 0.5;
    const x = horizontal ? along : road;
    const z = horizontal ? road : along;
    // never spawn on top of the player
    const dx = x - playerPos.x, dz = z - playerPos.z;
    const d = Math.hypot(dx, dz);
    const sx = d < 35 ? playerPos.x + (dx / (d || 1)) * 45 : x;
    const sz = d < 35 ? playerPos.z + (dz / (d || 1)) * 45 : z;
    mesh.position.set(sx, 0, sz);
    const cop = { mesh, heading: Math.atan2(playerPos.x - sx, playerPos.z - sz), speed: 0 };
    mesh.rotation.y = cop.heading;
    this.cops.push(cop);
    return cop;
  }

  removeCop(cop) {
    this.scene.remove(cop.mesh);
    this.cops.splice(this.cops.indexOf(cop), 1);
  }

  // Keep the active cop count matched to the wanted level, then chase.
  update(dt, playerPos, playerHeading, playerSpeed, stars) {
    this.ramDamage = 0;
    this.rammed = false;
    this.sirenTime += dt;
    const want = this.wantedToCount(stars);
    while (this.cops.length < want) this.spawnCop(playerPos);
    while (this.cops.length > want) this.removeCop(this.cops[0]);
    const flash = Math.floor(this.sirenTime * 4) % 2 === 0;
    for (const cop of this.cops) {
      const bar = cop.mesh.getObjectByName('lightbar');
      if (bar) {
        bar.userData.red.material.color.setHex(flash ? 0xff2020 : 0x550000);
        bar.userData.blue.material.color.setHex(flash ? 0x101080 : 0x2060ff);
      }
      // steer toward the player, with a limited turn rate
      const p = cop.mesh.position;
      const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - cop.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = 2.6;
      cop.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
      // faster than traffic, a little faster than the player's top speed at high stars
      const topSpeed = 24 + stars * 1.5;
      cop.speed = Math.min(topSpeed, cop.speed + 14 * dt);
      const f = { x: Math.sin(cop.heading), z: Math.cos(cop.heading) };
      p.x += f.x * cop.speed * dt;
      p.z += f.z * cop.speed * dt;
      cop.mesh.rotation.y = cop.heading;
      this.city.collideCircle(p, 2.2);
      this.city.clampToCity(p, -2);
      // ram: contact damage is a rate per second, scaled by dt
      if (dist < 3.4) {
        this.ramDamage += 14 * dt;
        this.rammed = true;
        cop.speed *= 0.985;
      }
    }
  }

  clear() {
    for (const cop of [...this.cops]) this.removeCop(cop);
  }
}
