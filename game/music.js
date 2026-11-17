// A generative music sequencer: a slow pentatonic melody over a deep bass
// pulse, synthesized through the game's AudioEngine, so no audio files ship.
// It starts on the first user gesture (when the audio context exists), stays
// quiet under the sound effects, and follows the master mute like everything
// else, since every note goes through the engine's master gain.

import { makeRng } from './rng.js';

const MELODY = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const BASS = [110.0, 87.31, 98.0, 130.81];
const STEP_SECONDS = 0.29;
const PATTERN = [0, -1, 2, -1, 4, 3, -1, 5, 0, -1, 3, 2, -1, 4, 6, -1];

export class MusicSequencer {
  constructor(seed) {
    this.rng = makeRng((seed ^ 0x51ed27) >>> 0);
    this.engine = null;
    this.timer = null;
    this.step = 0;
    this.playing = false;
    this.octaveUp = this.rng.chance(0.5);
  }

  attach(engine) {
    this.engine = engine;
  }

  start() {
    if (this.playing || !this.engine) return;
    this.playing = true;
    this.timer = setInterval(() => this.playStep(), STEP_SECONDS * 1000);
  }

  stop() {
    this.playing = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  playStep() {
    const engine = this.engine;
    if (!engine || !engine.ctx) return;
    const slot = PATTERN[this.step % PATTERN.length];
    if (this.step % 8 === 0) {
      const bass = BASS[Math.floor(this.step / 8) % BASS.length];
      engine.tone({ freq: bass, type: 'sine', dur: 1.1, gain: 0.055 });
    }
    if (slot >= 0) {
      let freq = MELODY[slot % MELODY.length];
      if (this.octaveUp && slot >= 4) freq *= 2;
      if (this.rng.chance(0.12)) freq *= 1.5;
      engine.tone({ freq, type: 'triangle', dur: 0.5, gain: 0.038 });
    } else if (this.rng.chance(0.1)) {
      engine.tone({ freq: MELODY[this.rng.int(0, MELODY.length - 1)] * 2, type: 'sine', dur: 0.7, gain: 0.02 });
    }
    this.step += 1;
  }
}
