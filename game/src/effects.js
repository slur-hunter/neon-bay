// effects.js — small particle bursts and camera shake, all dt-based.
import * as THREE from 'three';

export function createEffects(scene) {
  const sparks = [];
  const cubeGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  let shakeAmount = 0;

  function burst(x, y, z, color, count) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const p = new THREE.Mesh(cubeGeo, mat);
      p.position.set(x, y, z);
      scene.add(p);
      sparks.push({
        mesh: p,
        life: 0.5 + Math.random() * 0.4,
        vx: (Math.random() - 0.5) * 7,
        vy: 2 + Math.random() * 5,
        vz: (Math.random() - 0.5) * 7,
      });
    }
  }

  function shake(amount) {
    shakeAmount = Math.max(shakeAmount, amount);
  }

  function shakeOffset() {
    if (shakeAmount <= 0.01) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * shakeAmount,
      y: (Math.random() - 0.5) * shakeAmount,
    };
  }

  function update(dt) {
    shakeAmount = Math.max(0, shakeAmount - dt * 1.6);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        sparks.splice(i, 1);
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.vy *= -0.4;
      }
      p.mesh.material.opacity = Math.min(1, p.life * 2);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 5;
    }
  }

  return { burst, shake, shakeOffset, update };
}
