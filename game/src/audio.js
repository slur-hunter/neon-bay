// audio.js — small WebAudio synth effects. Everything is guarded: audio only starts
// after a user gesture, and a failure never breaks the game.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenHigh = false;
    this.sirenTimer = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
    return this.muted;
  }

  engine(speed01, driving) {
    if (!this.ctx || this.muted) return;
    const target = driving ? 0.02 + speed01 * 0.05 : 0;
    this.engineGain.gain.value += (target - this.engineGain.gain.value) * 0.1;
    this.engineOsc.frequency.value = 50 + speed01 * 120;
  }

  siren(on, dt) {
    if (!this.ctx || this.muted) return;
    this.sirenTimer += dt;
    if (this.sirenTimer > 0.45) {
      this.sirenTimer = 0;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.value = this.sirenHigh ? 950 : 700;
    }
    const target = on ? 0.02 : 0;
    this.sirenGain.gain.value += (target - this.sirenGain.gain.value) * 0.1;
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.value = vol || 0.12;
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch { /* ignore */ }
  }

  chime() {
    this.blip(660, 0.18, 'sine', 0.14);
    setTimeout(() => this.blip(880, 0.3, 'sine', 0.14), 120);
  }

  thud() {
    this.blip(90, 0.18, 'triangle', 0.2);
  }

  click() {
    this.blip(1200, 0.05, 'square', 0.05);
  }
}
