// createEffects runs a small pooled particle system: sparks, muzzle flashes,
// dust and pickup sparkles. One pool, reused, never allocated per frame.
import * as THREE from 'three';

export function createEffects(scene) {
  const COUNT = 240;
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const parts = [];
  for (let i = 0; i < COUNT; i++) {
    parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 0, g: 0, b: 0 });
  }
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  function spawn(pos, hex, n, speed, life, up) {
    color.setHex(hex);
    let placed = 0;
    for (const p of parts) {
      if (placed >= n) break;
      if (p.alive) continue;
      p.alive = true;
      p.x = pos.x;
      p.y = pos.y + 0.5;
      p.z = pos.z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = (up || 2) * Math.random();
      p.max = life * (0.6 + Math.random() * 0.7);
      p.life = p.max;
      p.r = color.r;
      p.g = color.g;
      p.b = color.b;
      placed++;
    }
  }

  return {
    sparks(pos) { spawn(pos, 0xffc861, 14, 7, 0.5, 3); },
    muzzle(pos) { spawn(pos, 0xffe14d, 8, 4, 0.18, 1); },
    dust(pos) { spawn(pos, 0x9a8a7a, 8, 2.5, 0.7, 1.2); },
    pickupSparkle(pos) { spawn(pos, 0x7cff5e, 16, 3, 0.8, 3.5); },
    update(dt) {
      let count = 0;
      for (let i = 0; i < COUNT; i++) {
        const p = parts[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          continue;
        }
        p.vy -= 9 * dt;
        p.x += p.vx * dt;
        p.y = Math.max(0.12, p.y + p.vy * dt);
        p.z += p.vz * dt;
        const s = 0.5 + (p.life / p.max) * 0.8;
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(count, dummy.matrix);
        mesh.setColorAt(count, color.setRGB(p.r, p.g, p.b));
        count++;
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
