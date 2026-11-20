// audio.js — every sound is synthesized with WebAudio: no audio files, no
// network. The context starts lazily on the first user gesture, so headless
// runs stay quiet.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function init() {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    if (!engineOsc) {
      engineOsc = c.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = c.createGain();
      engineGain.gain.value = 0;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter).connect(engineGain).connect(c.destination);
      engineOsc.start();
    }
    if (!sirenOsc) {
      sirenOsc = c.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 660;
      sirenGain = c.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(c.destination);
      sirenOsc.start();
    }
  }

  function blip(freq, dur, type, vol) {
    const c = ensure();
    if (!c || muted) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.18, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur);
    } catch (e) { /* audio is best-effort */ }
  }

  return {
    init,
    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
    },
    engine(speed01) {
      if (!ctx || muted || !engineGain) return;
      try {
        engineOsc.frequency.value = 50 + speed01 * 130;
        engineGain.gain.value = 0.02 + speed01 * 0.05;
      } catch (e) { /* ignore */ }
    },
    siren(on) {
      if (!ctx || !sirenGain) return;
      try {
        sirenGain.gain.value = (on && !muted) ? 0.035 : 0;
        if (on) sirenOsc.frequency.value = (Math.floor(performance.now() / 450) % 2 === 0) ? 660 : 880;
      } catch (e) { /* ignore */ }
    },
    pickup() { blip(880, 0.18, 'sine', 0.2); setTimeout(() => blip(1318, 0.25, 'sine', 0.2), 90); },
    punch() { blip(140, 0.12, 'square', 0.22); },
    click() { blip(660, 0.06, 'sine', 0.12); },
    crash() { blip(90, 0.25, 'sawtooth', 0.25); },
    busted() { blip(220, 0.5, 'sawtooth', 0.2); setTimeout(() => blip(165, 0.6, 'sawtooth', 0.2), 200); },
  };
}
