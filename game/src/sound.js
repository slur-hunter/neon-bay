// Synthesized WebAudio only: a two-station car radio, an engine hum that
// rises with speed, a two-tone siren while wanted, and short blips. The
// audio context is created lazily on the first user gesture; everything is
// wrapped in try/catch so a missing audio device never breaks the game.
const STATIONS = [
  { name: 'SUNSET FM', track: 'Neon Nights — The Palms', scale: [220, 261.63, 293.66, 329.63, 392] },
  { name: 'BAY 94', track: 'Harbour Lights — The Gulls', scale: [196, 220, 246.94, 293.66, 329.63] },
];

export function makeSound() {
  let ctx = null;
  let master = null;
  let radioGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let station = 0;
  let muted = false;
  let radioTimer = null;
  let noteIndex = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.16;
      radioGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function playNote(freq, dur, type, vol) {
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.5, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(radioGain);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch { /* best effort */ }
  }

  function radioTick() {
    if (!ctx || muted) return;
    const st = STATIONS[station];
    const f = st.scale[noteIndex % st.scale.length] * (noteIndex % 8 < 4 ? 1 : 2);
    playNote(f, 0.34, 'triangle', 0.5);
    noteIndex += 1;
  }

  function startRadio() {
    if (!ensure()) return;
    if (radioTimer) return;
    radioTimer = setInterval(radioTick, 300);
  }
  function stopRadio() {
    if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
  }

  function blip(kind) {
    if (!ensure()) return;
    try {
      if (kind === 'pickup') { playNote(660, 0.12, 'sine', 0.6); playNote(880, 0.18, 'sine', 0.6); }
      else if (kind === 'punch') playNote(140, 0.1, 'square', 0.5);
      else if (kind === 'click') playNote(520, 0.06, 'sine', 0.4);
      else if (kind === 'crash') playNote(90, 0.25, 'sawtooth', 0.7);
      else if (kind === 'busted') { playNote(330, 0.2, 'square', 0.5); playNote(220, 0.4, 'square', 0.5); }
    } catch { /* best effort */ }
  }

  function engine(speed, inCar) {
    if (!ctx || !engineOsc) return;
    try {
      engineGain.gain.value = inCar ? 0.05 + Math.abs(speed) * 0.002 : 0;
      engineOsc.frequency.value = 50 + Math.abs(speed) * 4;
    } catch { /* best effort */ }
  }

  let sirenPhase = 0;
  function siren(on, dt) {
    if (!ctx || !sirenOsc) return;
    try {
      if (on) {
        sirenPhase += dt;
        sirenOsc.frequency.value = Math.floor(sirenPhase * 1.6) % 2 === 0 ? 660 : 520;
        sirenGain.gain.value = 0.05;
      } else {
        sirenGain.gain.value = 0;
      }
    } catch { /* best effort */ }
  }

  function setStation(i) {
    station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    noteIndex = 0;
  }
  function toggleStation() {
    setStation(station + 1);
  }
  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = muted ? 0 : 0.5;
  }

  return {
    ensure, startRadio, stopRadio, blip, engine, siren,
    setStation, toggleStation, setMuted,
    get station() { return STATIONS[station]; },
    get muted() { return muted; },
  };
}
