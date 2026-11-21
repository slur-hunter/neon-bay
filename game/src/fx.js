// Small particle bursts (coloured boxes with gravity and fade) and a
// camera shake amount that decays each frame.
import * as THREE from 'three';
import { mulberry32, range } from './rng.js';

export function makeFx(scene) {
  const rng = mulberry32(99);
  const parts = [];
  const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  let shakeAmt = 0;

  function burst(x, y, z, color, n) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < (n || 10); i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.position.set(x, y, z);
      scene.add(m);
      parts.push({
        mesh: m,
        vx: range(rng, -3, 3), vy: range(rng, 2, 6), vz: range(rng, -3, 3),
        life: 0.7,
      });
    }
  }

  function shake(amount) {
    shakeAmt = Math.max(shakeAmt, amount);
  }

  function step(dt, camera) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        parts.splice(i, 1);
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.material.opacity = Math.max(0, p.life / 0.7);
    }
    if (shakeAmt > 0.001 && camera) {
      camera.position.x += range(rng, -1, 1) * shakeAmt * 0.12;
      camera.position.y += range(rng, -1, 1) * shakeAmt * 0.12;
      shakeAmt *= Math.pow(0.02, dt);
    } else {
      shakeAmt = 0;
    }
  }

  return { burst, shake, step };
}
