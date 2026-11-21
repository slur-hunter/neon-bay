// Synthesized WebAudio only: engine hum, two-tone siren, blips, and a
// two-station car radio. Everything is best-effort and wrapped in try/catch;
// a missing or blocked AudioContext never breaks the game.
const STATIONS = [
  {
    name: 'SUNSET FM',
    track: 'Neon Nights — The Palms',
    tempo: 0.24,
    // scale degrees in A minor pentatonic, as semitone offsets from A3
    melody: [0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 5, 7, 12, 10, 7, 5],
  },
  {
    name: 'BAY 94',
    track: 'Harbour Lights — The Gulls',
    tempo: 0.3,
    melody: [0, 5, 7, 12, 7, 5, 3, 0, 3, 5, 10, 7, 5, 3, 0, -2],
  },
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.station = 0;
    this.radioStep = 0;
    this.radioTimer = 0;
    this.engine = null;
    this.engineGain = null;
    this.siren = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
    this.sirenTimer = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engine = this.ctx.createOscillator();
      this.engine.type = 'sawtooth';
      this.engine.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      this.engine.connect(lp);
      lp.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engine.start();
      this.siren = this.ctx.createOscillator();
      this.siren.type = 'square';
      this.siren.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.siren.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.siren.start();
    } catch (err) {
      this.ctx = null;
    }
  }

  blip(freq, dur = 0.08, type = 'square', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + dur + 0.02);
    } catch (err) {
      // ignore
    }
  }

  setEngine(speed, inCar) {
    if (!this.ctx) return;
    try {
      const target = this.muted || !inCar ? 0 : 0.03 + Math.min(0.05, Math.abs(speed) * 0.002);
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engine.frequency.setTargetAtTime(55 + Math.abs(speed) * 4, this.ctx.currentTime, 0.1);
    } catch (err) {
      // ignore
    }
  }

  setSiren(on) {
    if (!this.ctx) return;
    try {
      this.sirenGain.gain.setTargetAtTime(this.muted || !on ? 0 : 0.025, this.ctx.currentTime, 0.2);
    } catch (err) {
      // ignore
    }
  }

  update(dt, inCar) {
    if (!this.ctx) return;
    // siren two-tone
    if (this.sirenGain && this.sirenGain.gain.value > 0.001) {
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.42;
        this.sirenPhase = 1 - this.sirenPhase;
        try {
          this.siren.frequency.setTargetAtTime(this.sirenPhase ? 720 : 540, this.ctx.currentTime, 0.05);
        } catch (err) {
          // ignore
        }
      }
    }
    // radio: one soft triangle note per step, only in the car
    if (!inCar || this.muted) return;
    this.radioTimer -= dt;
    if (this.radioTimer > 0) return;
    const st = STATIONS[this.station];
    this.radioTimer = st.tempo;
    const deg = st.melody[this.radioStep % st.melody.length];
    this.radioStep += 1;
    const freq = 220 * Math.pow(2, deg / 12);
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.05, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + st.tempo * 0.9);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + st.tempo);
    } catch (err) {
      // ignore
    }
  }

  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.radioStep = 0;
    return STATIONS[this.station];
  }

  get stationInfo() {
    return STATIONS[this.station];
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      try {
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
      } catch (err) {
        // ignore
      }
    }
    return this.muted;
  }
}
