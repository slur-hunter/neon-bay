// createPolice runs the wanted level: stars rise with crimes, police cars
// spawn and chase, and the heat cools off when the player hides.
import * as THREE from 'three';
import { makeCar } from './vehicles.js';

export function createPolice(scene, city, seed) {
  let wanted = 0;
  let quietTime = 0;
  let hiddenTime = 0;
  let decayTimer = 0;
  let bustedTimer = 0;
  const policeCars = [];
  let flashT = 0;

  function spawnPolice(playerPos) {
    const car = makeCar(0xf0f0f0, 'police');
    car.pos = new THREE.Vector3(
      playerPos.x + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 40),
      0,
      playerPos.z + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 40)
    );
    car.pos.x = Math.max(-190, Math.min(190, car.pos.x));
    car.pos.z = Math.max(-190, Math.min(190, car.pos.z));
    car.heading = Math.atan2(playerPos.x - car.pos.x, playerPos.z - car.pos.z);
    car.speed = 20;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    scene.add(car.group);
    policeCars.push(car);
    return car;
  }

  function removePolice(car) {
    scene.remove(car.group);
    const i = policeCars.indexOf(car);
    if (i >= 0) policeCars.splice(i, 1);
  }

  return {
    get wanted() { return wanted; },
    get policeCars() { return policeCars; },
    addWanted(n, reason) {
      const before = wanted;
      wanted = Math.max(0, Math.min(5, wanted + n));
      quietTime = 0;
      hiddenTime = 0;
      return { before, after: wanted, reason };
    },
    clearWanted() {
      wanted = 0;
      for (const car of [...policeCars]) removePolice(car);
    },
    update(dt, G, onBusted, onRam) {
      quietTime += dt;
      flashT += dt;
      const playerPos = G.playerPos;
      // spawn police up to the wanted level (cap 4)
      const want = Math.min(wanted, 4);
      while (policeCars.length < want) spawnPolice(playerPos);
      while (policeCars.length > want) removePolice(policeCars[policeCars.length - 1]);
      // flash the light bars
      const on = Math.floor(flashT * 6) % 2 === 0;
      for (const car of policeCars) {
        if (car.lightBar) {
          car.lightBar.userData.red.material.color.setHex(on ? 0xff2222 : 0x551111);
          car.lightBar.userData.blue.material.color.setHex(on ? 0x111155 : 0x2244ff);
        }
      }
      // chase
      let nearest = Infinity;
      for (const car of policeCars) {
        const dx = playerPos.x - car.pos.x;
        const dz = playerPos.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        nearest = Math.min(nearest, dist);
        const targetHeading = Math.atan2(dx, dz);
        let diff = targetHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
        const targetSpeed = dist > 60 ? 40 : 30 + wanted * 1.5;
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        city.collide(car.pos, 1.6);
        car.group.position.copy(car.pos);
        car.group.rotation.y = car.heading;
        for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;
        // ram the player
        if (dist < 3.4) {
          if (G.inCar) {
            onRam(car, dist);
            car.speed *= 0.5;
            G.inCar.speed *= 0.85;
          } else {
            bustedTimer += dt;
            if (bustedTimer > 1.2) {
              bustedTimer = 0;
              onBusted('The Bay PD caught you.');
            }
          }
        }
      }
      if (nearest > 4) bustedTimer = 0;
      // heat cools off when quiet and unseen
      if (wanted > 0) {
        if (nearest > 45) hiddenTime += dt;
        else hiddenTime = 0;
        if (quietTime > 12 && hiddenTime > 6) {
          decayTimer += dt;
          if (decayTimer > 4) {
            decayTimer = 0;
            wanted -= 1;
            quietTime = 0;
          }
        } else {
          decayTimer = 0;
        }
      }
    },
  };
}
