const Draw = {
  canvas: null,
  ctx: null,
  mini: null,
  mctx: null,
  dpr: 1,

  bind(world, mini) {
    this.canvas = world;
    this.ctx = world.getContext("2d");
    this.mini = mini;
    this.mctx = mini.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(() => this.resize());
    }
    setTimeout(() => this.resize(), 50);
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parent = this.canvas.parentElement;
    let w = this.canvas.clientWidth || (parent && parent.clientWidth) || window.innerWidth;
    let h = this.canvas.clientHeight || (parent && parent.clientHeight) || window.innerHeight;
    w = Math.max(1, w | 0);
    h = Math.max(1, h | 0);
    this.canvas.width = Math.max(1, (w * this.dpr) | 0);
    this.canvas.height = Math.max(1, (h * this.dpr) | 0);
    Cam.resize(w, h);
  },

  frame(t) {
    const g = this.ctx;
    const dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0e120c";
    g.fillRect(0, 0, Cam.w, Cam.h);
    if (!World.tiles) return;
    g.save();
    Cam.apply(g);
    this.map(g);
    this.groundMarks(g);
    const drawables = [];
    for (const e of Ent.list) {
      if (e.dead) continue;
      drawables.push(e);
    }
    drawables.sort((a, b) => Ent.cy(a) - Ent.cy(b));
    for (const e of drawables) this.entity(g, e, t);
    this.memory(g);
    this.projectiles(g);
    this.fx(g);
    this.ghost(g);
    this.fog(g);
    g.restore();
    this.box(g);
    this.minimap();
  },

  map(g) {
    const { x0, y0, x1, y1 } = Cam.viewTiles();
    const t = CFG.tile;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!World.seen(0, x, y) && Game.fogOn) continue;
        const kind = World.tiles[World.idx(x, y)];
        const img = kind === 2 ? Spr.water : kind === 1 ? Spr.dirt : Spr.tiles[(x * 7 + y * 13) & 7];
        g.drawImage(img, x * t, y * t, t, t);
      }
    }
  },

  groundMarks(g) {
    for (const e of Game.selected) {
      if (e.dead || e.kind !== "unit" || !e.dest) continue;
      g.strokeStyle = "rgba(180,220,160,0.35)";
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(e.x, e.y);
      if (e.path) {
        for (let i = e.pathI; i < e.path.length; i++) g.lineTo(e.path[i].x, e.path[i].y);
      }
      g.stroke();
      g.setLineDash([]);
    }
    for (const e of Game.selected) {
      if (e.dead || e.kind !== "building" || !e.rally) continue;
      g.strokeStyle = "rgba(212,168,75,0.7)";
      g.beginPath();
      g.moveTo(Ent.cx(e), Ent.cy(e));
      g.lineTo(e.rally.x, e.rally.y);
      g.stroke();
      g.fillStyle = "#d4a84b";
      g.beginPath();
      g.arc(e.rally.x, e.rally.y, 4, 0, Math.PI * 2);
      g.fill();
    }
  },

  entity(g, e, t) {
    const vis = World.visible(0, Ent.cx(e), Ent.cy(e));
    const seen = World.seen(0, Math.floor(Ent.cx(e) / CFG.tile), Math.floor(Ent.cy(e) / CFG.tile));
    if (Game.fogOn && !seen && e.owner !== 0) return;
    if (Game.fogOn && !vis && e.owner !== 0 && e.kind === "unit") return;
    if (Game.fogOn && !vis && e.owner !== 0 && e.kind === "building") return;

    const selected = Game.selected.includes(e);
    if (selected) {
      const col = e.owner === 0 ? "#d4e8c8" : "#e8a0a0";
      if (e.kind === "building") {
        g.strokeStyle = col;
        g.lineWidth = 1.5;
        g.strokeRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
      } else Spr.selectRing(g, e.x, e.y, e.r, col);
    }

    if (e.kind === "resource") {
      const gone = e.amount <= 0;
      if (e.type === "wood") Spr.tree(g, e.x, e.y, e.id, gone);
      else if (e.type === "food") Spr.bush(g, e.x, e.y, gone);
      else if (e.type === "gold") Spr.gold(g, e.x, e.y, gone);
      else Spr.stone(g, e.x, e.y, gone);
    } else if (e.kind === "building") {
      const age = Game.players[e.owner] ? Game.players[e.owner].age : 1;
      const col = CFG.players[e.owner].color;
      const foodFrac = e.type === "farm" && e.max ? e.amount / e.max : 1;
      Spr.building(g, e.type, e.x, e.y, BLD[e.type].size, age, col, !e.built, foodFrac);
      if (!e.built) this.bar(g, e.x + 8, e.y + e.h - 10, e.w - 16, e.construct, "#d4a84b");
      else if (e.hp < e.maxHp) this.bar(g, e.x + 8, e.y + 6, e.w - 16, e.hp / e.maxHp, "#c44a4a");
    } else {
      Spr.unit(g, e, t);
      if (e.hp < e.maxHp || selected) this.bar(g, e.x - 10, e.y - 18, 20, e.hp / e.maxHp, e.owner === 0 ? "#6ec07a" : "#c44a4a");
    }
  },

  bar(g, x, y, w, k, color) {
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(x, y, w, 4);
    g.fillStyle = color;
    g.fillRect(x, y, w * U.clamp(k, 0, 1), 4);
  },

  memory(g) {
    if (!Game.fogOn || !World.memory) return;
    for (const snap of World.memory.values()) {
      if (World.visible(0, snap.x + snap.w * 0.5, snap.y + snap.h * 0.5)) continue;
      if (!World.seen(0, snap.tx, snap.ty)) continue;
      g.save();
      g.globalAlpha = 0.72;
      const foodFrac = snap.type === "farm" && snap.max ? snap.amount / snap.max : 1;
      Spr.building(g, snap.type, snap.x, snap.y, BLD[snap.type].size, snap.age, snap.color, false, foodFrac);
      g.restore();
    }
  },

  projectiles(g) {
    for (const p of Ent.projectiles) {
      if (Game.fogOn && !World.visible(0, p.x, p.y)) continue;
      g.fillStyle = p.tint || "#f0e0a0";
      g.beginPath();
      g.arc(p.x, p.y, p.splash ? 3.4 : 2.4, 0, Math.PI * 2);
      g.fill();
    }
  },

  fx(g) {
    for (const q of Ent.particles) {
      g.globalAlpha = 1 - q.t / q.life;
      g.fillStyle = q.color;
      g.fillRect(q.x, q.y, 3, 3);
    }
    g.globalAlpha = 1;
    g.font = "12px Source Sans 3, sans-serif";
    g.textAlign = "center";
    for (const f of Ent.floats) {
      g.globalAlpha = 1 - f.t / f.life;
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
  },

  ghost(g) {
    const pl = Game.placing;
    if (!pl) return;
    const def = BLD[pl];
    const tx = Math.floor(Input.wx / CFG.tile);
    const ty = Math.floor(Input.wy / CFG.tile);
    const ok = World.canPlace(tx, ty, def.size) && U.canPay(Game.players[0].res, def.cost);
    Spr.ghost(g, pl, tx * CFG.tile, ty * CFG.tile, def.size, ok);
  },

  fog(g) {
    if (!Game.fogOn) return;
    const { x0, y0, x1, y1 } = Cam.viewTiles();
    const t = CFG.tile;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = World.idx(x, y);
        if (!World.fogSeen[0][i]) {
          g.fillStyle = "#070708";
          g.fillRect(x * t, y * t, t, t);
        } else if (!World.fogVis[0][i]) {
          g.fillStyle = "rgba(32, 34, 40, 0.58)";
          g.fillRect(x * t, y * t, t, t);
        }
      }
    }
  },

  box(g) {
    const b = Input.boxScreen();
    if (!b) return;
    g.save();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.strokeStyle = "rgba(212,168,75,0.9)";
    g.fillStyle = "rgba(212,168,75,0.12)";
    g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeRect(b.x, b.y, b.w, b.h);
    g.restore();
  },

  minimap() {
    const g = this.mctx;
    const w = this.mini.width;
    const h = this.mini.height;
    const sx = w / (CFG.mapW * CFG.tile);
    const sy = h / (CFG.mapH * CFG.tile);
    g.fillStyle = "#12160f";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < CFG.mapH; y++) {
      for (let x = 0; x < CFG.mapW; x++) {
        if (Game.fogOn && !World.seen(0, x, y)) continue;
        const kind = World.tiles[World.idx(x, y)];
        const vis = World.fogVis[0][World.idx(x, y)];
        let col = kind === 2 ? "#2a4e62" : kind === 1 ? "#6b5334" : "#3d5a2a";
        if (Game.fogOn && !vis) col = kind === 2 ? "#1a303c" : kind === 1 ? "#3a2e1c" : "#24361a";
        g.fillStyle = col;
        g.fillRect((x * CFG.tile) * sx, (y * CFG.tile) * sy, Math.ceil(CFG.tile * sx), Math.ceil(CFG.tile * sy));
      }
    }
    for (const e of Ent.list) {
      if (e.dead) continue;
      const vis = World.visible(0, Ent.cx(e), Ent.cy(e));
      const seen = World.seen(0, Math.floor(Ent.cx(e) / CFG.tile), Math.floor(Ent.cy(e) / CFG.tile));
      if (Game.fogOn && !seen && e.owner !== 0) continue;
      if (Game.fogOn && !vis && e.owner !== 0) continue;
      if (e.kind === "resource") {
        g.fillStyle = CFG.resources[e.type].color;
        g.fillRect(e.x * sx - 1, e.y * sy - 1, 3, 3);
      } else if (e.kind === "building") {
        g.fillStyle = CFG.players[e.owner].color;
        g.fillRect(e.x * sx, e.y * sy, Math.max(3, e.w * sx), Math.max(3, e.h * sy));
      } else {
        g.fillStyle = CFG.players[e.owner].accent;
        g.fillRect(e.x * sx - 1, e.y * sy - 1, 3, 3);
      }
    }
    if (Game.fogOn && World.memory) {
      for (const snap of World.memory.values()) {
        if (World.visible(0, snap.x + snap.w * 0.5, snap.y + snap.h * 0.5)) continue;
        g.fillStyle = "rgba(179, 58, 58, 0.55)";
        g.fillRect(snap.x * sx, snap.y * sy, Math.max(3, snap.w * sx), Math.max(3, snap.h * sy));
      }
    }
    g.strokeStyle = "#e8d7b0";
    g.lineWidth = 1;
    g.strokeRect(Cam.x * sx, Cam.y * sy, (Cam.w / Cam.z) * sx, (Cam.h / Cam.z) * sy);
  },
};
