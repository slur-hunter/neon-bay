// Small helpers shared by every module: a seeded random stream, number clamps,
// money and clock formatting, and canvas textures drawn at run time (facades, signs,
// the sky). Nothing here loads a file or touches the network.
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function pick(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}

export function money(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}

export function clockText(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.floor(totalMinutes) % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

export function timerText(seconds) {
  const whole = Math.max(0, Math.ceil(seconds - 1e-6));
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

export function compassText(distance) {
  return Math.round(distance) + 'm';
}

/** A canvas texture from a draw callback; returns { canvas, texture } via the maker. */
export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Fill a canvas with a vertical gradient and return it. */
export function skyCanvas(width, height, stops) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}
