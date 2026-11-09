/** @file Pooled particle SOA. Owners are cleared on entity removal. */

const MAX = 1200;

export class Particles {
  constructor() {
    this.x = new Float32Array(MAX);
    this.y = new Float32Array(MAX);
    this.vx = new Float32Array(MAX);
    this.vy = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.max = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.r = new Uint8Array(MAX);
    this.g = new Uint8Array(MAX);
    this.b = new Uint8Array(MAX);
    this.kind = new Uint8Array(MAX);
    this.owner = new Int32Array(MAX);
    this.alive = new Uint8Array(MAX);
    this.count = 0;
    this._free = [];
    for (let i = MAX - 1; i >= 0; i--) this._free.push(i);
  }

  spawn(x, y, vx, vy, life, size, type, r, g, b, owner = 0) {
    const i = this._free.pop();
    if (i == null) return -1;
    this.x[i] = x; this.y[i] = y;
    this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life;
    this.size[i] = size;
    this.r[i] = r; this.g[i] = g; this.b[i] = b;
    this.kind[i] = type === "spark" ? 1 : type === "gas" ? 2 : type === "smoke" ? 3 : 0;
    this.owner[i] = owner || 0;
    this.alive[i] = 1;
    this.count++;
    return i;
  }

  burst(x, y, type, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 50;
      const col = type === "spark"
        ? [255, 200, 80]
        : type === "gas"
          ? [120, 210, 255]
          : [160, 110, 80];
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 10, 0.35 + Math.random() * 0.4, 2 + Math.random() * 2, type, col[0], col[1], col[2], 0);
    }
  }

  kill(i) {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.owner[i] = 0;
    this.life[i] = 0;
    this.count--;
    this._free.push(i);
  }

  killOwner(id) {
    for (let i = 0; i < MAX; i++) {
      if (this.alive[i] && this.owner[i] === id) this.kill(i);
    }
  }

  clear() {
    for (let i = 0; i < MAX; i++) {
      this.alive[i] = 0;
      this.owner[i] = 0;
      this.life[i] = 0;
    }
    this.count = 0;
    this._free.length = 0;
    for (let i = MAX - 1; i >= 0; i--) this._free.push(i);
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kill(i);
        continue;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      if (this.kind[i] === 0) this.vy[i] += 80 * dt;
      if (this.kind[i] === 2) {
        this.vy[i] -= 18 * dt;
        this.vx[i] *= 0.98;
      }
      if (this.kind[i] === 3) {
        this.vy[i] -= 8 * dt;
        this.vx[i] *= 0.96;
      }
      if (this.kind[i] === 1) this.vy[i] += 40 * dt;
    }
  }

  destroy() {
    this.clear();
  }
}
