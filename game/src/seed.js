// Seeded random numbers for Neon Bay v7. A tiny deterministic generator so the
// city, the parked cars and the pedestrians are identical on every load.
export function makeSeededRandom(seed) {
  let a = seed >>> 0;
  // xorshift32 with a warm-up: cheap, deterministic, good enough for scenery.
  for (let i = 0; i < 16; i++) {
    a ^= a << 13; a ^= a >>> 17; a ^= a << 5; a >>>= 0;
  }
  return function next() {
    a ^= a << 13; a ^= a >>> 17; a ^= a << 5; a >>>= 0;
    return a / 4294967296;
  };
}

export function pickFrom(rnd, list) {
  return list[Math.floor(rnd() * list.length)];
}

export function range(rnd, lo, hi) {
  return lo + rnd() * (hi - lo);
}
