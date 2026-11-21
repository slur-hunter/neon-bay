// Punch combat, punch-only. Range a little beyond arm's length, only targets
// roughly in front, short cooldown. Punching a PEDESTRIAN knocks them down
// and does NOT raise wanted. Punching a POLICE CAR raises wanted by 1.
// (v8 raised wanted on any punch hit; this build fixes that.)
export function punchTargets(px, pz, facingYaw, crowd, cruisers) {
  const RANGE = 2.3;
  // Police car first: a cruiser within range in front.
  for (const c of cruisers) {
    if (!c.active) continue;
    const dx = c.x - px;
    const dz = c.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > RANGE + 1.2) continue;
    const ang = Math.atan2(dx, dz);
    let diff = ang - facingYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 1.0) return { kind: 'cruiser', target: c };
  }
  const hit = crowd.knockDown(px, pz, facingYaw, RANGE);
  if (hit) return { kind: 'pedestrian', target: null };
  return null;
}
