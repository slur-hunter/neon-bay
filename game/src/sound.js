// Sound, all synthesised in the browser: two radio stations (a warm pad and a
// bassline), a two-tone siren while wanted, an engine hum tied to speed, and short
// blips for a punch, a pickup and a job done. Everything is guarded: no audio
// context, no sound, and never an error.
import { RADIOS } from './config.js';

const PAD_NOTES = [220, 261.63, 329.63, 392];
const BASS_NOTES = [55, 55, 65.41, 49];

export function createSound() {
  let ctx = null;
  let on = true;
  let radioIndex = 0;
  let radioTimer = null;
  let radioStep = 0;
  let sirenNodes = null;
  let engineNodes = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, seconds, type, volume, when = 0) {
    const audio = ensure();
    if (!audio || !on) return;
    try {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audio.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + when + seconds);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(audio.currentTime + when);
      osc.stop(audio.currentTime + when + seconds + 0.05);
    } catch {
      // Audio is best-effort only.
    }
  }

  function startRadio() {
    stopRadio();
    const audio = ensure();
    if (!audio || !on) return;
    try {
      radioTimer = window.setInterval(() => {
        if (!on) return;
        const notes = radioIndex === 0 ? PAD_NOTES : BASS_NOTES;
        const note = notes[radioStep % notes.length];
        tone(note, radioIndex === 0 ? 1.8 : 0.5, radioIndex === 0 ? 'sine' : 'triangle', 0.05);
        if (radioIndex === 0) tone(note * 1.5, 1.8, 'sine', 0.03);
        radioStep += 1;
      }, 450);
    } catch {
      radioTimer = null;
    }
  }

  function stopRadio() {
    if (radioTimer !== null) {
      window.clearInterval(radioTimer);
      radioTimer = null;
    }
  }

  function startSiren() {
    const audio = ensure();
    if (!audio || sirenNodes) return;
    try {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = 720;
      gain.gain.value = 0.02;
      const lfo = audio.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.4;
      const lfoGain = audio.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    } catch {
      sirenNodes = null;
    }
  }

  function stopSiren() {
    if (!sirenNodes) return;
    try {
      sirenNodes.osc.stop();
      sirenNodes.lfo.stop();
      sirenNodes.gain.disconnect();
    } catch {
      // Already stopped.
    }
    sirenNodes = null;
  }

  function startEngine() {
    const audio = ensure();
    if (!audio || engineNodes) return;
    try {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 70;
      gain.gain.value = 0.015;
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      engineNodes = { osc, gain };
    } catch {
      engineNodes = null;
    }
  }

  return {
    get on() {
      return on;
    },
    get radio() {
      return RADIOS[radioIndex];
    },

    unlock() {
      const audio = ensure();
      if (audio && audio.state === 'suspended') {
        audio.resume().catch(() => {});
      }
      startRadio();
    },

    toggle() {
      on = !on;
      if (!on) {
        stopRadio();
        stopSiren();
        if (engineNodes) {
          try {
            engineNodes.gain.gain.value = 0;
          } catch {
            // Already stopped.
          }
        }
      } else {
        startRadio();
      }
      return on;
    },

    nextRadio() {
      radioIndex = (radioIndex + 1) % RADIOS.length;
      radioStep = 0;
      startRadio();
    },

    punch() {
      tone(180, 0.12, 'square', 0.08);
    },

    collect() {
      tone(660, 0.15, 'sine', 0.09);
      tone(880, 0.2, 'sine', 0.09, 0.09);
    },

    jobDone() {
      tone(523.25, 0.2, 'sine', 0.1);
      tone(659.25, 0.2, 'sine', 0.1, 0.12);
      tone(783.99, 0.35, 'sine', 0.1, 0.24);
    },

    /** Called every frame: siren while wanted, engine hum while driving. */
    step(wanted, inCar, speed) {
      if (!on) return;
      if (wanted > 0) startSiren();
      else stopSiren();
      if (inCar) {
        startEngine();
        if (engineNodes) {
          try {
            engineNodes.osc.frequency.value = 60 + Math.abs(speed) * 4;
          } catch {
            // Engine already stopped.
          }
        }
      } else if (engineNodes) {
        try {
          engineNodes.gain.gain.value = 0;
        } catch {
          // Already stopped.
        }
      }
    },
  };
}
