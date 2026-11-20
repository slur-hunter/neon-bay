// Seeded randomness for Neon Bay: one tiny generator so the city is identical
// on every load. mulberry32 is small and deterministic; the helpers below are
// the only random calls the world builders use.

// mulberry32 — a compact seeded PRNG.
export function makeSeeded(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform float in [low, high).
export function range(rnd, low, high) {
  return low + rnd() * (high - low);
}

// Uniform integer in [low, high] inclusive.
export function rangeInt(rnd, low, high) {
  return low + Math.floor(rnd() * (high - low + 1));
}

// Pick one element from an array.
export function pick(rnd, list) {
  return list[Math.floor(rnd() * list.length)];
}

// True with probability p.
export function chance(rnd, p) {
  return rnd() < p;
}
