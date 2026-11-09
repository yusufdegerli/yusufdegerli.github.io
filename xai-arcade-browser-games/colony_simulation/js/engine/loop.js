/** @file requestAnimationFrame game loop with fixed simulation timestep. */

export class GameLoop {
  constructor() {
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.acc = 0;
    this.step = 1 / 60;
    this.maxFrame = 0.05;
    this.onUpdate = null;
    this.onRender = null;
    this.fps = 60;
    this._frames = 0;
    this._fpsT = 0;
    this._bound = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now() / 1000;
    this.raf = requestAnimationFrame(this._bound);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _frame(nowMs) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._bound);
    const now = nowMs / 1000;
    let dt = now - this.last;
    this.last = now;
    if (dt > this.maxFrame) dt = this.maxFrame;
    this.acc += dt;
    this._frames++;
    this._fpsT += dt;
    if (this._fpsT >= 0.4) {
      this.fps = this._frames / this._fpsT;
      this._frames = 0;
      this._fpsT = 0;
    }
    let steps = 0;
    while (this.acc >= this.step && steps < 5) {
      if (this.onUpdate) this.onUpdate(this.step);
      this.acc -= this.step;
      steps++;
    }
    const alpha = this.acc / this.step;
    if (this.onRender) this.onRender(dt, alpha);
  }
}
