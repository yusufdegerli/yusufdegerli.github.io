const SFX = {
  ctx: null,
  master: null,
  enabled: true,
  lastVoice: 0,

  unlock() {
    try {
      if (this.ctx) {
        if (this.ctx.state === "suspended" && this.ctx.resume) this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        this.enabled = false;
        return;
      }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.38;
      this.master.connect(this.ctx.destination);
    } catch (err) {
      this.ctx = null;
      this.enabled = false;
    }
  },

  t() {
    return this.ctx ? this.ctx.currentTime : 0;
  },

  out() {
    return this.master;
  },

  env(gain, t0, a, s, r, peak) {
    try {
      const p = Math.max(0.0001, peak || 0.0001);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(p, t0 + Math.max(0.01, a));
      gain.gain.exponentialRampToValueAtTime(p * 0.7, t0 + Math.max(0.01, a) + Math.max(0.01, s));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.01, a) + Math.max(0.01, s) + Math.max(0.01, r));
    } catch (err) {}
  },

  noise(seconds) {
    const n = Math.max(1, (this.ctx.sampleRate * seconds) | 0);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  },

  tone(type, freq, t0, dur, peak, dest) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    this.env(g, t0, 0.01, dur * 0.35, dur * 0.6, peak);
    o.connect(g);
    g.connect(dest || this.out());
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  },

  rustle() {
    if (!this.ctx) return;
    const t0 = this.t();
    const src = this.noise(1.05);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.08);
    for (let i = 0; i < 6; i++) {
      const tt = t0 + 0.12 + i * 0.14;
      g.gain.exponentialRampToValueAtTime(0.08 + Math.random() * 0.14, tt);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 14;
    lg.gain.value = 700;
    lfo.connect(lg);
    lg.connect(bp.frequency);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.out());
    src.start(t0);
    lfo.start(t0);
    src.stop(t0 + 1.05);
    lfo.stop(t0 + 1.05);
  },

  chop() {
    if (!this.ctx) return;
    const t0 = this.t();
    const src = this.noise(0.18);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const g = this.ctx.createGain();
    this.env(g, t0, 0.005, 0.03, 0.12, 0.28);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.out());
    src.start(t0);
    src.stop(t0 + 0.2);
    this.tone("sine", 90, t0, 0.16, 0.22);
    this.tone("triangle", 220, t0 + 0.01, 0.08, 0.08);
  },

  mine() {
    if (!this.ctx) return;
    const t0 = this.t();
    this.tone("square", 620, t0, 0.06, 0.07);
    this.tone("triangle", 310, t0 + 0.02, 0.1, 0.1);
    const src = this.noise(0.12);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 2;
    const g = this.ctx.createGain();
    this.env(g, t0, 0.002, 0.02, 0.08, 0.16);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.out());
    src.start(t0);
    src.stop(t0 + 0.12);
  },

  voice(job) {
    if (!this.ctx) return;
    const now = this.t();
    if (now - this.lastVoice < 0.12) return;
    this.lastVoice = now;
    const spec = VOICE_JOBS[job] || VOICE_JOBS.villager;
    const t0 = now;
    const syllables = 2 + ((Math.random() * 3) | 0);
    let t = t0;
    const base = spec.base + (Math.random() * 2 - 1) * spec.spread;
    for (let i = 0; i < syllables; i++) {
      const dur = (0.07 + Math.random() * 0.08) / spec.rate;
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      const formant = 500 + Math.random() * 900;
      f.frequency.setValueAtTime(formant, t);
      f.Q.value = 4;
      o.type = "sawtooth";
      o2.type = "triangle";
      const freq = base * (0.92 + Math.random() * 0.2);
      o.frequency.setValueAtTime(freq, t);
      o2.frequency.setValueAtTime(freq * 0.5, t);
      this.env(g, t, 0.015, dur * 0.4, dur * 0.5, 0.09);
      o.connect(f);
      o2.connect(f);
      f.connect(g);
      if (spec.grit > 0) {
        const n = this.noise(dur + 0.05);
        const ng = this.ctx.createGain();
        ng.gain.value = spec.grit * 0.08;
        n.connect(ng);
        ng.connect(g);
        n.start(t);
        n.stop(t + dur + 0.05);
      }
      g.connect(this.out());
      o.start(t);
      o2.start(t);
      o.stop(t + dur + 0.04);
      o2.stop(t + dur + 0.04);
      t += dur + 0.025;
    }
  },

  ui() {
    if (!this.ctx) return;
    const t0 = this.t();
    this.tone("triangle", 520, t0, 0.06, 0.06);
    this.tone("sine", 780, t0 + 0.02, 0.05, 0.04);
  },

  place() {
    if (!this.ctx) return;
    const t0 = this.t();
    this.tone("sine", 140, t0, 0.12, 0.12);
    const src = this.noise(0.16);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const g = this.ctx.createGain();
    this.env(g, t0, 0.005, 0.04, 0.1, 0.18);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.out());
    src.start(t0);
    src.stop(t0 + 0.16);
  },

  hit() {
    if (!this.ctx) return;
    const t0 = this.t();
    this.tone("square", 180 + Math.random() * 40, t0, 0.07, 0.08);
    const src = this.noise(0.08);
    const g = this.ctx.createGain();
    this.env(g, t0, 0.002, 0.015, 0.05, 0.14);
    src.connect(g);
    g.connect(this.out());
    src.start(t0);
    src.stop(t0 + 0.08);
  },

  death() {
    if (!this.ctx) return;
    const t0 = this.t();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, t0);
    o.frequency.exponentialRampToValueAtTime(70, t0 + 0.28);
    this.env(g, t0, 0.01, 0.08, 0.22, 0.1);
    o.connect(g);
    g.connect(this.out());
    o.start(t0);
    o.stop(t0 + 0.32);
  },

  done() {
    if (!this.ctx) return;
    const t0 = this.t();
    this.tone("triangle", 440, t0, 0.1, 0.07);
    this.tone("triangle", 660, t0 + 0.08, 0.14, 0.07);
  },

  ageFanfare() {
    if (!this.ctx) return;
    const t0 = this.t();
    [262, 330, 392, 523].forEach((f, i) => {
      this.tone("triangle", f, t0 + i * 0.12, 0.28, 0.1);
    });
  },

  shoot() {
    if (!this.ctx) return;
    const t0 = this.t();
    this.tone("square", 480, t0, 0.05, 0.05);
    const src = this.noise(0.07);
    const g = this.ctx.createGain();
    this.env(g, t0, 0.002, 0.01, 0.05, 0.1);
    src.connect(g);
    g.connect(this.out());
    src.start(t0);
    src.stop(t0 + 0.07);
  },

  clickWorld(kind, job) {
    if (kind === "food") this.rustle();
    else if (kind === "wood") this.chop();
    else if (kind === "gold" || kind === "stone") this.mine();
    else if (job) this.voice(job);
  },
};
