// Effects: small particle bursts (coloured boxes with gravity and fade)
// and a camera shake. Best-effort, cheap, no assets.
import * as THREE from 'three';

export function buildSparks(scene) {
  const bursts = [];
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  let shakeT = 0;
  let shakeAmp = 0;

  function burst(x, y, z, color, count) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      scene.add(m);
      bursts.push({
        mesh: m, life: 0.7 + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 7,
        vy: Math.random() * 5 + 2,
        vz: (Math.random() - 0.5) * 7,
      });
    }
  }

  function shake(amp, seconds) {
    shakeAmp = Math.max(shakeAmp, amp);
    shakeT = Math.max(shakeT, seconds);
  }

  function step(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        scene.remove(b.mesh);
        bursts.splice(i, 1);
        continue;
      }
      b.vy -= 12 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.mesh.material.opacity = Math.min(1, b.life / 0.5);
      b.mesh.rotation.x += dt * 5;
      b.mesh.rotation.y += dt * 4;
    }
    if (shakeT > 0) shakeT -= dt;
    else shakeAmp = 0;
  }

  function offset() {
    if (shakeT <= 0 || shakeAmp <= 0) return [0, 0];
    const s = shakeAmp * (shakeT / 0.4);
    return [(Math.random() - 0.5) * s, (Math.random() - 0.5) * s];
  }

  return { burst, shake, step, offset };
}
