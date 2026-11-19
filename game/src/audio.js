// Neon Bay — audio.js: every sound is synthesized with WebAudio. No audio files.
// One clear job: engine, siren, gunshots and jingles, all made from oscillators.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let noiseBuf = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // A short noise buffer, reused by every gunshot.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* audio is decoration; never break the game */ }
  }

  return {
    /** Call from a user gesture (the Start button) so the browser allows sound. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      // A low engine hum that follows the car's speed.
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      // A two-tone siren, silent until the police are out.
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 720;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = false;
        sirenTimer = setInterval(() => {
          if (!ctx || muted) return;
          high = !high;
          sirenOsc.frequency.setValueAtTime(high ? 950 : 720, ctx.currentTime);
        }, 420);
      }
    },
    setMuted(v) {
      muted = v;
      if (master) master.gain.value = v ? 0 : 0.5;
    },
    get isMuted() { return muted; },
    /** 0..1: the engine hum follows the driven car's speed. */
    engine(amount) {
      if (!ctx || !engineOsc) return;
      try {
        engineOsc.frequency.setValueAtTime(55 + amount * 95, ctx.currentTime);
        engineGain.gain.setValueAtTime(muted ? 0 : amount * 0.12, ctx.currentTime);
      } catch { /* ignore */ }
    },
    setSiren(on) {
      if (!ctx || !sirenGain) return;
      try {
        sirenGain.gain.setValueAtTime(on && !muted ? 0.045 : 0, ctx.currentTime);
      } catch { /* ignore */ }
    },
    gunshot() {
      if (!ctx || muted || !noiseBuf) return;
      try {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        src.connect(filter); filter.connect(gain); gain.connect(master);
        src.start();
      } catch { /* ignore */ }
    },
    punch() { tone(150, 0.14, 'sine', 0.4, 55); },
    hurt() { tone(110, 0.2, 'sawtooth', 0.25, 60); },
    thud() { tone(90, 0.16, 'sine', 0.35, 45); },
    click() { tone(1200, 0.04, 'square', 0.12); },
    reload() { tone(700, 0.06, 'square', 0.15); setTimeout(() => tone(900, 0.06, 'square', 0.15), 120); },
    pickup() { tone(880, 0.12, 'sine', 0.3); setTimeout(() => tone(1318, 0.18, 'sine', 0.3), 110); },
    jingle() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.28), i * 110));
    },
    stop() {
      if (sirenTimer) clearInterval(sirenTimer);
    },
  };
}
