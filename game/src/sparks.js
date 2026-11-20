// Sparks and shake: small particle bursts (coloured boxes with gravity and
// fade) plus a camera shake that decays over time.

import * as THREE from 'three';

export function createSparks(scene) {
  const bursts = [];
  let shakeAmount = 0;

  function burst(x, y, z, color, count) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < count; i++) {
      const piece = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), mat.clone());
      piece.position.set(x, y, z);
      scene.add(piece);
      bursts.push({
        mesh: piece,
        vx: (Math.random() * 2 - 1) * 3.5,
        vy: 2 + Math.random() * 5,
        vz: (Math.random() * 2 - 1) * 3.5,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
      });
    }
  }

  function shake(amount) {
    shakeAmount = Math.max(shakeAmount, amount);
  }

  function shakeOffset() {
    if (shakeAmount <= 0.01) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * shakeAmount * 0.5,
      y: (Math.random() * 2 - 1) * shakeAmount * 0.5,
    };
  }

  function update(dt) {
    shakeAmount = Math.max(0, shakeAmount - dt * 1.6);
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        scene.remove(b.mesh);
        b.mesh.material.dispose();
        bursts.splice(i, 1);
        continue;
      }
      b.vy -= 12 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      if (b.mesh.position.y < 0.1) {
        b.mesh.position.y = 0.1;
        b.vy *= -0.4;
      }
      b.mesh.material.opacity = Math.max(0, b.life / b.maxLife);
    }
  }

  return { burst, shake, shakeOffset, update };
}
