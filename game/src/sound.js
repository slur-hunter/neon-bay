// Sound for Neon Bay: two synthesized radio stations and small effects,
// all built with WebAudio so there is no audio file to load. Audio only
// starts after a user gesture; in shot mode the context stays suspended
// and nothing crashes.
const STATIONS = [
  { name: 'SUNSET FM', track: 'Neon Nights', artist: 'The Palms', base: 220 },
  { name: 'STRAND 91', track: 'Golden Hour Drive', artist: 'Marina Lights', base: 174 },
];

let ctx = null;
let master = null;
let stationIndex = 0;
let muted = false;
let padNodes = [];

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function stopPad() {
  for (const n of padNodes) {
    try { n.stop(); } catch { /* already stopped */ }
  }
  padNodes = [];
}

function startPad() {
  const c = ensureCtx();
  if (!c || !master || muted) return;
  stopPad();
  const st = STATIONS[stationIndex];
  const notes = [1, 1.25, 1.5, 2];
  for (const mult of notes) {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = st.base * mult;
    const g = c.createGain();
    g.gain.value = 0.05;
    osc.connect(g);
    g.connect(master);
    osc.start();
    padNodes.push(osc);
  }
}

export const sound = {
  get station() {
    return STATIONS[stationIndex];
  },
  get muted() {
    return muted;
  },
  unlock() {
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    if (c && !muted) startPad();
  },
  nextStation() {
    stationIndex = (stationIndex + 1) % STATIONS.length;
    startPad();
    return STATIONS[stationIndex];
  },
  toggleMute() {
    muted = !muted;
    if (muted) stopPad();
    else startPad();
    return muted;
  },
  blip(freq) {
    const c = ensureCtx();
    if (!c || !master || muted) return;
    try {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq || 660;
      const g = c.createGain();
      g.gain.setValueAtTime(0.2, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.25);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(c.currentTime + 0.3);
    } catch {
      // A short effect must never break the game.
    }
  },
};
