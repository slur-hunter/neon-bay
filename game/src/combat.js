// combat.js — the punch: a short-range swing in front of Rico. It knocks a
// pedestrian down, and if the police see it, the heat goes up. Punch only:
// there is no weapon system in this game, so the HUD shows none.
import * as THREE from 'three';

export function createCombat() {
  let cooldown = 0;

  // targets: [{pos, radius, kind, ref}] — pedestrians and police cars.
  // Returns the list of targets hit, or an empty list while cooling down.
  function punch(origin, yaw, targets) {
    if (cooldown > 0) return [];
    cooldown = 0.45;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const hit = [];
    for (const t of targets) {
      const dx = t.pos.x - origin.x;
      const dz = t.pos.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.6 + (t.radius || 0)) continue;
      // Must be roughly in front of the player.
      const dot = (dx * fx + dz * fz) / Math.max(0.1, d);
      if (dot > 0.35) hit.push(t);
    }
    return hit;
  }

  function update(dt) {
    if (cooldown > 0) cooldown -= dt;
  }

  return { punch, update };
}
