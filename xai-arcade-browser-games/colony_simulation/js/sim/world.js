/** @file Typed-array tile world. All grid state lives here. */

import {
  WORLD_W, WORLD_H, MAT, GAS_COUNT, LIQ_COUNT, MATERIALS,
  idx, inBounds, isSolidMat, isPermeableMat, DES,
} from "./constants.js";

export class World {
  constructor(w = WORLD_W, h = WORLD_H) {
    this.w = w;
    this.h = h;
    this.n = w * h;

    this.material = new Uint8Array(this.n);
    this.mass = new Float32Array(this.n);
    this.temp = new Float32Array(this.n);
    this.gas = new Float32Array(this.n * GAS_COUNT);
    this.liq = new Float32Array(this.n * LIQ_COUNT);
    this.wire = new Uint8Array(this.n);
    this.pipe = new Uint8Array(this.n);
    this.vent = new Uint8Array(this.n);
    this.automationWire = new Uint8Array(this.n);
    this.automaationWire = this.automationWire;
    this.autoSignal = new Uint8Array(this.n);
    this.desig = new Uint8Array(this.n);
    this.buildId = new Uint16Array(this.n);
    this.digProg = new Float32Array(this.n);
    this.dirty = new Uint8Array(this.n);
    this.active = new Uint8Array(this.n);

    this.buildings = [];
    this.nextBuildingId = 1;
    this.chunkDirty = new Uint8Array(Math.ceil(w / 16) * Math.ceil(h / 16));
    this.terrainRev = 1;
    this.networkRev = 1;
  }

  i(x, y) {
    return y * this.w + x;
  }

  in(x, y) {
    return inBounds(x, y, this.w, this.h);
  }

  mat(x, y) {
    return this.material[y * this.w + x];
  }

  setMat(x, y, id, temperature) {
    const i = y * this.w + x;
    this.material[i] = id;
    const def = MATERIALS[id];
    this.mass[i] = def.mass;
    if (temperature != null) this.temp[i] = temperature;
    this.markDirty(x, y);
  }

  markDirty(x, y) {
    const i = y * this.w + x;
    this.dirty[i] = 1;
    this.active[i] = 1;
    const cx = x >> 4;
    const cy = y >> 4;
    const cw = (this.w + 15) >> 4;
    this.chunkDirty[cy * cw + cx] = 1;
    this.terrainRev++;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (this.in(nx, ny)) this.active[ny * this.w + nx] = 1;
      }
    }
  }

  isSolid(x, y) {
    if (!this.in(x, y)) return true;
    return isSolidMat(this.material[y * this.w + x]);
  }

  isPermeable(x, y) {
    if (!this.in(x, y)) return false;
    const id = this.material[y * this.w + x];
    if (isPermeableMat(id)) return true;
    const bid = this.buildId[y * this.w + x];
    if (bid) {
      const b = this.buildings.find((k) => k.id === bid);
      if (b && b.type === "door" && b.open) return true;
    }
    return false;
  }

  canStand(x, y) {
    if (!this.in(x, y)) return false;
    const bid = this.buildId[y * this.w + x];
    if (bid) {
      const b = this.buildings.find((k) => k.id === bid);
      if (b && b.type === "door" && !b.open) return false;
    }
    const id = this.material[y * this.w + x];
    if (isSolidMat(id) && id !== MAT.MESH) return false;
    if (id === MAT.LADDER) return true;
    if (!this.in(x, y + 1)) return true;
    const below = this.material[(y + 1) * this.w + x];
    return isSolidMat(below) || below === MAT.LADDER;
  }

  canClimb(x, y) {
    return this.in(x, y) && this.material[y * this.w + x] === MAT.LADDER;
  }

  gasAt(i, g) {
    return this.gas[g * this.n + i];
  }

  setGas(i, g, v) {
    this.gas[g * this.n + i] = v < 0 ? 0 : v;
  }

  addGas(i, g, v) {
    const k = g * this.n + i;
    this.gas[k] = Math.max(0, this.gas[k] + v);
  }

  liqAt(i, l) {
    return this.liq[l * this.n + i];
  }

  addLiq(i, l, v) {
    const k = l * this.n + i;
    this.liq[k] = Math.max(0, this.liq[k] + v);
  }

  totalGas(i) {
    let s = 0;
    for (let g = 0; g < GAS_COUNT; g++) s += this.gas[g * this.n + i];
    return s;
  }

  totalLiq(i) {
    let s = 0;
    for (let l = 0; l < LIQ_COUNT; l++) s += this.liq[l * this.n + i];
    return s;
  }

  primaryLiq(i) {
    let best = 0, amt = 0;
    for (let l = 0; l < LIQ_COUNT; l++) {
      const v = this.liq[l * this.n + i];
      if (v > amt) { amt = v; best = l; }
    }
    return amt > 1 ? best : -1;
  }

  o2(x, y) {
    return this.gas[0 * this.n + y * this.w + x];
  }

  heatCapacity(i) {
    const mat = MATERIALS[this.material[i]];
    let cap = mat.mass * mat.heatCap;
    const tg = this.totalGas(i);
    if (tg > 0.5) cap += tg * 1.1;
    const tl = this.totalLiq(i);
    if (tl > 0.5) cap += tl * 4.0;
    return Math.max(cap, 1);
  }

  conductivity(i) {
    const mat = MATERIALS[this.material[i]];
    if (mat.id === MAT.VACUUM) {
      const tl = this.totalLiq(i);
      if (tl > 20) return 0.55;
      const tg = this.totalGas(i);
      if (tg > 2) return 0.03;
      return 0;
    }
    return mat.cond;
  }

  clearCellFluids(i) {
    for (let g = 0; g < GAS_COUNT; g++) this.gas[g * this.n + i] = 0;
    for (let l = 0; l < LIQ_COUNT; l++) this.liq[l * this.n + i] = 0;
  }

  designate(x, y, kind) {
    if (!this.in(x, y)) return;
    this.desig[y * this.w + x] = kind;
  }

  clearDesignation(x, y) {
    if (!this.in(x, y)) return;
    this.desig[y * this.w + x] = DES.NONE;
    this.digProg[y * this.w + x] = 0;
  }
}

export { idx, DES };
