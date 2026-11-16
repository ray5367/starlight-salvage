// Every sound is synthesized with WebAudio oscillators and filtered noise:
// no audio files ship with the game. The context is created on the first user
// gesture, as browsers require, and a quiet ambient pad runs from then on.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.padStarted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startPad();
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone({ freq, freqEnd = null, type = 'sine', dur = 0.15, gain = 0.2, delay = 0 }) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + dur);
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  noise({ dur = 0.4, gain = 0.3, freq = 800, quality = 0.8, delay = 0 }) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = quality;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    source.start(start);
  }

  click() {
    this.tone({ freq: 660, freqEnd: 520, type: 'triangle', dur: 0.07, gain: 0.15 });
  }

  zap() {
    this.tone({ freq: 1500, freqEnd: 210, type: 'sawtooth', dur: 0.18, gain: 0.11 });
  }

  chime() {
    this.tone({ freq: 880, dur: 0.12, gain: 0.18 });
    this.tone({ freq: 1318, dur: 0.2, gain: 0.16, delay: 0.08 });
  }

  explosion() {
    this.noise({ dur: 0.5, gain: 0.4, freq: 320, quality: 0.6 });
    this.tone({ freq: 130, freqEnd: 38, dur: 0.45, gain: 0.35 });
  }

  thud() {
    this.tone({ freq: 160, freqEnd: 70, dur: 0.12, gain: 0.22 });
  }

  fuelPickup() {
    this.tone({ freq: 520, freqEnd: 940, type: 'triangle', dur: 0.14, gain: 0.17 });
  }

  warning() {
    this.tone({ freq: 440, type: 'square', dur: 0.11, gain: 0.08 });
    this.tone({ freq: 440, type: 'square', dur: 0.11, gain: 0.08, delay: 0.18 });
  }

  arpeggio() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      this.tone({ freq, type: 'triangle', dur: 0.18, gain: 0.15, delay: i * 0.09 });
    });
  }

  startPad() {
    if (this.padStarted || !this.ctx) return;
    this.padStarted = true;
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.035;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const oscA = this.ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 110;
    const oscB = this.ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 164.81;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.014;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(padGain);
    padGain.connect(this.master);
    oscA.start();
    oscB.start();
    lfo.start();
  }
}
