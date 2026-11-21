// Rico on foot: a simple humanoid with BRIGHT clothes (orange shirt, pale
// jeans, yellow cap) so he reads against the warm road at dusk. Camera-relative
// WASD: forward walks AWAY from the camera, never inverted.
import * as THREE from 'three';

export function buildHero(scene) {
  const g = new THREE.Group();
  g.name = 'rico';

  // Bright materials: the player must be findable in under 2 seconds.
  const shirt = new THREE.MeshStandardMaterial({ color: 0xff6b1a, roughness: 0.7 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x9ec8e8, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.7 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xffd21a, roughness: 0.6 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirt);
  torso.position.y = 1.22;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.9;
  head.castShadow = true;
  g.add(head);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.46), capMat);
  cap.position.y = 2.14;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.22), capMat);
  brim.position.set(0, 2.08, 0.3);
  g.add(brim);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.32), jeans);
  legL.position.set(-0.2, 0.4, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.32), jeans);
  legR.position.set(0.2, 0.4, 0);
  legR.castShadow = true;
  g.add(legR);

  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.5), shoeMat);
  shoeL.position.set(-0.2, 0.07, 0.06);
  g.add(shoeL);
  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.5), shoeMat);
  shoeR.position.set(0.2, 0.07, 0.06);
  g.add(shoeR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.24), shirt);
  armL.position.set(-0.5, 1.2, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.24), shirt);
  armR.position.set(0.5, 1.2, 0);
  g.add(armR);

  scene.add(g);

  const state = {
    group: g,
    // Spawn on street z=-35 so the player starts on the road, near parked
    // cars, instead of inside a block where buildings block the way.
    pos: new THREE.Vector3(0, 0, -35),
    yaw: Math.PI,
    speed: 0,
    bob: 0,
    punchT: 0,
    punchCooldown: 0,
    moving: false,
  };
  g.position.copy(state.pos);

  // Move with camera-relative WASD. fwd/strafe are unit vectors on the ground.
  function step(dt, keys, camYaw, collide, clampPos) {
    let ix = 0;
    let iz = 0;
    if (keys.w) iz += 1;
    if (keys.s) iz -= 1;
    if (keys.a) ix -= 1;
    if (keys.d) ix += 1;
    const moving = ix !== 0 || iz !== 0;
    state.moving = moving;
    const run = keys.shift ? 11 : 6.5;
    if (moving) {
      const len = Math.hypot(ix, iz);
      ix /= len;
      iz /= len;
      // Forward = away from the camera: camera sits behind the player along
      // the same yaw, so forward is (sin(camYaw), cos(camYaw)) on the ground.
      const fx = Math.sin(camYaw);
      const fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      const mx = fx * iz + rx * ix;
      const mz = fz * iz + rz * ix;
      state.yaw = Math.atan2(mx, mz);
      const nx = state.pos.x + mx * run * dt;
      const nz = state.pos.z + mz * run * dt;
      const [cx, cz] = collide(nx, nz, 0.6);
      const [kx, kz] = clampPos(cx, cz);
      state.pos.x = kx;
      state.pos.z = kz;
      state.speed = run;
      state.bob += dt * (keys.shift ? 13 : 9);
    } else {
      state.speed = 0;
    }
    g.position.copy(state.pos);
    g.rotation.y = state.yaw;
    const swing = moving ? Math.sin(state.bob) * 0.55 : 0;
    armL.rotation.x = swing;
    armR.rotation.x = -swing;
    legL.rotation.x = -swing * 0.9;
    legR.rotation.x = swing * 0.9;
    g.position.y = moving ? Math.abs(Math.sin(state.bob)) * 0.07 : 0;
    if (state.punchT > 0) {
      state.punchT -= dt;
      const p = 1 - Math.max(0, state.punchT) / 0.28;
      armR.rotation.x = -2.1 * Math.sin(p * Math.PI);
    }
    if (state.punchCooldown > 0) state.punchCooldown -= dt;
  }

  function punch() {
    if (state.punchCooldown > 0) return false;
    state.punchCooldown = 0.45;
    state.punchT = 0.28;
    return true;
  }

  function place(x, z, yaw) {
    state.pos.set(x, 0, z);
    state.yaw = yaw;
    g.position.copy(state.pos);
    g.rotation.y = yaw;
  }

  return { state, step, punch, place };
}
