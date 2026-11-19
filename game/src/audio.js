// createAudio synthesises every sound with WebAudio: engine hum, sirens,
// skids, pickups, gunshots and mission jingles. No audio files anywhere.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let enabled = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!enabled || !ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch { /* silent */ }
  }

  function noise(dur, vol, freq) {
    if (!enabled || !ctx) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.2;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start();
    } catch { /* silent */ }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      enabled = true;
    },
    engine(speed01) {
      if (!enabled || !ctx) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain();
          engineGain.gain.value = 0.0;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 420;
          engineOsc.connect(f).connect(engineGain).connect(ctx.destination);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = 0.02 + speed01 * 0.05;
      } catch { /* silent */ }
    },
    siren(on) {
      if (!enabled || !ctx) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'triangle';
          sirenOsc.frequency.value = 750;
          sirenLfo = ctx.createOscillator();
          sirenLfo.type = 'square';
          sirenLfo.frequency.value = 0.9;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 160;
          sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.035;
          sirenOsc.connect(sirenGain).connect(ctx.destination);
          sirenOsc.start();
          sirenLfo.start();
        } else if (!on && sirenOsc) {
          sirenOsc.stop();
          sirenLfo.stop();
          sirenOsc = null;
          sirenLfo = null;
        }
      } catch { /* silent */ }
    },
    skid() { noise(0.25, 0.1, 900); },
    pickup() { blip(880, 0.12, 'sine', 0.15); setTimeout(() => blip(1320, 0.18, 'sine', 0.15), 90); },
    gunshot() { noise(0.14, 0.3, 2600); },
    punch() { noise(0.1, 0.2, 500); },
    jingle() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.16), i * 110));
    },
    busted() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.12), i * 160));
    },
  };
}
