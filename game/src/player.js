// createPlayer builds the on-foot character and the third-person camera rig.
import * as THREE from 'three';

export function createPlayer(scene, city) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x00c8e0 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c28 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.38), jacket);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.82;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xff2d78 }));
  cap.position.y = 2.02;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), dark);
  legL.position.set(-0.18, 0.38, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), jacket);
  armL.position.set(-0.48, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);
  scene.add(group);

  const state = {
    pos: new THREE.Vector3(0, 0, 20),
    heading: Math.PI,
    speed: 0,
    walkPhase: 0,
    camYaw: Math.PI,
    camPitch: 0.32,
    camDist: 7.5,
    dragging: false,
  };
  group.position.copy(state.pos);

  function forwardVector() {
    return new THREE.Vector3(-Math.sin(state.camYaw), 0, -Math.cos(state.camYaw));
  }

  return {
    group,
    state,
    get pos() { return state.pos; },
    get heading() { return state.heading; },
    setVisible(v) { group.visible = v; },
    teleport(x, z, heading) {
      state.pos.set(x, 0, z);
      state.heading = heading;
      state.camYaw = heading + Math.PI;
      group.position.copy(state.pos);
      group.rotation.y = state.heading;
    },
    onMouseDown(x, y) { state.dragging = true; },
    onMouseUp() { state.dragging = false; },
    onMouseMove(dx, dy) {
      if (!state.dragging) return;
      state.camYaw -= dx * 0.005;
      state.camPitch = Math.max(0.05, Math.min(1.1, state.camPitch + dy * 0.004));
    },
    onWheel(delta) {
      state.camDist = Math.max(5, Math.min(16, state.camDist + delta * 0.01));
    },
    update(dt, keys) {
      const fwd = forwardVector();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      let mx = 0;
      let mz = 0;
      if (keys['KeyW'] || keys['ArrowUp']) mz += 1;
      if (keys['KeyS'] || keys['ArrowDown']) mz -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
      const moving = mx !== 0 || mz !== 0;
      const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
      const target = moving ? (sprint ? 11 : 7.5) : 0;
      state.speed += (target - state.speed) * Math.min(1, dt * 8);
      if (moving) {
        const dir = new THREE.Vector3()
          .addScaledVector(fwd, mz)
          .addScaledVector(right, mx)
          .normalize();
        state.pos.addScaledVector(dir, state.speed * dt);
        state.heading = Math.atan2(dir.x, dir.z);
        // camera eases behind the direction of travel
        const behind = state.heading + Math.PI;
        let diff = behind - state.camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        state.camYaw += diff * Math.min(1, dt * 1.2);
        state.walkPhase += dt * state.speed * 1.6;
        legL.rotation.x = Math.sin(state.walkPhase) * 0.7;
        legR.rotation.x = -Math.sin(state.walkPhase) * 0.7;
        armL.rotation.x = -Math.sin(state.walkPhase) * 0.5;
        armR.rotation.x = Math.sin(state.walkPhase) * 0.5;
      } else {
        legL.rotation.x = 0;
        legR.rotation.x = 0;
        armL.rotation.x = 0;
        armR.rotation.x = 0;
      }
      // keep inside the world and out of buildings
      state.pos.x = Math.max(-235, Math.min(235, state.pos.x));
      state.pos.z = Math.max(-235, Math.min(235, state.pos.z));
      city.collide(state.pos, 0.7);
      group.position.copy(state.pos);
      group.rotation.y = state.heading;
    },
    cameraTarget() {
      return new THREE.Vector3(state.pos.x, state.pos.y + 1.7, state.pos.z);
    },
    cameraOffset() {
      const cp = Math.cos(state.camPitch);
      return new THREE.Vector3(
        Math.sin(state.camYaw) * cp * state.camDist,
        Math.sin(state.camPitch) * state.camDist + 1.2,
        Math.cos(state.camYaw) * cp * state.camDist
      );
    },
  };
}
