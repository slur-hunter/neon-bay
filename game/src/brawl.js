// Neon Bay v7 — fists. Combat is punch-only: no weapons anywhere in the game,
// so nothing in the HUD pretends otherwise.
export function createBrawl() {
  let cooldown = 0;
  return {
    update(dt) { if (cooldown > 0) cooldown -= dt; },
    // Swing at whatever is in front of `origin`, facing `yaw`. Returns the hits.
    punch(origin, yaw, targets) {
      if (cooldown > 0) return [];
      cooldown = 0.45;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const hits = [];
      for (const t of targets) {
        const dx = t.pos.x - origin.x;
        const dz = t.pos.z - origin.z;
        const d = Math.hypot(dx, dz);
        const reach = 2.6 + (t.radius || 0.5);
        if (d > reach) continue;
        const dot = (dx * fx + dz * fz) / (d || 1);
        if (dot > 0.35) hits.push(t);
      }
      return hits;
    },
  };
}
