const World = {
  tiles: null,
  block: null,
  fogVis: null,
  fogSeen: null,
  seed: 1,

  reset(seed) {
    this.seed = seed || ((Math.random() * 1e9) | 0);
    const n = CFG.mapW * CFG.mapH;
    this.tiles = new Uint8Array(n);
    this.block = new Uint8Array(n);
    this.fogVis = [];
    this.fogSeen = [];
    for (let i = 0; i < CFG.players.length; i++) {
      this.fogVis.push(new Uint8Array(n));
      this.fogSeen.push(new Uint8Array(n));
    }
    this.memory = new Map();
    this.generate();
  },

  idx(x, y) {
    return y * CFG.mapW + x;
  },

  in(x, y) {
    return x >= 0 && y >= 0 && x < CFG.mapW && y < CFG.mapH;
  },

  generate() {
    const rnd = U.seeded(this.seed);
    const w = CFG.mapW;
    const h = CFG.mapH;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edge = x < 2 || y < 2 || x > w - 3 || y > h - 3;
        this.tiles[this.idx(x, y)] = edge && rnd() > 0.35 ? 2 : rnd() > 0.94 ? 1 : 0;
      }
    }
    for (let i = 0; i < 5; i++) {
      let x = 8 + ((rnd() * (w - 16)) | 0);
      let y = 8 + ((rnd() * (h - 16)) | 0);
      const len = 8 + ((rnd() * 18) | 0);
      for (let k = 0; k < len; k++) {
        if (this.in(x, y)) this.tiles[this.idx(x, y)] = 1;
        if (this.in(x + 1, y)) this.tiles[this.idx(x + 1, y)] = 1;
        x += (rnd() * 3 - 1) | 0;
        y += (rnd() * 3 - 1) | 0;
      }
    }
    this.rebuildBlock();
  },

  rebuildBlock() {
    const n = CFG.mapW * CFG.mapH;
    this.block.fill(0);
    for (let i = 0; i < n; i++) {
      if (this.tiles[i] === 2) this.block[i] = 1;
    }
  },

  setBlocked(tx, ty, on) {
    if (this.in(tx, ty)) this.block[this.idx(tx, ty)] = on ? 1 : 0;
  },

  occupy(tx, ty, size, on) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) this.setBlocked(tx + x, ty + y, on);
    }
  },

  walkableWorld(x, y) {
    const { tx, ty } = U.tileAt(x, y);
    return this.in(tx, ty) && this.block[this.idx(tx, ty)] === 0;
  },

  nearestWalkableWorld(x, y) {
    if (this.walkableWorld(x, y)) return { x, y };
    const { tx, ty } = U.tileAt(x, y);
    const n = Path.nearestWalkable(this.block, tx, ty, 12);
    if (!n) return { x, y };
    return U.tileCenter(n.x, n.y);
  },

  canPlace(tx, ty, size) {
    if (tx < 1 || ty < 1 || tx + size > CFG.mapW - 1 || ty + size > CFG.mapH - 1) return false;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = this.idx(tx + x, ty + y);
        if (this.block[i]) return false;
        if (this.tiles[i] === 2) return false;
      }
    }
    return true;
  },

  reveal(owner, wx, wy, tiles) {
    if (!this.fogVis[owner]) return;
    const { tx, ty } = U.tileAt(wx, wy);
    const vis = this.fogVis[owner];
    const seen = this.fogSeen[owner];
    const r = tiles | 0;
    const r2 = r * r;
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (!this.in(x, y)) continue;
        const dx = x - tx;
        const dy = y - ty;
        if (dx * dx + dy * dy <= r2) {
          const i = this.idx(x, y);
          vis[i] = 1;
          seen[i] = 1;
        }
      }
    }
  },

  clearVis(owner) {
    if (this.fogVis[owner]) this.fogVis[owner].fill(0);
  },

  visible(owner, wx, wy) {
    const { tx, ty } = U.tileAt(wx, wy);
    if (!this.in(tx, ty) || !this.fogVis[owner]) return false;
    return this.fogVis[owner][this.idx(tx, ty)] === 1;
  },

  snapshotFog() {
    if (!this.memory) this.memory = new Map();
    for (const e of Ent.list) {
      if (e.dead || e.kind !== "building" || e.owner === 0) continue;
      if (!this.visible(0, Ent.cx(e), Ent.cy(e))) continue;
      const age = Game.players[e.owner] ? Game.players[e.owner].age : 1;
      const col = CFG.players[e.owner] ? CFG.players[e.owner].color : "#888";
      this.memory.set(e.id, {
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        w: e.w,
        h: e.h,
        tx: e.tx,
        ty: e.ty,
        age,
        color: col,
        amount: e.amount,
        max: e.max,
      });
    }
    const drop = [];
    this.memory.forEach((snap, id) => {
      if (!this.visible(0, snap.x + snap.w * 0.5, snap.y + snap.h * 0.5)) return;
      const live = Ent.byId.get(id);
      if (!live || live.dead || live.kind !== "building") drop.push(id);
    });
    for (let i = 0; i < drop.length; i++) this.memory.delete(drop[i]);
  },

  seen(owner, tx, ty) {
    if (!this.in(tx, ty)) return false;
    return this.fogSeen[owner][this.idx(tx, ty)] === 1;
  },

  spawnCluster(kind, cx, cy, count, spread, rnd) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < 200) {
      const tx = cx + ((rnd() * 2 - 1) * spread) | 0;
      const ty = cy + ((rnd() * 2 - 1) * spread) | 0;
      if (!this.in(tx, ty)) continue;
      if (this.block[this.idx(tx, ty)]) continue;
      if (this.tiles[this.idx(tx, ty)] === 2) continue;
      this.setBlocked(tx, ty, true);
      const c = U.tileCenter(tx, ty);
      out.push({ kind, tx, ty, x: c.x, y: c.y });
    }
    return out;
  },
};
