/**
 * Procedural WebAudio sound. No asset files -- every shot, coin and grunt
 * is synthesised so the repo stays dependency-free and instant to load.
 */

export class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.lastShot = 0;
  }

  unlock() {
    if (this.ctx) return this.ctx;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (this.master) this.master.gain.value = on ? 0.55 : 0;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  noiseBuffer(seconds = 0.3) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Generic pluck/shot: filtered noise burst with a fast decay. */
  burst({ freq = 800, decay = 0.12, gain = 0.3, type = 'bandpass', q = 1.2, sweepTo = null }) {
    if (!this.enabled || !this.unlock()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(decay + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + decay);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + decay + 0.06);
  }

  tone({ freq = 440, to = null, decay = 0.12, gain = 0.18, type = 'sine', delay = 0 }) {
    if (!this.enabled || !this.unlock()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  shot(gunId = '') {
    // Rate-limit so automatic weapons do not melt the audio graph.
    const t = performance.now();
    if (t - this.lastShot < 22) return;
    this.lastShot = t;
    const heavy = /buffalo|gatling|dynamite|boomstick|coach/.test(gunId);
    this.burst({ freq: heavy ? 380 : 1100, sweepTo: heavy ? 90 : 300, decay: heavy ? 0.22 : 0.1, gain: heavy ? 0.4 : 0.28, q: 0.9 });
    this.tone({ freq: heavy ? 110 : 190, to: 45, decay: heavy ? 0.2 : 0.09, gain: 0.22, type: 'square' });
  }

  enemyShot() {
    this.burst({ freq: 700, sweepTo: 220, decay: 0.09, gain: 0.16, q: 1.4 });
  }

  dryFire() {
    this.burst({ freq: 2600, decay: 0.035, gain: 0.14, q: 3 });
  }

  reload() {
    this.tone({ freq: 320, to: 180, decay: 0.07, gain: 0.14, type: 'square' });
    this.tone({ freq: 240, to: 140, decay: 0.08, gain: 0.13, type: 'square', delay: 0.13 });
  }

  hit() {
    this.burst({ freq: 1800, decay: 0.045, gain: 0.12, q: 2.4 });
  }

  crit() {
    this.tone({ freq: 1400, to: 2200, decay: 0.08, gain: 0.12, type: 'triangle' });
  }

  kill() {
    this.burst({ freq: 260, sweepTo: 70, decay: 0.2, gain: 0.24, q: 0.8 });
  }

  explosion() {
    this.burst({ freq: 240, sweepTo: 40, decay: 0.55, gain: 0.5, q: 0.6 });
    this.tone({ freq: 80, to: 30, decay: 0.5, gain: 0.3, type: 'sine' });
  }

  coin() {
    this.tone({ freq: 1180, decay: 0.07, gain: 0.13, type: 'triangle' });
    this.tone({ freq: 1620, decay: 0.09, gain: 0.1, type: 'triangle', delay: 0.045 });
  }

  pickup() {
    this.tone({ freq: 620, to: 940, decay: 0.12, gain: 0.14, type: 'sine' });
  }

  hurt() {
    this.burst({ freq: 420, sweepTo: 120, decay: 0.24, gain: 0.3, q: 0.7 });
  }

  dash() {
    this.burst({ freq: 900, sweepTo: 260, decay: 0.16, gain: 0.16, q: 0.8 });
  }

  waveStart() {
    this.tone({ freq: 300, to: 450, decay: 0.3, gain: 0.16, type: 'sawtooth' });
    this.tone({ freq: 450, to: 600, decay: 0.35, gain: 0.13, type: 'sawtooth', delay: 0.16 });
  }

  victory() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, decay: 0.4, gain: 0.15, type: 'triangle', delay: i * 0.13 }));
  }

  defeat() {
    [392, 330, 262, 196].forEach((f, i) => this.tone({ freq: f, to: f * 0.9, decay: 0.5, gain: 0.16, type: 'sawtooth', delay: i * 0.18 }));
  }

  buy() {
    this.tone({ freq: 880, decay: 0.08, gain: 0.13, type: 'triangle' });
    this.tone({ freq: 1320, decay: 0.1, gain: 0.11, type: 'triangle', delay: 0.06 });
  }

  error() {
    this.tone({ freq: 200, to: 120, decay: 0.18, gain: 0.16, type: 'square' });
  }
}
