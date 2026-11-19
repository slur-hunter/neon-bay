// Neon Bay — effects.js: one pooled particle system for sparks, dust and flashes.
// One clear job: make impacts, skids and gunfire visible without new meshes.
import * as THREE from 'three';

const MAX_PARTICLES = 400;

/** A single THREE.Points cloud, reused for every burst in the game. */
export function createEffects(scene) {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  for (let i = 0; i < MAX_PARTICLES; i += 1) positions[i * 3 + 1] = -999;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.42, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const vel = new Float32Array(MAX_PARTICLES * 3);
  const life = new Float32Array(MAX_PARTICLES);
  const maxLife = new Float32Array(MAX_PARTICLES);
  const baseColor = new Float32Array(MAX_PARTICLES * 3);
  let cursor = 0;

  function spawn(x, y, z, count, color, speed, up, lifeTime, gravity) {
    for (let n = 0; n < count; n += 1) {
      const i = cursor;
      cursor = (cursor + 1) % MAX_PARTICLES;
      positions[i * 3] = x + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      vel[i * 3] = Math.cos(a) * s;
      vel[i * 3 + 1] = up * (0.5 + Math.random());
      vel[i * 3 + 2] = Math.sin(a) * s;
      life[i] = lifeTime * (0.6 + Math.random() * 0.7);
      maxLife[i] = life[i];
      baseColor[i * 3] = color[0];
      baseColor[i * 3 + 1] = color[1];
      baseColor[i * 3 + 2] = color[2];
    }
  }

  return {
    /** Orange impact sparks, for crashes and bullet hits. */
    sparks(x, y, z, n) {
      spawn(x, y, z, n, [1.0, 0.62, 0.15], 7, 3.5, 0.5, 14);
    },
    /** Grey dust, for skids and hard landings. */
    dust(x, y, z, n) {
      spawn(x, y, z, n, [0.45, 0.42, 0.38], 2.5, 1.2, 0.8, 2);
    },
    /** A white-yellow muzzle flash burst. */
    flash(x, y, z) {
      spawn(x, y, z, 10, [1.0, 0.95, 0.6], 4, 1, 0.16, 0);
    },
    update(dt) {
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) {
          positions[i * 3 + 1] = -999;
          colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0;
          continue;
        }
        vel[i * 3 + 1] -= 9 * dt;
        positions[i * 3] += vel[i * 3] * dt;
        positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (positions[i * 3 + 1] < 0.05) {
          positions[i * 3 + 1] = 0.05;
          vel[i * 3 + 1] *= -0.3;
        }
        // Fade to black as the particle dies (additive blending hides it).
        const f = life[i] / maxLife[i];
        colors[i * 3] = baseColor[i * 3] * f;
        colors[i * 3 + 1] = baseColor[i * 3 + 1] * f;
        colors[i * 3 + 2] = baseColor[i * 3 + 2] * f;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
