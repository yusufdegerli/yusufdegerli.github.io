(function () {
  const proto = typeof CanvasRenderingContext2D !== "undefined" ? CanvasRenderingContext2D.prototype : null;
  if (proto && !proto.ellipse) {
    proto.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) {
      this.save();
      this.translate(x, y);
      this.rotate(rot || 0);
      this.scale(rx, ry);
      this.arc(0, 0, 1, a0, a1, ccw);
      this.restore();
    };
  }
})();

const U = {
  clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  dist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.hypot(dx, dy);
  },

  dist2(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  },

  ang(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  },

  dir8(dx, dy) {
    const a = Math.atan2(dy, dx);
    const i = Math.round(((a + Math.PI) / (Math.PI * 2)) * 8) % 8;
    return i;
  },

  now() {
    return performance.now() / 1000;
  },

  uid() {
    U._n = (U._n || 0) + 1;
    return U._n;
  },

  pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  },

  rand(a, b) {
    return a + Math.random() * (b - a);
  },

  irand(a, b) {
    return (a + Math.random() * (b - a + 1)) | 0;
  },

  chance(p) {
    return Math.random() < p;
  },

  hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  },

  shade(hex, amt) {
    const { r, g, b } = U.hexToRgb(hex);
    const f = (c) => U.clamp((c + amt) | 0, 0, 255);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  },

  canPay(stock, cost) {
    if (!cost) return true;
    for (const k of Object.keys(cost)) {
      if ((stock[k] || 0) < cost[k]) return false;
    }
    return true;
  },

  pay(stock, cost) {
    if (!cost) return true;
    if (!U.canPay(stock, cost)) return false;
    for (const k of Object.keys(cost)) stock[k] -= cost[k];
    return true;
  },

  refund(stock, cost) {
    if (!cost) return;
    for (const k of Object.keys(cost)) stock[k] = (stock[k] || 0) + cost[k];
  },

  formatCost(cost) {
    if (!cost) return "";
    const names = { wood: "W", food: "F", gold: "G", stone: "S" };
    return Object.keys(cost)
      .map((k) => `${cost[k]}${names[k] || k}`)
      .join(" · ");
  },

  tileAt(x, y) {
    return { tx: Math.floor(x / CFG.tile), ty: Math.floor(y / CFG.tile) };
  },

  tileCenter(tx, ty) {
    return { x: (tx + 0.5) * CFG.tile, y: (ty + 0.5) * CFG.tile };
  },

  rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  },

  pointInRect(px, py, x, y, w, h) {
    return px >= x && py >= y && px <= x + w && py <= y + h;
  },

  seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  },
};
