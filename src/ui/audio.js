// Generativer Weltraum-Klang (WebAudio): tiefer Drone, dessen Filter mit dem Maßstab mitwandert.
export class SpaceAudio {
  constructor() {
    this.ctx = null;
    this.on = false;
  }
  _init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.connect(this.master);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 600;
    this.filter.Q.value = 4;
    this.filter.connect(comp);
    // Drone aus verstimmten Oszillatoren
    const base = [55, 82.4, 110.2, 164.8];
    this.oscs = base.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 7;
      const g = ctx.createGain();
      g.gain.value = 0.05 / (i + 1);
      o.connect(g).connect(this.filter);
      o.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain();
      lg.gain.value = 4;
      lfo.connect(lg).connect(o.detune);
      lfo.start();
      return o;
    });
    // Rauschen ("Sonnenwind")
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = 0.985 * b + 0.015 * (Math.random() * 2 - 1); data[i] = b * 6; }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.04;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 400;
    nf.Q.value = 0.7;
    this.noiseFilter = nf;
    src.connect(nf).connect(this.noiseGain).connect(comp);
    src.start();
  }
  toggle(force) {
    const want = force ?? !this.on;
    if (want) this._init();
    if (!this.ctx) return false;
    this.on = want;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(want ? 0.55 : 0, t, 0.6);
    return this.on;
  }
  // logR: log10 der Kameraentfernung (Lj); speed: 0..1
  update(logR, speed) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const f = 180 + (logR + 10) * 55 + speed * 1600;
    this.filter.frequency.setTargetAtTime(Math.max(120, f), t, 0.3);
    this.noiseGain.gain.setTargetAtTime(0.03 + speed * 0.22, t, 0.2);
    this.noiseFilter.frequency.setTargetAtTime(300 + speed * 2500, t, 0.2);
  }
  // Tonspur für Videoaufnahmen
  getStream() {
    if (!this.ctx) return null;
    if (!this.dest) {
      this.dest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.dest);
    }
    return this.dest.stream;
  }
  blip(freq = 880, dur = 0.12, vol = 0.08) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
