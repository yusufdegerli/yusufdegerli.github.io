export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  unlock() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.enabled = false;
      return;
    }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    this.unlock();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone({
    freq = 220,
    dur = 0.12,
    type = "square",
    gain = 0.3,
    slide = 0,
    delay = 0,
    filter = 0,
  }) {
    if (!this.enabled || !this.ctx) return;
    const t = this.now() + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filter;
      osc.connect(f);
      f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise({ dur = 0.1, gain = 0.18, filter = 1200, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const t = this.now() + delay;
    const size = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = filter;
    f.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  jump() {
    this.tone({ freq: 320, dur: 0.09, type: "square", gain: 0.16, slide: 180 });
  }

  doubleJump() {
    this.tone({ freq: 380, dur: 0.1, type: "square", gain: 0.16, slide: 240 });
  }

  land() {
    this.noise({ dur: 0.07, gain: 0.1, filter: 400 });
  }

  dash() {
    this.noise({ dur: 0.12, gain: 0.2, filter: 1800 });
    this.tone({ freq: 180, dur: 0.1, type: "sawtooth", gain: 0.1, slide: 260, filter: 1400 });
  }

  dodge() {
    this.noise({ dur: 0.14, gain: 0.16, filter: 900 });
  }

  swing(step = 0) {
    const freq = 160 + step * 40;
    this.noise({ dur: 0.06, gain: 0.1, filter: 1400 });
    this.tone({ freq, dur: 0.08, type: "triangle", gain: 0.12, slide: -80 });
  }

  hit() {
    this.noise({ dur: 0.08, gain: 0.22, filter: 700 });
    this.tone({ freq: 90, dur: 0.1, type: "sawtooth", gain: 0.14, filter: 500 });
  }

  block() {
    this.tone({ freq: 140, dur: 0.08, type: "triangle", gain: 0.16 });
    this.noise({ dur: 0.06, gain: 0.1, filter: 500 });
  }

  parry() {
    this.tone({ freq: 880, dur: 0.12, type: "square", gain: 0.18, slide: 200 });
    this.tone({ freq: 1320, dur: 0.16, type: "triangle", gain: 0.12, delay: 0.02 });
    this.noise({ dur: 0.08, gain: 0.12, filter: 2400 });
  }

  hurt() {
    this.tone({ freq: 160, dur: 0.16, type: "sawtooth", gain: 0.16, slide: -90, filter: 600 });
    this.noise({ dur: 0.1, gain: 0.14, filter: 500 });
  }

  telegraph() {
    this.tone({ freq: 90, dur: 0.18, type: "sine", gain: 0.1 });
  }

  ageUp() {
    this.tone({ freq: 110, dur: 0.4, type: "sine", gain: 0.18, slide: -40 });
    this.tone({ freq: 165, dur: 0.45, type: "triangle", gain: 0.1, delay: 0.05 });
    this.tone({ freq: 55, dur: 0.5, type: "sine", gain: 0.16, delay: 0.02 });
  }

  death() {
    this.tone({ freq: 80, dur: 0.7, type: "sine", gain: 0.2, slide: -50 });
    this.tone({ freq: 60, dur: 0.9, type: "triangle", gain: 0.12, delay: 0.08 });
  }

  ui() {
    this.tone({ freq: 440, dur: 0.07, type: "square", gain: 0.08 });
  }

  special() {
    this.tone({ freq: 520, dur: 0.14, type: "square", gain: 0.14, slide: 280, filter: 1800 });
    this.tone({ freq: 220, dur: 0.12, type: "sawtooth", gain: 0.1, filter: 900 });
    this.noise({ dur: 0.08, gain: 0.1, filter: 2000 });
  }

  boom() {
    this.noise({ dur: 0.22, gain: 0.24, filter: 400 });
    this.tone({ freq: 70, dur: 0.28, type: "sine", gain: 0.18, slide: -30 });
  }
}

export const audio = new AudioBus();
