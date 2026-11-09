/** @file Batched canvas renderer with chunked terrain cache. */

import {
  TILE, MAT, MATERIALS, GAS, GASES, LIQUIDS, BUILDINGS, DES, hash2, WORLD_W, WORLD_H,
} from "../sim/constants.js";
import { sampleTempColor } from "../sim/heat.js";
import { neighborMask } from "../sim/networks.js";

const MAT_TEX = {
  [MAT.ROCK]: "rock",
  [MAT.HARDROCK]: "hardrock",
  [MAT.DIRT]: "dirt",
  [MAT.ORE]: "ore",
  [MAT.ICE]: "ice",
  [MAT.COAL]: "coal",
  [MAT.ORGANIC]: "organic",
};

const BLD_SPRITE = {
  oxygen: "oxygen",
  generator: "generator",
  battery: "battery",
};

export class Renderer {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.assets = assets;
    this.chunks = new Map();
    this.chunkW = 16;
    this.lastRev = -1;
    this.overlayBuf = null;
    this.time = 0;
    this.dpr = 1;
  }

  resize(w, h, dpr) {
    this.dpr = dpr || 1;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  destroy() {
    this.chunks.clear();
    this.overlayBuf = null;
    this.ctx = null;
  }

  render(state, dt) {
    this.time += dt;
    const { world, camera, crew, particles, tool, hover, drag, overlay, selected } = state;
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#0b0a12";
    ctx.fillRect(0, 0, w, h);

    this._rebuildDirtyChunks(world);

    ctx.save();
    camera.apply(ctx);
    ctx.imageSmoothingEnabled = false;

    this._drawBackground(ctx, camera, world);
    this._drawChunks(ctx, camera);
    this._drawFluids(ctx, world, camera);
    this._drawBuildings(ctx, world, camera);
    if (overlay === "power" || overlay === "plumb" || overlay === "vent" || overlay === "automation" || tool?.startsWith("build:")) {
      this._drawNetworks(ctx, world, camera, overlay, tool);
    }
    this._drawDesignations(ctx, world, camera);
    this._drawCrewShadows(ctx, crew);
    this._drawCrew(ctx, crew);
    this._drawParticles(ctx, particles);
    if (overlay && overlay !== "none") this._drawOverlay(ctx, world, camera, overlay);
    this._drawHover(ctx, state);
    ctx.restore();
  }

  _rebuildDirtyChunks(world) {
    const cw = this.chunkW;
    const nx = Math.ceil(world.w / cw);
    const ny = Math.ceil(world.h / cw);
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        const id = cy * nx + cx;
        if (!world.chunkDirty[id] && this.chunks.has(id)) continue;
        this._bakeChunk(world, cx, cy, id);
        world.chunkDirty[id] = 0;
      }
    }
  }

  _bakeChunk(world, cx, cy, id) {
    const cw = this.chunkW;
    const cnv = this.chunks.get(id) || document.createElement("canvas");
    cnv.width = cw * TILE;
    cnv.height = cw * TILE;
    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.imageSmoothingEnabled = false;
    const x0 = cx * cw, y0 = cy * cw;
    for (let y = 0; y < cw; y++) {
      const gy = y0 + y;
      if (gy >= world.h) continue;
      for (let x = 0; x < cw; x++) {
        const gx = x0 + x;
        if (gx >= world.w) continue;
        this._paintTile(ctx, world, gx, gy, x * TILE, y * TILE);
      }
    }
    this.chunks.set(id, cnv);
  }

  _paintTile(ctx, world, gx, gy, dx, dy) {
    const i = gy * world.w + gx;
    const mat = world.material[i];
    if (mat === MAT.VACUUM) {
      this._paintCaveHole(ctx, world, gx, gy, dx, dy);
      return;
    }
    const texName = MAT_TEX[mat];
    const tex = texName ? this.assets.tile(texName) : null;
    if (tex) {
      const src = 32;
      const hsh = hash2(gx, gy);
      const sx = (hsh % 7) * src;
      const sy = ((hsh >> 4) % 7) * src;
      ctx.drawImage(tex, sx, sy, src, src, dx, dy, TILE, TILE);
    } else {
      const col = MATERIALS[mat].color;
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.fillRect(dx, dy, TILE, TILE);
    }

    if (mat === MAT.WALL || mat === MAT.FLOOR || mat === MAT.INSULATION || mat === MAT.MESH) {
      this._paintBuilt(ctx, dx, dy, mat);
    }
    if (mat === MAT.LADDER) this._paintLadder(ctx, dx, dy);

    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx + TILE, dy);
    ctx.lineTo(dx + TILE, dy + TILE);
    ctx.lineTo(dx, dy + TILE);
    ctx.stroke();

    if (!world.isSolid(gx, gy - 1)) {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(dx, dy, TILE, 3);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(dx, dy, TILE, 1);
    }
  }

  _paintCaveHole(ctx, world, gx, gy, dx, dy) {
    let edge = false;
    if (world.isSolid(gx, gy - 1) || world.isSolid(gx, gy + 1) || world.isSolid(gx - 1, gy) || world.isSolid(gx + 1, gy)) edge = true;
    if (!edge) return;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    if (world.isSolid(gx, gy - 1)) ctx.fillRect(dx, dy, TILE, 4);
    if (world.isSolid(gx, gy + 1)) ctx.fillRect(dx, dy + TILE - 3, TILE, 3);
    if (world.isSolid(gx - 1, gy)) ctx.fillRect(dx, dy, 3, TILE);
    if (world.isSolid(gx + 1, gy)) ctx.fillRect(dx + TILE - 3, dy, 3, TILE);
  }

  _paintBuilt(ctx, dx, dy, mat) {
    const col = MATERIALS[mat].color;
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.fillRect(dx + 1, dy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(dx + 2, dy + 2, TILE - 4, 6);
    ctx.strokeStyle = "#1c1624";
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + 1.5, dy + 1.5, TILE - 3, TILE - 3);
    if (mat === MAT.MESH) {
      ctx.strokeStyle = "rgba(20,20,24,0.45)";
      ctx.lineWidth = 1;
      for (let i = 6; i < TILE; i += 6) {
        ctx.beginPath();
        ctx.moveTo(dx + i, dy + 2);
        ctx.lineTo(dx + i, dy + TILE - 2);
        ctx.stroke();
      }
    }
    if (mat === MAT.INSULATION) {
      ctx.fillStyle = "rgba(160,120,200,0.25)";
      ctx.fillRect(dx + 6, dy + 6, TILE - 12, TILE - 12);
    }
  }

  _paintLadder(ctx, dx, dy) {
    ctx.strokeStyle = "#c9843a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dx + 8, dy);
    ctx.lineTo(dx + 8, dy + TILE);
    ctx.moveTo(dx + 24, dy);
    ctx.lineTo(dx + 24, dy + TILE);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dx + 8, dy + 8);
    ctx.lineTo(dx + 24, dy + 8);
    ctx.moveTo(dx + 8, dy + 22);
    ctx.lineTo(dx + 24, dy + 22);
    ctx.stroke();
    ctx.strokeStyle = "#1c1624";
    ctx.lineWidth = 1;
    ctx.strokeRect(dx + 6, dy + 1, 4, TILE - 2);
  }

  _drawBackground(ctx, camera, world) {
    const bg = this.assets.tile("cave_bg");
    const vis = camera.visibleTiles();
    if (bg) {
      const parX = camera.x * 0.35;
      const parY = camera.y * 0.35;
      const size = 256;
      const x0 = Math.floor((vis.x0 * TILE - 80 + parX) / size) * size;
      const y0 = Math.floor((vis.y0 * TILE - 80 + parY) / size) * size;
      const x1 = vis.x1 * TILE + 80 + parX;
      const y1 = vis.y1 * TILE + 80 + parY;
      ctx.save();
      ctx.translate(-parX, -parY);
      for (let y = y0; y < y1; y += size) {
        for (let x = x0; x < x1; x += size) {
          ctx.drawImage(bg, x, y, size, size);
        }
      }
      ctx.restore();
    }
    ctx.fillStyle = "rgba(8,6,14,0.28)";
    ctx.fillRect(vis.x0 * TILE, vis.y0 * TILE, (vis.x1 - vis.x0 + 1) * TILE, (vis.y1 - vis.y0 + 1) * TILE);
  }

  _drawChunks(ctx, camera) {
    const vis = camera.visibleTiles();
    const cw = this.chunkW;
    const nx = Math.ceil(WORLD_W / cw);
    const cx0 = Math.floor(vis.x0 / cw);
    const cy0 = Math.floor(vis.y0 / cw);
    const cx1 = Math.floor(vis.x1 / cw);
    const cy1 = Math.floor(vis.y1 / cw);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const img = this.chunks.get(cy * nx + cx);
        if (img) ctx.drawImage(img, cx * cw * TILE, cy * cw * TILE);
      }
    }
  }

  _drawFluids(ctx, world, camera) {
    const vis = camera.visibleTiles();
    const t = this.time;
    for (let y = vis.y0; y <= vis.y1; y++) {
      for (let x = vis.x0; x <= vis.x1; x++) {
        const i = y * world.w + x;
        if (world.isSolid(x, y) && world.material[i] !== MAT.MESH) continue;
        const tl = world.totalLiq(i);
        if (tl > 2) {
          const kind = world.primaryLiq(i);
          const L = LIQUIDS[kind] || LIQUIDS[0];
          const fill = Math.min(1, tl / 1000);
          const hgt = Math.max(3, TILE * fill);
          const wave = Math.sin(t * 2.4 + x * 0.7 + y) * 1.4;
          ctx.fillStyle = `rgba(${L.color[0]},${L.color[1]},${L.color[2]},0.62)`;
          ctx.fillRect(x * TILE, y * TILE + TILE - hgt, TILE, hgt);
          ctx.fillStyle = `rgba(220,240,255,0.35)`;
          ctx.fillRect(x * TILE, y * TILE + TILE - hgt + wave, TILE, 2);
        }
        const o2 = world.gasAt(i, GAS.O2);
        const co2 = world.gasAt(i, GAS.CO2);
        const h2 = world.gasAt(i, GAS.H2);
        const steam = world.gasAt(i, GAS.STEAM);
        if (o2 + co2 + h2 + steam < 1) continue;
        if (o2 > 4) {
          const a = Math.min(0.22, o2 / 500);
          ctx.fillStyle = `rgba(80,190,255,${a})`;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
        if (co2 > 6) {
          const a = Math.min(0.28, co2 / 400);
          ctx.fillStyle = `rgba(50,48,62,${a})`;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
        if (h2 > 3) {
          const a = Math.min(0.22, h2 / 300);
          ctx.fillStyle = `rgba(255,170,70,${a})`;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
        if (steam > 3) {
          const a = Math.min(0.2, steam / 300);
          ctx.fillStyle = `rgba(230,236,244,${a})`;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
  }

  _drawBuildings(ctx, world, camera) {
    const vis = camera.visibleTiles();
    for (const b of world.buildings) {
      if (b.x + b.w < vis.x0 || b.x > vis.x1 || b.y + b.h < vis.y0 || b.y > vis.y1) continue;
      const def = BUILDINGS[b.type];
      if (def?.mat != null) continue;
      const px = b.x * TILE;
      const py = b.y * TILE;
      const spr = BLD_SPRITE[b.type] ? this.assets.sprite(BLD_SPRITE[b.type]) : null;
      if (spr) {
        const bw = b.w * TILE;
        const bh = b.h * TILE;
        ctx.drawImage(spr, px - 2, py - 4, bw + 4, bh + 6);
        if (b.working) {
          ctx.fillStyle = "rgba(255,200,80,0.18)";
          ctx.beginPath();
          ctx.arc(px + bw * 0.5, py + bh * 0.3, 18 + Math.sin(this.time * 6) * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      this._drawProcBuilding(ctx, b, def, px, py);
    }
  }

  _drawProcBuilding(ctx, b, def, px, py) {
    const w = b.w * TILE, h = b.h * TILE;
    const pal = paletteFor(b.type);
    roundBox(ctx, px + 2, py + 2, w - 4, h - 4, 5, pal.fill, "#1c1624");
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(px + 5, py + 4, w - 10, 5);

    if (b.type === "door") {
      ctx.fillStyle = b.open ? "#3d9b8f" : "#c96a3a";
      ctx.fillRect(px + 8, py + 4, w - 16, h - 8);
      ctx.strokeStyle = "#1c1624";
      ctx.strokeRect(px + 8, py + 4, w - 16, h - 8);
    } else if (b.type === "cot") {
      ctx.fillStyle = "#d4a04a";
      ctx.fillRect(px + 4, py + 16, w - 8, 12);
      ctx.fillStyle = "#7bb8b0";
      ctx.fillRect(px + 6, py + 10, 12, 8);
    } else if (b.type === "table") {
      ctx.fillStyle = "#8a5a32";
      ctx.fillRect(px + 4, py + 14, w - 8, 8);
      ctx.fillRect(px + 6, py + 22, 4, 8);
      ctx.fillRect(px + w - 10, py + 22, 4, 8);
    } else if (b.type === "outhouse") {
      ctx.fillStyle = "#6b5344";
      ctx.fillRect(px + 6, py + 4, w - 12, h - 8);
      ctx.fillStyle = "#1c1624";
      ctx.fillRect(px + 12, py + 14, 8, 14);
    } else if (b.type === "storage") {
      ctx.fillStyle = "#c9843a";
      ctx.fillRect(px + 5, py + 8, w - 10, h - 12);
      ctx.strokeStyle = "#1c1624";
      ctx.strokeRect(px + 5, py + 8, w - 10, h - 12);
    } else if (b.type === "farm") {
      ctx.fillStyle = "#5a3a22";
      ctx.fillRect(px + 2, py + 18, w - 4, 12);
      const g = Math.min(1, (b.grow || 0) / 280);
      ctx.fillStyle = `rgb(${80 - g * 20},${140 + g * 80},${70})`;
      ctx.beginPath();
      ctx.ellipse(px + 16, py + 18 - g * 10, 8, 6 + g * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === "heater") {
      ctx.fillStyle = b.working ? "#f0a050" : "#8a5040";
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === "cooler") {
      ctx.fillStyle = b.working ? "#80d0e8" : "#4a7080";
      ctx.fillRect(px + 8, py + 6, w - 16, h - 10);
    } else if (b.type === "coalgen") {
      ctx.fillStyle = "#3a3230";
      ctx.fillRect(px + 6, py + 8, w - 12, h - 12);
      ctx.fillStyle = b.working ? "#ff6a30" : "#66220c";
      ctx.fillRect(px + 14, py + 16, 12, 18);
    } else if (b.type === "electrolyzer") {
      ctx.fillStyle = "#4a8a9a";
      ctx.fillRect(px + 6, py + 8, w - 12, h - 12);
      ctx.fillStyle = "#80e0ff";
      ctx.fillRect(px + 12, py + 14, 8, 20);
      ctx.fillStyle = "#f0a050";
      ctx.fillRect(px + 28, py + 14, 8, 20);
    } else if (b.type === "liqpump" || b.type === "gaspump") {
      ctx.fillStyle = "#4d7d78";
      ctx.beginPath();
      ctx.arc(px + w / 2, py + h / 2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c9843a";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (b.type === "liqvent" || b.type === "gasvent") {
      ctx.fillStyle = "#c9843a";
      ctx.fillRect(px + 10, py + 8, 12, 16);
    } else if (b.type === "research") {
      ctx.fillStyle = "#5a4a78";
      ctx.fillRect(px + 6, py + 10, w - 12, h - 14);
      ctx.fillStyle = "#f0e6c8";
      ctx.fillRect(px + 10, py + 16, 20, 12);
    } else if (b.type === "thermosensor") {
      ctx.fillStyle = "#2a3540";
      ctx.fillRect(px + 6, py + 6, w - 12, h - 12);
      ctx.fillStyle = b.autoGreen ? "#3dce6a" : "#e05050";
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f0a050";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 16, py + 16);
      ctx.lineTo(px + 16, py + 9);
      ctx.stroke();
    } else if (b.type === "notgate") {
      ctx.fillStyle = "#2a2438";
      ctx.fillRect(px + 6, py + 4, w - 12, h - 8);
      ctx.fillStyle = "#c8b8e0";
      ctx.beginPath();
      ctx.moveTo(px + 8, py + h - 10);
      ctx.lineTo(px + w - 8, py + h / 2);
      ctx.lineTo(px + 8, py + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = b.latchedOut ? "#3dce6a" : "#e05050";
      ctx.beginPath();
      ctx.arc(px + w / 2, py + 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.working) {
      ctx.fillStyle = "rgba(255,210,90,0.55)";
      ctx.beginPath();
      ctx.arc(px + 8, py + 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawNetworks(ctx, world, camera, overlay, tool) {
    const vis = camera.visibleTiles();
    const showW = overlay === "power" || (tool && !tool.includes("autowire") && (tool.includes("wire") || tool.includes("generator") || tool.includes("battery") || tool.includes("coalgen")));
    const showP = overlay === "plumb" || (tool && (tool.includes("pipe") || tool.includes("liq")));
    const showV = overlay === "vent" || (tool && (tool.includes("gas") || tool.includes("vent") && !tool.includes("liq")));
    const showA = overlay === "automation" || (tool && (tool.includes("autowire") || tool.includes("thermo") || tool.includes("notgate")));
    for (let y = vis.y0; y <= vis.y1; y++) {
      for (let x = vis.x0; x <= vis.x1; x++) {
        const i = y * world.w + x;
        if (showW && world.wire[i]) this._drawConduit(ctx, x, y, neighborMask(world.wire, x, y, world.w, world.h), "#f0a050", 3);
        if (showP && world.pipe[i]) this._drawConduit(ctx, x, y, neighborMask(world.pipe, x, y, world.w, world.h), "#4aa0e0", 5);
        if (showV && world.vent[i]) this._drawConduit(ctx, x, y, neighborMask(world.vent, x, y, world.w, world.h), "#8ee0a0", 4);
        if (showA && world.automationWire[i]) {
          const on = world.autoSignal[i];
          this._drawConduit(ctx, x, y, neighborMask(world.automationWire, x, y, world.w, world.h), on ? "#3dce6a" : "#e05050", 3);
        }
      }
    }
  }

  _drawConduit(ctx, x, y, mask, color, width) {
    const cx = x * TILE + 16, cy = y * TILE + 16;
    ctx.strokeStyle = "#1c1624";
    ctx.lineWidth = width + 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    if (mask & 1) ctx.lineTo(cx, cy - 16); else ctx.lineTo(cx, cy);
    ctx.moveTo(cx, cy);
    if (mask & 2) ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy);
    if (mask & 4) ctx.lineTo(cx, cy + 16);
    ctx.moveTo(cx, cy);
    if (mask & 8) ctx.lineTo(cx - 16, cy);
    if (mask === 0) ctx.arc(cx, cy, 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    if (mask & 1) ctx.lineTo(cx, cy - 16);
    ctx.moveTo(cx, cy);
    if (mask & 2) ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy);
    if (mask & 4) ctx.lineTo(cx, cy + 16);
    ctx.moveTo(cx, cy);
    if (mask & 8) ctx.lineTo(cx - 16, cy);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, width * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawDesignations(ctx, world, camera) {
    const vis = camera.visibleTiles();
    for (let y = vis.y0; y <= vis.y1; y++) {
      for (let x = vis.x0; x <= vis.x1; x++) {
        const d = world.desig[y * world.w + x];
        if (!d) continue;
        const px = x * TILE, py = y * TILE;
        if (d === DES.DIG) {
          ctx.fillStyle = "rgba(255, 80, 70, 0.28)";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = "rgba(255,120,90,0.9)";
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
          const p = world.digProg[y * world.w + x];
          if (p > 0) {
            ctx.fillStyle = "rgba(255,220,80,0.7)";
            ctx.fillRect(px + 4, py + TILE - 7, (TILE - 8) * (p / 100), 3);
          }
        } else if (d === DES.BUILD) {
          ctx.fillStyle = "rgba(80, 200, 120, 0.22)";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = "rgba(120,230,160,0.85)";
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.setLineDash([]);
        } else if (d === DES.DECON) {
          ctx.fillStyle = "rgba(240, 180, 50, 0.22)";
          ctx.fillRect(px, py, TILE, TILE);
        }
      }
    }
  }

  _drawCrewShadows(ctx, crew) {
    for (const c of crew) {
      if (!c.alive || !c.shadow || c.ghostSleep) continue;
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y - 2, 10, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawCrew(ctx, crew) {
    for (const c of crew) {
      if (!c.alive) continue;
      const sleeping = c.state === "sleep" || c.ghostSleep;
      const bob = c.state === "walk" ? Math.sin(c.walk * 2.2) * 2.2 : Math.sin(c.anim * 2) * 0.6;
      const spr = this.assets.sprite(c.sprite);
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.scale(c.facing, 1);
      if (c.ghostSleep) ctx.globalAlpha = 0.45 + Math.sin(c.anim * 3) * 0.12;
      if (spr) {
        const h = 44;
        const w = (spr.width / spr.height) * h;
        ctx.drawImage(spr, -w * 0.5, -h, w, h);
      } else {
        drawFallbackDupe(ctx, c);
      }
      ctx.restore();

      if (sleeping) this._drawZzz(ctx, c);

      if (c.selected) {
        ctx.strokeStyle = c.ghostSleep ? "#b8d4ff" : "#f0a050";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y - 2, 12, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!sleeping && (c.needs.o2 < 30 || c.needs.cal < 20 || c.needs.sleep < 15)) {
        ctx.fillStyle = "#ff5a4a";
        ctx.beginPath();
        ctx.arc(c.x, c.y - 50, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawZzz(ctx, c) {
    ctx.save();
    ctx.font = "bold 14px Nunito, sans-serif";
    ctx.fillStyle = c.ghostSleep ? "rgba(180, 210, 255, 0.9)" : "rgba(230, 210, 255, 0.95)";
    for (let k = 0; k < 3; k++) {
      const phase = (c.anim * 0.7 + k * 0.45) % 1.8;
      const ox = 10 + k * 6 + Math.sin(c.anim * 2 + k) * 2;
      const oy = -36 - phase * 18;
      ctx.globalAlpha = c.ghostSleep ? 0.85 - phase * 0.35 : 1 - phase * 0.45;
      ctx.fillText("z", c.x + ox, c.y + oy);
    }
    ctx.restore();
  }

  _drawParticles(ctx, particles) {
    if (!particles) return;
    const { x, y, life, max, size, r, g, b, alive, kind } = particles;
    for (let i = 0; i < alive.length; i++) {
      if (!alive[i]) continue;
      const a = Math.max(0, life[i] / max[i]);
      ctx.fillStyle = `rgba(${r[i]},${g[i]},${b[i]},${a * 0.85})`;
      const s = size[i] * (kind[i] === 2 ? 1.6 : 1);
      ctx.beginPath();
      ctx.arc(x[i], y[i], s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawOverlay(ctx, world, camera, overlay) {
    if (overlay === "automation" || overlay === "power" || overlay === "plumb" || overlay === "vent") return;
    const vis = camera.visibleTiles();
    for (let y = vis.y0; y <= vis.y1; y++) {
      for (let x = vis.x0; x <= vis.x1; x++) {
        const i = y * world.w + x;
        let col = null, a = 0.38;
        if (overlay === "temp") {
          col = sampleTempColor(world.temp[i]);
        } else if (overlay === "o2") {
          const o = world.gasAt(i, GAS.O2);
          const u = Math.min(1, o / 160);
          col = [40, 80 + u * 140, 120 + u * 120];
          if (world.isSolid(x, y) && world.material[i] !== MAT.MESH) continue;
        } else if (overlay === "mat") {
          col = MATERIALS[world.material[i]].color;
          a = 0.45;
        } else {
          continue;
        }
        ctx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  _drawHover(ctx, state) {
    const { hover, drag, tool, buildType } = state;
    if (drag && !drag.pan && (tool === "dig" || tool === "decon" || tool === "cancel")) {
      const ax = Math.min(drag.x0, drag.x1);
      const ay = Math.min(drag.y0, drag.y1);
      const bx = Math.max(drag.x0, drag.x1);
      const by = Math.max(drag.y0, drag.y1);
      ctx.fillStyle = tool === "dig" ? "rgba(255,80,70,0.18)" : tool === "cancel" ? "rgba(240,240,240,0.12)" : "rgba(240,180,50,0.16)";
      ctx.fillRect(ax * TILE, ay * TILE, (bx - ax + 1) * TILE, (by - ay + 1) * TILE);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ax * TILE, ay * TILE, (bx - ax + 1) * TILE, (by - ay + 1) * TILE);
    } else if (hover && buildType) {
      const def = BUILDINGS[buildType];
      if (def) {
        ctx.fillStyle = "rgba(120,230,160,0.22)";
        ctx.strokeStyle = "rgba(120,230,160,0.9)";
        ctx.setLineDash([4, 3]);
        ctx.fillRect(hover.x * TILE, hover.y * TILE, def.w * TILE, def.h * TILE);
        ctx.strokeRect(hover.x * TILE, hover.y * TILE, def.w * TILE, def.h * TILE);
        ctx.setLineDash([]);
      }
    } else if (hover) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * TILE + 0.5, hover.y * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function paletteFor(type) {
  if (type === "heater") return { fill: "#b45a3a" };
  if (type === "cooler") return { fill: "#3a7a8a" };
  if (type === "cot") return { fill: "#8a5a3a" };
  return { fill: "#3d6d68" };
}

function roundBox(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawFallbackDupe(ctx, c) {
  ctx.fillStyle = c.suit;
  ctx.fillRect(-7, -28, 14, 18);
  ctx.fillStyle = "#f0c8a0";
  ctx.beginPath();
  ctx.arc(0, -34, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.hair;
  ctx.fillRect(-7, -42, 14, 6);
}
