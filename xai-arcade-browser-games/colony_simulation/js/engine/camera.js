/** @file Pan / zoom camera over the tile world. */

import { TILE, WORLD_W, WORLD_H } from "../sim/constants.js";

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.15;
    this.minZ = 0.45;
    this.maxZ = 2.4;
    this.vw = 800;
    this.vh = 600;
    this._tx = 0;
    this._ty = 0;
    this._tz = 1.15;
  }

  resize(w, h) {
    this.vw = w;
    this.vh = h;
  }

  focus(tx, ty) {
    this._tx = tx * TILE - this.vw / (2 * this.zoom);
    this._ty = ty * TILE - this.vh / (2 * this.zoom);
    this.x = this._tx;
    this.y = this._ty;
  }

  pan(dx, dy) {
    this._tx += dx / this.zoom;
    this._ty += dy / this.zoom;
    this._clamp();
  }

  zoomAt(cx, cy, factor) {
    const before = this.screenToWorld(cx, cy);
    this._tz = Math.max(this.minZ, Math.min(this.maxZ, this._tz * factor));
    this.zoom = this._tz;
    const after = this.screenToWorld(cx, cy);
    this._tx += before.x - after.x;
    this._ty += before.y - after.y;
    this._clamp();
  }

  update(dt) {
    this.x += (this._tx - this.x) * Math.min(1, dt * 14);
    this.y += (this._ty - this.y) * Math.min(1, dt * 14);
    this.zoom += (this._tz - this.zoom) * Math.min(1, dt * 14);
  }

  _clamp() {
    const ww = WORLD_W * TILE;
    const wh = WORLD_H * TILE;
    const vw = this.vw / this._tz;
    const vh = this.vh / this._tz;
    this._tx = Math.max(-80, Math.min(ww - vw + 80, this._tx));
    this._ty = Math.max(-80, Math.min(wh - vh + 80, this._ty));
  }

  screenToWorld(sx, sy) {
    return { x: sx / this.zoom + this.x, y: sy / this.zoom + this.y };
  }

  worldToScreen(wx, wy) {
    return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom };
  }

  tileAt(sx, sy) {
    const p = this.screenToWorld(sx, sy);
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  }

  visibleTiles() {
    const pad = 2;
    const x0 = Math.max(0, Math.floor(this.x / TILE) - pad);
    const y0 = Math.max(0, Math.floor(this.y / TILE) - pad);
    const x1 = Math.min(WORLD_W - 1, Math.ceil((this.x + this.vw / this.zoom) / TILE) + pad);
    const y1 = Math.min(WORLD_H - 1, Math.ceil((this.y + this.vh / this.zoom) / TILE) + pad);
    return { x0, y0, x1, y1 };
  }

  apply(ctx) {
    ctx.transform(this.zoom, 0, 0, this.zoom, -this.x * this.zoom, -this.y * this.zoom);
  }
}
