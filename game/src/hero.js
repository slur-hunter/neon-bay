// Rico on foot: a simple humanoid with camera-relative WASD movement
// (W walks AWAY from the camera, A/D strafe), walk bob, arm swing, punch.
import * as THREE from 'three';

export class Hero {
  constructor(scene) {
    this.scene = scene;
    this.pos = { x: 0, z: 60 };
    this.yaw = Math.PI;
    this.speed = 0;
    this.bob = 0;
    this.punchCd = 0;
    this.punchAnim = 0;
    this.group = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a4a6a, roughness: 0.9 });
    const legGeo = new THREE.BoxGeometry(0.17, 0.78, 0.17);
    this.legL = new THREE.Mesh(legGeo, legMat);
    this.legL.position.set(-0.12, 0.39, 0);
    this.legR = new THREE.Mesh(legGeo, legMat);
    this.legR.position.set(0.12, 0.39, 0);
    // bright orange shirt so Rico reads against the warm road
    this.torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.66, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.85 }),
    );
    this.torso.position.y = 1.1;
    this.armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.6, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.8 }),
    );
    this.armL.position.set(-0.35, 1.1, 0);
    this.armR = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.6, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.8 }),
    );
    this.armR.position.set(0.35, 1.1, 0);
    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.32, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.8 }),
    );
    this.head.position.y = 1.62;
    this.cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.11, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.8 }),
    );
    this.cap.position.y = 1.82;
    this.group.add(this.legL, this.legR, this.torso, this.armL, this.armR, this.head, this.cap);
    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.scene.add(this.group);
    this.sync();
  }

  place(x, z, yaw) {
    this.pos.x = x;
    this.pos.z = z;
    this.yaw = yaw;
    this.sync();
  }

  sync() {
    this.group.position.set(this.pos.x, Math.abs(Math.sin(this.bob)) * 0.05, this.pos.z);
    this.group.rotation.y = this.yaw;
  }

  // input: {fwd, back, left, right} in camera space. camYaw is the camera
  // azimuth; forward on screen is (sin camYaw, cos camYaw).
  walk(dt, input, camYaw, city) {
    this.punchCd -= dt;
    this.punchAnim = Math.max(0, this.punchAnim - dt * 4);
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw);
    const rz = Math.sin(camYaw);
    let mx = 0;
    let mz = 0;
    if (input.fwd) {
      mx += fx;
      mz += fz;
    }
    if (input.back) {
      mx -= fx;
      mz -= fz;
    }
    if (input.right) {
      mx += rx;
      mz += rz;
    }
    if (input.left) {
      mx -= rx;
      mz -= rz;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const run = input.run ? 8.2 : 5.2;
      this.pos.x += mx * run * dt;
      this.pos.z += mz * run * dt;
      this.speed = run;
      const want = Math.atan2(mx, mz);
      let diff = want - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += Math.max(-10 * dt, Math.min(10 * dt, diff));
      this.bob += dt * (input.run ? 13 : 9);
    } else {
      this.speed = 0;
      this.bob += dt * 2;
    }
    city.collideCircle(this.pos, 0.55);
    this.sync();
    this.legL.rotation.x = Math.sin(this.bob) * (this.speed > 0 ? 0.6 : 0);
    this.legR.rotation.x = -Math.sin(this.bob) * (this.speed > 0 ? 0.6 : 0);
    this.armL.rotation.x = -Math.sin(this.bob) * (this.speed > 0 ? 0.5 : 0);
    // right arm extends during a punch
    this.armR.rotation.x = this.punchAnim > 0 ? -1.5 * this.punchAnim : Math.sin(this.bob) * (this.speed > 0 ? 0.5 : 0);
  }

  tryPunch() {
    if (this.punchCd > 0) return false;
    this.punchCd = 0.45;
    this.punchAnim = 1;
    return true;
  }

  // World position a short step in front of Rico's chest.
  punchPoint() {
    return {
      x: this.pos.x + Math.sin(this.yaw) * 1.4,
      z: this.pos.z + Math.cos(this.yaw) * 1.4,
    };
  }
}
