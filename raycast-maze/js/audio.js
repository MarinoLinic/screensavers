// Tiny procedural WebAudio SFX. No assets; fails silent if unsupported.
(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};

  class AudioEngine {
    constructor(enabled) {
      this.enabled = enabled !== false;
      this.context = null;
      this.noise = null;
      this.lastStep = 0;
    }

    unlock() {
      if (typeof window === 'undefined') return;
      if (this.context) {
        // The context already exists: an enabled user gesture resumes it
        // rather than building a second one.
        this.syncState();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.context = new AC();
        const length = Math.floor(this.context.sampleRate * 0.25);
        this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
        this.syncState();
      } catch (error) {
        this.context = null;
      }
    }

    // Bring the context's running state in line with `enabled`.
    syncState() {
      const context = this.context;
      if (!context) return;
      try {
        if (this.enabled && context.state === 'suspended' && context.resume) {
          const pending = context.resume();
          if (pending && pending.catch) pending.catch(() => {});
        } else if (!this.enabled && context.state === 'running' &&
            context.suspend) {
          const pending = context.suspend();
          if (pending && pending.catch) pending.catch(() => {});
        }
      } catch (error) {
        // Audio stays silent; never let a driver quirk break the game.
      }
    }

    setEnabled(enabled) {
      this.enabled = !!enabled;
      this.syncState();
    }

    tone(freqA, freqB, duration, type, gain) {
      if (!this.context || !this.enabled) return;
      const t0 = this.context.currentTime;
      const osc = this.context.createOscillator();
      const vol = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqA, t0);
      if (freqB && freqB !== freqA) {
        osc.frequency.exponentialRampToValueAtTime(freqB, t0 + duration);
      }
      vol.gain.setValueAtTime(gain, t0);
      vol.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(vol).connect(this.context.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }

    chord(freqs, duration, type, gain) {
      freqs.forEach((f, i) => {
        setTimeout(() => this.tone(f, f, duration, type, gain), i * 55);
      });
    }

    play(name) {
      if (!this.enabled || !this.context) return;
      const now = performance.now();
      switch (name) {
        case 'ui': this.tone(520, 520, 0.04, 'square', 0.05); break;
        case 'step': {
          if (now - this.lastStep < 75) return;
          this.lastStep = now;
          this.noiseBurst(0.045, 0.02, 900);
          break;
        }
        case 'relic': this.chord([660, 880], 0.09, 'sine', 0.07); break;
        case 'power': this.chord([523, 659, 784], 0.14, 'square', 0.05); break;
        case 'inversion': this.tone(180, 720, 0.30, 'sawtooth', 0.05); break;
        case 'exit': this.chord([440, 554, 659], 0.16, 'triangle', 0.06); break;
        case 'bump':
          this.noiseBurst(0.06, 0.05, 400);
          this.tone(90, 90, 0.10, 'square', 0.05);
          break;
        case 'slow': this.tone(180, 90, 0.20, 'triangle', 0.06); break;
        case 'reverse': this.tone(220, 110, 0.24, 'sawtooth', 0.05); break;
        case 'boost': this.tone(440, 880, 0.18, 'square', 0.05); break;
        case 'warp': this.tone(740, 220, 0.18, 'sine', 0.06); break;
        default: break;
      }
    }

    noiseBurst(duration, gain, filterFreq) {
      if (!this.context || !this.noise || !this.enabled) return;
      const t0 = this.context.currentTime;
      const src = this.context.createBufferSource();
      src.buffer = this.noise;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const vol = this.context.createGain();
      vol.gain.setValueAtTime(gain, t0);
      vol.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      src.connect(filter).connect(vol).connect(this.context.destination);
      src.start(t0);
      src.stop(t0 + duration + 0.02);
    }
  }

  Maze3D.AudioEngine = AudioEngine;
})();
