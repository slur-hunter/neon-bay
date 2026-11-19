// Neon Bay — player.js: the on-foot hero, third-person movement and the orbit camera.
// One clear job: walk, sprint and look around the city; cars are handled by vehicles.js.
import * as THREE from 'three';
import { isWalkable, resolveCollision } from './city.js';

const WALK_SPEED = 7.5;
const SPRINT_SPEED = 11;

/** Builds a simple blocky hero figure from boxes, with swinging limbs. */
function buildFigure() {
  const figure = new THREE.Group();
  figure.name = 'player-figure';
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2e8f86, roughness: 0.85 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2c3e55, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5), jacket);
  torso.position.y = 1.25;
  torso.castShadow = true;
  figure.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.44), skin);
  head.position.y = 2.0;
  head.castShadow = true;
  figure.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.46), hair);
  hairTop.position.y = 2.28;
  figure.add(hairTop);

  const armGeo = new THREE.BoxGeometry(0.26, 0.85, 0.3);
  armGeo.translate(0, -0.42, 0);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.6, 1.72, 0);
  armL.castShadow = true;
  figure.add(armL);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.6, 1.72, 0);
  armR.castShadow = true;
  figure.add(armR);

  const legGeo = new THREE.BoxGeometry(0.32, 0.8, 0.36);
  legGeo.translate(0, -0.4, 0);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(-0.22, 0.8, 0);
  legL.castShadow = true;
  figure.add(legL);
  const legR = new THREE.Mesh(legGeo, jeans);
  legR.position.set(0.22, 0.8, 0);
  legR.castShadow = true;
  figure.add(legR);

  return { figure, armL, armR, legL, legR };
}

/** Creates the player on foot at the plaza, facing the Spire. */
export function createPlayer(scene, city) {
  const { figure, armL, armR, legL, legR } = buildFigure();
  scene.add(figure);
  const pos = new THREE.Vector3(8, 0, 24);
  figure.position.copy(pos);
  let heading = Math.PI; // facing north, toward the Spire
  let walkPhase = 0;
  let speed = 0;
  let inCar = false;

  const player = {
    group: figure,
    pos,
    get heading() { return heading; },
    get speed() { return speed; },
    get inCar() { return inCar; },
    setInCar(v) { inCar = v; figure.visible = !v; },
    placeAt(x, z, h) {
      pos.set(x, 0, z);
      heading = h;
      figure.position.copy(pos);
      figure.rotation.y = heading;
    },
    /** Nearest stealable car within reach, or null. */
    nearestCar(cars) {
      let best = null, bestD = 4;
      for (const car of cars) {
        const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
        if (d < bestD) { best = car; bestD = d; }
      }
      return best;
    },
    update(dt, input, cam) {
      if (inCar) { speed = 0; return; }
      let mx = 0, mz = 0;
      if (input.forward) mz -= 1;
      if (input.back) mz += 1;
      if (input.left) mx -= 1;
      if (input.right) mx += 1;
      const moving = mx !== 0 || mz !== 0;
      const target = input.sprint ? SPRINT_SPEED : WALK_SPEED;
      speed = moving ? target : 0;
      if (moving) {
        const len = Math.hypot(mx, mz);
        mx /= len; mz /= len;
        // Movement is relative to the camera: W goes where the camera looks,
        // D goes to the camera's right. Forward is (sin yaw, cos yaw).
        const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
        const wx = -mx * cos - mz * sin;
        const wz = mx * sin - mz * cos;
        const nx = pos.x + wx * speed * dt;
        const nz = pos.z + wz * speed * dt;
        // Slide along walls and water: try both axes, then each alone.
        let px = pos.x, pz = pos.z;
        if (isWalkable(nx, nz)) { px = nx; pz = nz; }
        else if (isWalkable(nx, pos.z)) { px = nx; }
        else if (isWalkable(pos.x, nz)) { pz = nz; }
        px = Math.max(-168, Math.min(168, px));
        pz = Math.max(-168, Math.min(168, pz));
        const fixed = resolveCollision(px, pz, 0.6, city.colliders);
        pos.set(fixed.x, 0, fixed.z);
        figure.position.copy(pos);
        // Turn the figure toward the direction of travel.
        const want = Math.atan2(wx, wz);
        let diff = want - heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        heading += diff * Math.min(1, dt * 12);
        figure.rotation.y = heading;
        walkPhase += dt * speed * 1.5;
        const swing = Math.sin(walkPhase) * 0.55;
        legL.rotation.x = swing; legR.rotation.x = -swing;
        armL.rotation.x = -swing; armR.rotation.x = swing;
      } else {
        legL.rotation.x *= 0.8; legR.rotation.x *= 0.8;
        armL.rotation.x *= 0.8; armR.rotation.x *= 0.8;
      }
    },
    /** Puts the camera behind the player, orbiting with the mouse drag. */
    updateCamera(camera, cam, dt) {
      const dist = cam.dist;
      const cx = pos.x - Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist;
      const cz = pos.z - Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist;
      const cy = 2.2 + Math.sin(cam.pitch) * dist;
      camera.position.set(cx, cy, cz);
      camera.lookAt(pos.x, 1.6, pos.z);
    },
  };
  return player;
}
