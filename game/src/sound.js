// Synthesized WebAudio only, lazy context on first gesture. Engine hum
// that rises with speed, a two-tone siren when wanted, short blips for
// pickup, punch, click, crash and busted. Plus the car radio: two real
// stations with a toggle, silent on foot. All best-effort.
export const STATIONS = [
  { name: 'SUNSET FM', track: 'Neon Nights — The Palms' },
  { name: 'BAY 94', track: 'Golden Hour Drive — Marina Lights' },
];

export function makeSound() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenT = 0;
  let muted = false;
  let station = 0;
  let radioTimer = null;
  let radioNote = 0;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }
  function blip(freq, dur, type = 'sine', vol = 0.25) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch { /* best effort */ }
  }
  function radioTick() {
    if (!ctx || muted || radioTimer === null) return;
    // A soft plucked note from the station's pentatonic line.
    const scales = [[262, 294, 330, 392, 440], [220, 262, 294, 330, 392]];
    const scale = scales[station % scales.length];
    const f = scale[radioNote % scale.length];
    radioNote += 1;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.5);
    } catch { /* best effort */ }
  }
  return {
    unlock() { ensure(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted: () => muted,
    station: () => STATIONS[station],
    nextStation() {
      station = (station + 1) % STATIONS.length;
      radioNote = 0;
      blip(880, 0.12, 'sine', 0.2);
      return STATIONS[station];
    },
    radioOn() {
      if (radioTimer !== null) return;
      if (!ensure()) return;
      radioTimer = window.setInterval(radioTick, 420);
    },
    radioOff() {
      if (radioTimer !== null) { window.clearInterval(radioTimer); radioTimer = null; }
    },
    pickup() { blip(660, 0.18); window.setTimeout(() => blip(990, 0.25), 90); },
    punch() { blip(140, 0.1, 'square', 0.3); },
    click() { blip(520, 0.06, 'sine', 0.15); },
    crash() { blip(90, 0.3, 'sawtooth', 0.35); },
    busted() { blip(220, 0.5, 'sawtooth', 0.3); window.setTimeout(() => blip(165, 0.6, 'sawtooth', 0.3), 200); },
    update(dt, speed, wanted) {
      if (!ctx) return;
      sirenT += dt;
      try {
        if (engineGain) engineGain.gain.value = muted ? 0 : Math.min(0.16, Math.abs(speed) * 0.005);
        if (engineOsc) engineOsc.frequency.value = 50 + Math.abs(speed) * 4;
        if (sirenGain) sirenGain.gain.value = (wanted > 0 && !muted) ? 0.045 : 0;
        if (sirenOsc && wanted > 0) sirenOsc.frequency.value = Math.sin(sirenT * 5) > 0 ? 750 : 560;
      } catch { /* best effort */ }
    },
  };
}
