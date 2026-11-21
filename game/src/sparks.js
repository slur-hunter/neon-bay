// Small particle bursts (coloured boxes with gravity and fade) and a
// camera shake that decays. Both are pure feedback, no gameplay lies.
import * as THREE from 'three';

export function makeSparks(scene) {
  const bursts = [];
  const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  return {
    burst(x, y, z, color, n = 14) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const parts = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, mat.clone());
        m.position.set(x, y, z);
        scene.add(m);
        parts.push({
          m,
          vx: (Math.random() - 0.5) * 7,
          vy: Math.random() * 5 + 1,
          vz: (Math.random() - 0.5) * 7,
          life: 0.7,
        });
      }
      bursts.push(parts);
    },
    update(dt) {
      for (let i = bursts.length - 1; i >= 0; i--) {
        const parts = bursts[i];
        let alive = false;
        for (const p of parts) {
          p.life -= dt;
          if (p.life <= 0) { scene.remove(p.m); continue; }
          alive = true;
          p.vy -= 12 * dt;
          p.m.position.x += p.vx * dt;
          p.m.position.y += p.vy * dt;
          p.m.position.z += p.vz * dt;
          p.m.material.opacity = p.life / 0.7;
        }
        if (!alive) bursts.splice(i, 1);
      }
    },
  };
}

export function makeShake() {
  let amp = 0;
  return {
    add(a) { amp = Math.min(0.6, amp + a); },
    offset(dt) {
      amp = Math.max(0, amp - dt * 1.8);
      if (amp <= 0.01) return { x: 0, y: 0 };
      return { x: (Math.random() - 0.5) * amp, y: (Math.random() - 0.5) * amp };
    },
  };
}
