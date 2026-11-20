// Fists only: Rico's combat is a punch, nothing else. No weapons, no
// faked weapon slots — the HUD never shows a gun the game does not have.

export function createFists() {
  let cooldown = 0;

  function update(dt) {
    if (cooldown > 0) cooldown -= dt;
  }

  // origin: Vector3-ish {x, z}; yaw: facing angle. targets: [{pos, radius}].
  // Returns the targets hit: in front (dot > 0.35) and within reach.
  function punch(origin, yaw, targets) {
    if (cooldown > 0) return [];
    cooldown = 0.45;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const hit = [];
    for (const target of targets) {
      const dx = target.pos.x - origin.x;
      const dz = target.pos.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.6 + target.radius) continue;
      const dot = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1;
      if (dot > 0.35) hit.push(target);
    }
    return hit;
  }

  return { update, punch };
}
