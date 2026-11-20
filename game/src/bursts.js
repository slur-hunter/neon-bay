// Neon Bay v7 — particle bursts and camera shake. Small coloured boxes with
// gravity, a bounce and a fade; a shake amount that decays over time.
import * as THREE from 'three';

export function createBursts(scene) {
  const live = [];
  let shakeAmount = 0;

  function burst(x, y, z, color, count) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.18),
        new THREE.MeshBasicMaterial({ color, transparent: true }),
      );
      m.position.set(x, y, z);
      scene.add(m);
      live.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 7,
        vy: 2 + Math.random() * 5,
        vz: (Math.random() - 0.5) * 7,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
      });
    }
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        live.splice(i, 1);
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
      p.mesh.material.opacity = Math.max(0, p.life / p.max);
    }
    if (shakeAmount > 0) shakeAmount = Math.max(0, shakeAmount - dt * 1.6);
  }

  function shake(amount) { shakeAmount = Math.max(shakeAmount, amount); }

  function shakeOffset() {
    if (shakeAmount <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * shakeAmount,
      y: (Math.random() - 0.5) * shakeAmount,
    };
  }

  return { burst, update, shake, shakeOffset };
}
