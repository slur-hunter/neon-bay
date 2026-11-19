// effects.js — lightweight particle bursts and screen shake, no textures needed.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.shakeAmount = 0;
    this.shakeOffset = { x: 0, y: 0 };
  }

  burst(pos, color, count) {
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(pos.x, (pos.y || 0) + 1, pos.z);
      const a = Math.random() * Math.PI * 2;
      const up = 2 + Math.random() * 4;
      this.scene.add(m);
      this.particles.push({
        mesh: m, life: 0.7 + Math.random() * 0.4,
        vx: Math.cos(a) * (2 + Math.random() * 4),
        vy: up,
        vz: Math.sin(a) * (2 + Math.random() * 4),
      });
    }
  }

  shake(amount) {
    this.shakeAmount = Math.min(1, this.shakeAmount + amount);
  }

  update(dt, camera) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.1, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.y += dt * 5;
    }
    if (this.shakeAmount > 0.001) {
      this.shakeOffset.x = (Math.random() - 0.5) * this.shakeAmount * 0.5;
      this.shakeOffset.y = (Math.random() - 0.5) * this.shakeAmount * 0.3;
      camera.position.x += this.shakeOffset.x;
      camera.position.y += this.shakeOffset.y;
      this.shakeAmount *= Math.max(0, 1 - dt * 4);
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }
  }
}
