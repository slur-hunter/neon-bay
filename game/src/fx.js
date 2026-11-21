// Tiny particle bursts and camera shake. No textures, just coloured boxes.
import * as THREE from 'three';

const POOL = 90;

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.parts.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
    }
    this.cursor = 0;
    this.trauma = 0;
  }

  burst(x, y, z, color, count = 12, power = 5) {
    for (let n = 0; n < count; n++) {
      const p = this.parts[this.cursor];
      this.cursor = (this.cursor + 1) % POOL;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      const a = Math.random() * Math.PI * 2;
      const up = 2 + Math.random() * 4;
      p.vx = Math.cos(a) * power * Math.random();
      p.vz = Math.sin(a) * power * Math.random();
      p.vy = up;
      p.life = 0.5 + Math.random() * 0.4;
      p.max = p.life;
    }
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt) {
    for (const p of this.parts) {
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.08) {
        p.mesh.position.y = 0.08;
        p.vy = 0;
      }
      p.mesh.material.opacity = p.life / p.max;
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  // Small random offset applied to the camera each frame while trauma lasts.
  offset() {
    const s = this.trauma * this.trauma * 0.35;
    return {
      x: (Math.random() * 2 - 1) * s,
      y: (Math.random() * 2 - 1) * s,
    };
  }
}
