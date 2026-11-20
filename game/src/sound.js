// Synthesized sound only: a WebAudio context built lazily on the first
// gesture, an engine hum that rises with speed, a two-tone siren, and short
// blips. Everything is best-effort — audio never breaks the game.

export function createSound() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let sirenHigh = false;

  function init() {
    if (ctx) return;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      ctx = new AC();
      // Engine: sawtooth through a lowpass, gain tied to speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      // Siren: triangle alternating 660 / 880 Hz.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(ctx.destination);
      sirenOsc.start();
      sirenTimer = window.setInterval(() => {
        if (!ctx || muted) return;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 880 : 660;
      }, 450);
    } catch {
      ctx = null;
    }
  }

  function setMuted(m) {
    muted = m;
    if (engineGain) engineGain.gain.value = 0;
    if (sirenGain) sirenGain.gain.value = 0;
  }

  function engine(speed01) {
    if (!ctx || muted || !engineOsc) return;
    try {
      engineOsc.frequency.value = 50 + speed01 * 130;
      engineGain.gain.value = 0.02 + speed01 * 0.05;
    } catch {
      // ignore
    }
  }

  function siren(on) {
    if (!ctx || !sirenGain) return;
    try {
      sirenGain.gain.value = on && !muted ? 0.035 : 0;
    } catch {
      // ignore
    }
  }

  function blip(freq, dur, type, gain) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // ignore
    }
  }

  function pickup() {
    blip(880, 0.12, 'sine', 0.08);
    window.setTimeout(() => blip(1318, 0.15, 'sine', 0.08), 90);
  }

  function punch() {
    blip(140, 0.1, 'square', 0.06);
  }

  function click() {
    blip(660, 0.07, 'sine', 0.05);
  }

  function crash() {
    blip(90, 0.25, 'sawtooth', 0.09);
  }

  function busted() {
    blip(220, 0.3, 'sine', 0.08);
    window.setTimeout(() => blip(165, 0.4, 'sine', 0.08), 220);
  }

  return { init, setMuted, engine, siren, pickup, punch, click, crash, busted };
}
