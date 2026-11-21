// Sound: synthesized WebAudio only, lazy context on first gesture.
// Engine hum that rises with speed, a two-tone siren when wanted, short blips
// for pickup / punch / click / crash / busted. Radio: 2 real stations with a
// name + track each, toggled by M in the car, playing synthesized notes.
// Silent on foot. All best-effort (try/catch everywhere).
export const STATIONS = [
  { name: 'SUNSET FM', track: 'Neon Nights — The Palms', scale: [0, 3, 5, 7, 10] },
  { name: 'BAY 94', track: 'Harbour Lights — Marina Blue', scale: [0, 2, 4, 7, 9] },
];

export function buildSound() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = null;
  let radioTimer = null;
  let radioOn = false;
  let stationIdx = 0;
  let muted = false;
  let noteStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch (e) { /* silent */ }
  }

  function pickup() { blip(880, 0.18, 'sine', 0.16); blip(1320, 0.22, 'sine', 0.1); }
  function punch() { blip(160, 0.1, 'square', 0.16); }
  function click() { blip(660, 0.06, 'square', 0.08); }
  function crash() { blip(90, 0.25, 'sawtooth', 0.2); }
  function busted() { blip(220, 0.5, 'sawtooth', 0.18); blip(180, 0.6, 'sawtooth', 0.14); }

  function engine(speedNorm) {
    if (!ctx || muted) return;
    try {
      engineGain.gain.value = 0.03 + speedNorm * 0.06;
      engineOsc.frequency.value = 55 + speedNorm * 130;
    } catch (e) { /* silent */ }
  }

  function siren(on) {
    if (on && !sirenTimer) {
      sirenTimer = setInterval(() => {
        if (muted) return;
        blip(720, 0.32, 'sine', 0.05);
        setTimeout(() => blip(540, 0.32, 'sine', 0.05), 340);
      }, 700);
    } else if (!on && sirenTimer) {
      clearInterval(sirenTimer);
      sirenTimer = null;
    }
  }

  function radioTick() {
    if (!radioOn || muted || !ctx) return;
    try {
      const st = STATIONS[stationIdx];
      const base = 220 * Math.pow(2, st.scale[noteStep % st.scale.length] / 12);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = base;
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.45);
      noteStep++;
    } catch (e) { /* silent */ }
  }

  function radioStart() {
    if (!ensure()) return;
    radioOn = true;
    if (!radioTimer) radioTimer = setInterval(radioTick, 420);
  }
  function radioStop() {
    radioOn = false;
  }
  function nextStation() {
    stationIdx = (stationIdx + 1) % STATIONS.length;
    noteStep = 0;
    click();
    return STATIONS[stationIdx];
  }
  function station() {
    return STATIONS[stationIdx];
  }
  function isRadioOn() {
    return radioOn;
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.4;
    return muted;
  }
  function isMuted() {
    return muted;
  }

  return {
    ensure, pickup, punch, click, crash, busted, engine, siren,
    radioStart, radioStop, nextStation, station, isRadioOn,
    toggleMute, isMuted, STATIONS,
  };
}
