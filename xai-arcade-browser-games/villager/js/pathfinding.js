const Path = {
  open: null,

  init() {
    this.open = [];
  },

  walkable(grid, x, y) {
    return x >= 0 && y >= 0 && x < CFG.mapW && y < CFG.mapH && grid[y * CFG.mapW + x] === 0;
  },

  find(grid, sx, sy, gx, gy, maxIter) {
    sx = U.clamp(sx | 0, 0, CFG.mapW - 1);
    sy = U.clamp(sy | 0, 0, CFG.mapH - 1);
    gx = U.clamp(gx | 0, 0, CFG.mapW - 1);
    gy = U.clamp(gy | 0, 0, CFG.mapH - 1);
    if (!this.walkable(grid, gx, gy)) {
      const n = this.nearestWalkable(grid, gx, gy, 8);
      if (!n) return [];
      gx = n.x;
      gy = n.y;
    }
    if (!this.walkable(grid, sx, sy)) {
      const n = this.nearestWalkable(grid, sx, sy, 8);
      if (!n) return [];
      sx = n.x;
      sy = n.y;
    }
    if (sx === gx && sy === gy) return [{ x: gx, y: gy }];

    const w = CFG.mapW;
    const h = CFG.mapH;
    const size = w * h;
    const gScore = new Float32Array(size);
    const came = new Int32Array(size);
    const closed = new Uint8Array(size);
    gScore.fill(1e9);
    came.fill(-1);

    const start = sy * w + sx;
    const goal = gy * w + gx;
    gScore[start] = 0;
    const open = this.open;
    open.length = 0;
    open.push(start);
    const hCost = (i) => {
      const x = i % w;
      const y = (i / w) | 0;
      const dx = Math.abs(x - gx);
      const dy = Math.abs(y - gy);
      return Math.max(dx, dy) + Math.min(dx, dy) * 0.414;
    };

    let iter = 0;
    const limit = maxIter || 2800;
    while (open.length && iter++ < limit) {
      let bi = 0;
      let bv = 1e15;
      for (let i = 0; i < open.length; i++) {
        const id = open[i];
        const f = gScore[id] + hCost(id);
        if (f < bv) {
          bv = f;
          bi = i;
        }
      }
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) return this.reconstruct(came, cur, w);
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % w;
      const cy = (cur / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (dx && dy) {
            if (!this.walkable(grid, cx + dx, cy) || !this.walkable(grid, cx, cy + dy)) continue;
          }
          if (!this.walkable(grid, nx, ny)) continue;
          const nid = ny * w + nx;
          if (closed[nid]) continue;
          const step = dx && dy ? 1.414 : 1;
          const ng = gScore[cur] + step;
          if (ng < gScore[nid]) {
            const first = gScore[nid] === 1e9;
            gScore[nid] = ng;
            came[nid] = cur;
            if (first) open.push(nid);
          }
        }
      }
    }
    return [];
  },

  reconstruct(came, cur, w) {
    const pts = [];
    while (cur !== -1) {
      pts.push({ x: cur % w, y: (cur / w) | 0 });
      cur = came[cur];
    }
    pts.reverse();
    return this.smooth(pts);
  },

  smooth(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let best = i + 1;
      for (let j = pts.length - 1; j > i + 1; j--) {
        if (Math.abs(pts[j].x - pts[i].x) <= 1 && Math.abs(pts[j].y - pts[i].y) <= 1) {
          best = j;
          break;
        }
      }
      out.push(pts[best]);
      i = best;
    }
    return out;
  },

  nearestWalkable(grid, x, y, r) {
    if (this.walkable(grid, x, y)) return { x, y };
    for (let rad = 1; rad <= r; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.abs(dx) !== rad && Math.abs(dy) !== rad) continue;
          if (this.walkable(grid, x + dx, y + dy)) return { x: x + dx, y: y + dy };
        }
      }
    }
    return null;
  },

  worldPath(grid, x0, y0, x1, y1) {
    const a = U.tileAt(x0, y0);
    const b = U.tileAt(x1, y1);
    const tiles = this.find(grid, a.tx, a.ty, b.tx, b.ty);
    if (!tiles.length) {
      const n = this.nearestWalkable(grid, b.tx, b.ty, 10);
      return n ? [U.tileCenter(n.x, n.y)] : [];
    }
    const pts = tiles.map((t) => U.tileCenter(t.x, t.y));
    if (pts.length > 1) pts.shift();
    if (this.walkable(grid, b.tx, b.ty) && pts.length) pts[pts.length - 1] = { x: x1, y: y1 };
    return pts;
  },
};
