const Cam = {
  x: 0,
  y: 0,
  z: 1,
  w: 800,
  h: 600,
  dragging: false,
  dx: 0,
  dy: 0,

  worldW() {
    return CFG.mapW * CFG.tile;
  },
  worldH() {
    return CFG.mapH * CFG.tile;
  },

  resize(cw, ch) {
    this.w = cw;
    this.h = ch;
    this.clamp();
  },

  clamp() {
    const vw = this.w / this.z;
    const vh = this.h / this.z;
    const ww = this.worldW();
    const wh = this.worldH();
    if (vw >= ww) this.x = (ww - vw) / 2;
    else this.x = U.clamp(this.x, 0, ww - vw);
    if (vh >= wh) this.y = (wh - vh) / 2;
    else this.y = U.clamp(this.y, 0, wh - vh);
  },

  centerOn(x, y) {
    this.x = x - this.w / (2 * this.z);
    this.y = y - this.h / (2 * this.z);
    this.clamp();
  },

  toWorld(sx, sy) {
    return { x: this.x + sx / this.z, y: this.y + sy / this.z };
  },

  toScreen(wx, wy) {
    return { x: (wx - this.x) * this.z, y: (wy - this.y) * this.z };
  },

  zoomAt(sx, sy, dir) {
    const before = this.toWorld(sx, sy);
    this.z = U.clamp(this.z * (dir > 0 ? 1.1 : 0.9), CFG.zoomMin, CFG.zoomMax);
    const after = this.toWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  },

  update(dt, input) {
    let vx = 0;
    let vy = 0;
    if (input.down("KeyW") || input.down("ArrowUp")) vy -= 1;
    if (input.down("KeyS") || input.down("ArrowDown")) vy += 1;
    if (input.down("KeyA") || input.down("ArrowLeft")) vx -= 1;
    if (input.down("KeyD") || input.down("ArrowRight")) vx += 1;
    if (vx || vy) {
      const inv = 1 / Math.hypot(vx, vy);
      this.x += vx * inv * CFG.keyPanSpeed * dt / this.z;
      this.y += vy * inv * CFG.keyPanSpeed * dt / this.z;
    }
    if (input.inside && !input.overUi) {
      if (input.sx < CFG.edgePan) this.x -= CFG.edgePanSpeed * dt / this.z;
      if (input.sx > this.w - CFG.edgePan) this.x += CFG.edgePanSpeed * dt / this.z;
      if (input.sy < CFG.edgePan) this.y -= CFG.edgePanSpeed * dt / this.z;
      if (input.sy > this.h - CFG.edgePan) this.y += CFG.edgePanSpeed * dt / this.z;
    }
    this.clamp();
  },

  apply(ctx) {
    ctx.scale(this.z, this.z);
    ctx.translate(-this.x, -this.y);
  },

  viewTiles() {
    const pad = 2;
    const x0 = Math.max(0, Math.floor(this.x / CFG.tile) - pad);
    const y0 = Math.max(0, Math.floor(this.y / CFG.tile) - pad);
    const x1 = Math.min(CFG.mapW - 1, Math.ceil((this.x + this.w / this.z) / CFG.tile) + pad);
    const y1 = Math.min(CFG.mapH - 1, Math.ceil((this.y + this.h / this.z) / CFG.tile) + pad);
    return { x0, y0, x1, y1 };
  },
};
