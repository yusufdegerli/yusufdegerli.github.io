import { buildNav, findPath } from "./nav.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function irand(rng, a, b) {
  return a + Math.floor(rng() * (b - a + 1));
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function overlaps(a, b, pad = 10) {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

class Rect {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  get cx() {
    return this.x + this.w / 2;
  }
}

function splitVertical(rect, rng, depth, minW) {
  if (depth <= 0 || rect.w < minW * 2) return [rect];
  const cut = Math.floor(rect.w * (0.42 + rng() * 0.16));
  if (cut < minW || rect.w - cut < minW) return [rect];
  const a = new Rect(rect.x, rect.y, cut, rect.h);
  const b = new Rect(rect.x + cut, rect.y, rect.w - cut, rect.h);
  return [...splitVertical(a, rng, depth - 1, minW), ...splitVertical(b, rng, depth - 1, minW)];
}

const KINDS = ["thug", "thug", "brawler", "shooter", "mage", "kamikaze", "brute"];
const WEAPON_IDS = ["dagger", "hammer", "bow"];

const MAX_W = 720;
const MAX_H = 40;
const SPINE_Y = 1184;
const FLOOR_H = 32;

function tryAdd(list, plat, extra = []) {
  const p = {
    x: Math.round(plat.x),
    y: Math.round(plat.y),
    w: Math.round(plat.w),
    h: Math.round(plat.h),
  };
  if (p.w < 36 || p.h < 12) return false;
  if (p.w > MAX_W) return false;
  if (p.h > MAX_H && p.w > 28) return false;
  const pool = list.concat(extra);
  for (let i = 0; i < pool.length; i++) {
    if (overlaps(p, pool[i], 8)) return false;
  }
  list.push(p);
  return true;
}

function buildOnce(rng) {
  const width = 9600;
  const height = 1280;
  const leaves = splitVertical(new Rect(40, 80, width - 80, height - 160), rng, 3, 680);
  leaves.sort((a, b) => a.x - b.x);

  const platforms = [];
  const falling = [];
  const bounce = [];
  const spikes = [];
  const enemies = [];
  const pits = [];
  const chests = [];
  const plates = [];
  const switches = [];
  const doors = [];

  const add = (x, y, w, h) => tryAdd(platforms, { x, y, w, h }, falling);

  leaves.forEach((room, i) => {
    const first = i === 0;
    const last = i === leaves.length - 1;
    const inset = 20;
    const floorX = room.x + inset;
    let floorW = room.w - inset * 2;
    if (floorW > MAX_W) {
      const pieces = Math.ceil(floorW / (MAX_W - 40));
      const piece = Math.floor(floorW / pieces);
      for (let n = 0; n < pieces; n++) {
        const gap = n > 0 && !first && !last && rng() < 0.35 ? 70 : 0;
        add(floorX + n * piece + gap, SPINE_Y, piece - gap - 8, FLOOR_H);
        if (gap && rng() < 0.5) {
          falling.push({ x: floorX + n * piece, y: SPINE_Y, w: gap - 4, h: 16 });
          pits.push([floorX + n * piece, floorX + n * piece + gap]);
        }
      }
    } else {
      add(floorX, SPINE_Y, floorW, FLOOR_H);
    }

    const hooks = irand(rng, 2, 3);
    for (let h = 0; h < hooks; h++) {
      const hw = irand(rng, 70, 130);
      const hx = room.x + irand(rng, 30, Math.max(31, room.w - hw - 30));
      const hy = room.y + irand(rng, 24, 70);
      add(hx, hy, hw, 16);
    }

    const ledges = first ? 1 : irand(rng, 1, 3);
    for (let L = 0; L < ledges; L++) {
      const lw = irand(rng, 120, 240);
      const lx = room.x + irand(rng, 40, Math.max(41, room.w - lw - 40));
      const ly = SPINE_Y - irand(rng, 150, 280) - L * 140;
      if (ly < room.y + 90) continue;
      if (add(lx, ly, lw, 18) && rng() < 0.25) {
        bounce.push({ x: lx + lw / 2 - 22, y: ly - 14, w: 44, h: 12 });
      }
    }

    if (!first && !last && rng() < 0.28) {
      const sx = room.x + irand(rng, 80, Math.max(81, room.w - 140));
      spikes.push({ x: sx, y: SPINE_Y - 4, w: 70, h: 14, dir: "up" });
    }

    if (!first) {
      const count = last ? 1 : irand(rng, 1, 2);
      for (let s = 0; s < count; s++) {
        enemies.push({
          x: room.x + irand(rng, 70, Math.max(71, room.w - 70)),
          y: SPINE_Y - 48,
          kind: pick(rng, KINDS),
        });
      }
    }
  });

  for (let i = 0; i < leaves.length - 1; i++) {
    const a = leaves[i];
    const b = leaves[i + 1];
    const x0 = a.x + a.w - 16;
    const x1 = b.x + 16;
    const w = Math.max(48, x1 - x0);
    if (w > MAX_W) continue;
    if (w < 90 || rng() < 0.55) {
      add(x0, SPINE_Y, w, FLOOR_H);
    } else {
      falling.push({ x: x0 + 6, y: SPINE_Y, w: w - 12, h: 16 });
      pits.push([x0, x0 + w]);
    }
  }

  const mid = leaves[Math.floor(leaves.length / 2)];
  const shop = { x: mid.cx, y: SPINE_Y - 36 };

  const late = leaves[Math.max(2, leaves.length - 2)];
  doors.push({
    x: late.x + late.w / 2 - 14,
    y: SPINE_Y - 118,
    w: 28,
    h: 120,
  });

  const early = leaves.slice(1, Math.max(2, leaves.length - 2));
  if (early.length >= 1) {
    const r1 = early[0];
    plates.push({
      id: "plate",
      x: r1.x + r1.w * 0.35,
      y: SPINE_Y - 8,
      w: 44,
      h: 10,
    });
  }
  if (early.length >= 2) {
    const r2 = early[early.length - 1];
    const ly = SPINE_Y - 200;
    add(r2.x + r2.w * 0.5 - 70, ly, 160, 18);
    switches.push({
      id: "switch",
      x: r2.x + r2.w * 0.5 - 12,
      y: ly - 36,
      w: 24,
      h: 28,
    });
  } else if (early.length === 1) {
    const r2 = leaves[Math.min(2, leaves.length - 1)];
    switches.push({
      id: "switch",
      x: r2.x + 80,
      y: SPINE_Y - 40,
      w: 24,
      h: 28,
    });
  }

  const hide = leaves.slice(1, -1);
  const chestCount = Math.min(4, hide.length);
  const used = new Set();
  for (let c = 0; c < chestCount; c++) {
    let room = hide[irand(rng, 0, hide.length - 1)];
    let guard = 0;
    while (used.has(room.x) && guard++ < 8) room = hide[irand(rng, 0, hide.length - 1)];
    used.add(room.x);
    const high = rng() < 0.55;
    const cy = high ? SPINE_Y - irand(rng, 170, 250) : SPINE_Y - 28;
    if (high) add(room.cx - 80, cy + 20, 180, 18);
    chests.push({
      x: room.cx,
      y: cy,
      weapon: pick(rng, WEAPON_IDS),
    });
  }

  const spawn = { x: leaves[0].x + 110, y: SPINE_Y - 56 };
  const gate = { x: leaves[leaves.length - 1].x + leaves[leaves.length - 1].w - 120, y: SPINE_Y - 80 };

  return {
    seed: 0,
    width,
    height,
    rooms: leaves,
    platforms,
    falling,
    bounce,
    spikes,
    walls: [],
    enemies,
    pits,
    spawn,
    gate,
    shop,
    chests,
    plates,
    switches,
    doors,
  };
}

export function generateLevel(seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0) {
  const rng = mulberry32(seed);
  let level = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    level = buildOnce(rng);
    level.seed = seed;
    const nav = buildNav(level.platforms.concat(level.falling || []), { jumpH: 175, jumpW: 260 });
    const path = findPath(nav, level.spawn.x, level.spawn.y + 40, level.gate.x, level.gate.y + 40);
    const hasMega = level.platforms.some((p) => p.w * p.h > 720 * 40 || p.h > MAX_H + 8);
    let overlap = false;
    for (let i = 0; i < level.platforms.length && !overlap; i++) {
      for (let j = i + 1; j < level.platforms.length; j++) {
        if (overlaps(level.platforms[i], level.platforms[j], 2)) {
          overlap = true;
          break;
        }
      }
    }
    if (path.length >= 2 && !hasMega && !overlap) {
      level.validPath = true;
      return level;
    }
  }
  level.validPath = false;
  return level;
}
