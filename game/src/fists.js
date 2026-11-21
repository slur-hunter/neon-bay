// Punch: short range, only targets roughly in front, short cooldown.
// Punching a pedestrian knocks them down; punching a police car raises
// wanted. Pure geometry, no fake hits.
export function makeFists() {
  let cooldown = 0;
  return {
    tick(dt) { cooldown = Math.max(0, cooldown - dt); },
    ready: () => cooldown <= 0,
    swing(px, pz, yaw, crowd, cops) {
      if (cooldown > 0) return { hit: null, kind: null };
      cooldown = 0.45;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      let best = null, bestD = 3.2, kind = null;
      for (const p of crowd.peds) {
        if (p.down > 0) continue;
        const dx = p.x - px, dz = p.z - pz;
        const d = Math.hypot(dx, dz);
        const dot = (dx * fx + dz * fz) / Math.max(0.01, d);
        if (d < bestD && dot > 0.45) { best = p; bestD = d; kind = 'ped'; }
      }
      for (const c of cops.cops) {
        const dx = c.x - px, dz = c.z - pz;
        const d = Math.hypot(dx, dz);
        const dot = (dx * fx + dz * fz) / Math.max(0.01, d);
        if (d < bestD + 1.2 && dot > 0.45) { best = c; bestD = d; kind = 'cop'; }
      }
      if (!best) return { hit: null, kind: null };
      if (kind === 'ped') crowd.knockDown(best.x, best.z, 0.1);
      return { hit: best, kind };
    },
  };
}
