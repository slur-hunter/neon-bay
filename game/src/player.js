// player.js — the on-foot character, third-person camera, and getting in/out of cars.
import * as THREE from 'three';

function makePersonMesh() {
  const g = new THREE.Group();
  g.name = 'player';
  const jacket = new THREE.MeshLambertMaterial({ color: 0x0e7a6e });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), jacket);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12),
    new THREE.MeshLambertMaterial({ color: 0xff2e88 }));
  cap.position.y = 2.18;
  g.add(cap);
  for (const sx of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.36), jeans);
    leg.position.set(sx, 0.4, 0);
    leg.castShadow = true;
    leg.name = sx < 0 ? 'legL' : 'legR';
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.28), jacket);
    arm.position.set(sx * 1.45, 1.15, 0);
    arm.name = sx < 0 ? 'armL' : 'armR';
    g.add(arm);
  }
  return g;
}

export class Player {
  constructor(scene, city, vehicles) {
    this.scene = scene;
    this.city = city;
    this.vehicles = vehicles;
    this.mesh = makePersonMesh();
    scene.add(this.mesh);
    const spawn = city.spawnPos;
    this.mesh.position.set(spawn.x, 0, spawn.z);
    this.heading = Math.PI; // facing north, down the street
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.inCar = false;
    this.car = null;
    this.walkPhase = 0;
    this.moving = false;
  }

  get pos() { return this.mesh.position; }

  // Camera-relative movement: forward is always away from the camera.
  update(dt, input, camera) {
    if (this.inCar) {
      this.vehicles.drive(this.car, input, dt);
      this.mesh.position.copy(this.car.mesh.position);
      this.mesh.visible = false;
      this.updateCarCamera(dt, camera);
      return;
    }
    this.mesh.visible = true;
    // forward = away from camera, right = 90 degrees clockwise from forward
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = -fz, rz = fx;
    let mx = 0, mz = 0;
    if (input.forward) { mx += fx; mz += fz; }
    if (input.back) { mx -= fx; mz -= fz; }
    if (input.right) { mx += rx; mz += rz; }
    if (input.left) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    this.moving = len > 0.01;
    if (this.moving) {
      mx /= len; mz /= len;
      const speed = input.sprint ? 10 : 6;
      this.mesh.position.x += mx * speed * dt;
      this.mesh.position.z += mz * speed * dt;
      // face the direction of travel (never camera-inverted)
      this.heading = Math.atan2(mx, mz);
      this.mesh.rotation.y = this.heading;
      this.walkPhase += dt * speed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.45;
      const legL = this.mesh.getObjectByName('legL');
      const legR = this.mesh.getObjectByName('legR');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
    } else {
      const legL = this.mesh.getObjectByName('legL');
      const legR = this.mesh.getObjectByName('legR');
      if (legL) legL.rotation.x *= 0.8;
      if (legR) legR.rotation.x *= 0.8;
    }
    this.city.collideCircle(this.mesh.position, 0.7);
    this.city.clampToCity(this.mesh.position, -1);
    this.updateFootCamera(dt, camera);
  }

  updateFootCamera(dt, camera) {
    const dist = 7.5;
    const target = new THREE.Vector3(
      this.mesh.position.x + Math.sin(this.camYaw) * dist,
      3.2 + this.camPitch * 4,
      this.mesh.position.z + Math.cos(this.camYaw) * dist,
    );
    camera.position.lerp(target, Math.min(1, dt * 10));
    camera.lookAt(this.mesh.position.x, 1.6, this.mesh.position.z);
  }

  updateCarCamera(dt, camera) {
    const car = this.car;
    const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
    const dist = 11;
    const target = new THREE.Vector3(
      car.mesh.position.x - f.x * dist,
      4.6,
      car.mesh.position.z - f.z * dist,
    );
    camera.position.lerp(target, Math.min(1, dt * 6));
    camera.lookAt(
      car.mesh.position.x + f.x * 7,
      1.4,
      car.mesh.position.z + f.z * 7,
    );
  }

  // Steal / enter the nearest car. Returns the car or null.
  tryEnterCar() {
    if (this.inCar) return null;
    const car = this.vehicles.nearestCar(this.mesh.position, 5, true);
    if (!car) return null;
    this.inCar = true;
    this.car = car;
    car.taken = true;
    car.speed = 0;
    if (car.isTraffic) {
      // a traffic car stops when its driver is pulled out
      car.isTraffic = false;
    }
    this.mesh.visible = false;
    return car;
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.car;
    const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
    this.mesh.position.set(
      car.mesh.position.x - f.z * 2.5,
      0,
      car.mesh.position.z + f.x * 2.5,
    );
    this.inCar = false;
    this.car = null;
    this.mesh.visible = true;
    this.camYaw = car.heading + Math.PI;
  }

  look(dx, dy) {
    this.camYaw -= dx * 0.004;
    this.camPitch = Math.max(-0.1, Math.min(1.1, this.camPitch + dy * 0.002));
  }
}
