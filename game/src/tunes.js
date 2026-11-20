// Neon Bay v7 — sound. Synthesized WebAudio only, lazy context on first gesture.
// Everything is best-effort: a failure to make sound never breaks the game.
export function createTunes() {
  let ctx = null;
  let muted = false;
  let engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null;
  let sirenOn = false;
  let sirenTimer = null;
  let sirenHigh = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      return ctx;
    } catch {
      return null;
    }
  }

  function blip(freq, dur, type, gain) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = gain || 0.05;
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur);
    } catch { /* sound is optional */ }
  }

  return {
    init() { ensure(); },
    setMuted(m) { muted = m; },
    engine(speed01) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      try {
        if (!engineOsc) {
          engineOsc = c.createOscillator();
          engineOsc.type = 'sawtooth';
          const filter = c.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          engineGain = c.createGain();
          engineGain.gain.value = 0.02;
          engineOsc.connect(filter).connect(engineGain).connect(c.destination);
          engineOsc.start();
        }
        engineOsc.frequency.value = 50 + speed01 * 130;
        engineGain.gain.value = 0.02 + speed01 * 0.05;
      } catch { /* ignore */ }
    },
    siren(on) {
      if (on === sirenOn) return;
      sirenOn = on;
      const c = ensure();
      if (!c) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = c.createOscillator();
          sirenOsc.type = 'triangle';
          sirenGain = c.createGain();
          sirenGain.gain.value = 0.035;
          sirenOsc.connect(sirenGain).connect(c.destination);
          sirenOsc.start();
          sirenHigh = false;
          sirenTimer = setInterval(() => {
            if (!sirenOsc) return;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.value = sirenHigh ? 880 : 660;
          }, 450);
        } else if (!on && sirenOsc) {
          clearInterval(sirenTimer);
          sirenTimer = null;
          try { sirenOsc.stop(); } catch { /* already stopped */ }
          sirenOsc = null;
        }
      } catch { /* ignore */ }
    },
    pickup() { blip(880, 0.12, 'sine', 0.06); setTimeout(() => blip(1318, 0.15, 'sine', 0.06), 90); },
    punch() { blip(140, 0.1, 'square', 0.05); },
    click() { blip(660, 0.07, 'sine', 0.04); },
    crash() { blip(90, 0.25, 'sawtooth', 0.07); },
    busted() { blip(220, 0.3, 'sine', 0.06); setTimeout(() => blip(165, 0.4, 'sine', 0.06), 200); },
  };
}
