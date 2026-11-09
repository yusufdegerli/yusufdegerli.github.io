(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  // index.html is the single source of truth for the title menu; showMenu() restores it.
  const MENU_HTML = overlay.innerHTML;
  const hud = document.getElementById("hud");
  const hudWeapon = document.getElementById("weapon-name");
  const hudAmmo = document.getElementById("weapon-ammo");
  const hudKills = document.getElementById("kill-count");
  const hudTrack = document.getElementById("track-name");
  const comboEl = document.getElementById("combo");
  const comboMult = document.getElementById("combo-mult");
  const comboWord = document.getElementById("combo-word");
  const comboFill = document.getElementById("combo-fill");
  const talkEl = document.getElementById("talk");
  const talkWho = document.getElementById("talk-who");
  const talkLine = document.getElementById("talk-line");

  const TAU = Math.PI * 2;
  const WT = 24;
  const MAP_W = 2000;
  const MAP_H = 1520;
  const PLAYER_SPEED = 236;
  const SPRINT_MUL = 1.5;
  const DODGE_SPEED = 640;
  const DODGE_TIME = 0.155;
  const DODGE_CD = 0.52;
  const COMBO_WINDOW = 2.8;
  const PLAYER_R = 13;
  const ENEMY_R = 13;
  const VIEW_RANGE = 420;
  const VIEW_FOV = 1.45;
  const CORPSE_RANGE = 520;
  const CORPSE_FOV = 2.5;
  const CORPSE_NEAR = 230;
  const NAV_CELL = 40;
  const COP_BLUE = "#1d4e89";
  const HEAR_GUN = 560;
  const HEAR_THROW = 300;
  const HEAR_MELEE = 170;
  const HEAR_STEP = 108;
  const STAIN_CAP = 520;
  const PARTICLE_CAP = 420;

  const WEAPONS = {
    fists: {
      id: "fists",
      name: "FISTS",
      type: "melee",
      range: 30,
      rate: 0.32,
      swing: 1.15,
      throw: false,
      color: "#e8d4c8",
    },
    bat: {
      id: "bat",
      name: "BAT",
      type: "melee",
      range: 44,
      rate: 0.46,
      swing: 1.35,
      throw: true,
      throwSpeed: 620,
      color: "#8a5a32",
    },
    knife: {
      id: "knife",
      name: "KNIFE",
      type: "melee",
      range: 34,
      rate: 0.2,
      swing: 1.05,
      throw: true,
      throwSpeed: 740,
      color: "#cfd6de",
    },
    pistol: {
      id: "pistol",
      name: "PISTOL",
      type: "gun",
      ammo: 12,
      rate: 0.2,
      auto: false,
      speed: 760,
      spread: 0.035,
      pellets: 1,
      throw: true,
      throwSpeed: 580,
      color: "#2b2b2b",
      length: 20,
    },
    uzi: {
      id: "uzi",
      name: "UZI",
      type: "gun",
      ammo: 32,
      rate: 0.068,
      auto: true,
      speed: 800,
      spread: 0.13,
      pellets: 1,
      throw: true,
      throwSpeed: 560,
      color: "#3a3f46",
      length: 18,
    },
    shotgun: {
      id: "shotgun",
      name: "SHOTGUN",
      type: "gun",
      ammo: 6,
      rate: 0.68,
      auto: false,
      speed: 680,
      spread: 0.3,
      pellets: 7,
      throw: true,
      throwSpeed: 520,
      color: "#5a4030",
      length: 26,
    },
    rifle: {
      id: "rifle",
      name: "RIFLE",
      type: "gun",
      ammo: 20,
      rate: 0.13,
      auto: false,
      speed: 980,
      spread: 0.018,
      pellets: 1,
      throw: true,
      throwSpeed: 540,
      color: "#262920",
      length: 28,
    },
  };

  const TRACKS = [
    { src: "music/get-mad.mp3", title: "Get Mad", artist: "Nihilore" },
    { src: "music/motion-blur.mp3", title: "Motion Blur", artist: "Nihilore" },
    { src: "music/do-not-look-back.mp3", title: "Do Not Look Back", artist: "Nihilore" },
    { src: "music/a-dangerous-gravity.mp3", title: "A Dangerous Gravity", artist: "Nihilore" },
    { src: "music/absolute-terror.mp3", title: "Absolute Terror", artist: "Nihilore" },
    { src: "music/last-chance.mp3", title: "Last Chance", artist: "Nihilore" },
  ];

  let viewW = innerWidth;
  let viewH = innerHeight;
  let dpr = 1;
  let lastTime = 0;
  let mode = "menu";
  let kills = 0;
  let started = false;
  let spawn = { x: 220, y: 210 };
  let navDirty = true;
  let navCols = 0;
  let navRows = 0;
  let navBlocked = null;

  const keys = Object.create(null);
  const mouse = { x: 0, y: 0, left: false, right: false, leftClicked: false, rightClicked: false };
  const cam = { x: 240, y: 220 };
  const shake = { x: 0, y: 0, mag: 0, kx: 0, ky: 0 };
  const combo = { count: 0, timer: 0, pop: 0, shake: 0 };

  let walls = [];
  let rooms = [];
  let doors = [];
  let windows = [];
  let player = null;
  let enemies = [];
  let bullets = [];
  let thrown = [];
  let pickups = [];
  let particles = [];
  let stains = [];
  let corpses = [];
  let flashes = [];
  let trails = [];
  let noises = [];
  let enemyTemplate = [];
  let pickupTemplate = [];
  let levels = null;

  const talk = {
    active: false,
    lines: [],
    i: 0,
    typed: 0,
    acc: 0,
    bob: 0,
    mouth: 0,
    dread: false,
    onDone: null,
  };

  const audio = {
    ctx: null,
    master: null,
    sfx: null,
    music: null,
    muted: false,
    musicOn: true,
    html: null,
    trackIndex: 0,
    usingHtml: false,
    synth: null,
    currentLabel: "",
  };

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function len(x, y) {
    return Math.hypot(x, y);
  }
  function norm(x, y) {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  }
  function angNorm(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }
  function angLerp(a, b, t) {
    return a + angNorm(b - a) * t;
  }
  function angDiff(a, b) {
    return Math.abs(angNorm(a - b));
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function irand(a, b) {
    return (Math.random() * (b - a + 1) + a) | 0;
  }
  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }
  function copyWeapon(id, ammo) {
    const src = WEAPONS[id] || WEAPONS.fists;
    const w = Object.assign({}, src);
    if (w.type === "gun") w.ammo = ammo == null ? src.ammo : ammo;
    return w;
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    viewW = innerWidth;
    viewH = innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = viewW + "px";
    canvas.style.height = viewH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function screenToWorld(sx, sy) {
    return {
      x: cam.x + (sx - viewW * 0.5) + shake.x,
      y: cam.y + (sy - viewH * 0.5) + shake.y,
    };
  }

  function addShake(n, angle) {
    shake.mag = Math.min(24, shake.mag + n);
    if (angle != null && !isNaN(angle)) {
      const recoil = angle + Math.PI;
      shake.kx += Math.cos(recoil) * n * 0.7;
      shake.ky += Math.sin(recoil) * n * 0.7;
    }
  }

  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const r = ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t;
    const g = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t;
    const bl = (pa & 255) * (1 - t) + (pb & 255) * t;
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (bl | 0) + ")";
  }

  function closestOnSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
    return { x: x1 + t * dx, y: y1 + t * dy, t };
  }

  function emitNoise(x, y, radius) {
    noises.push({ x, y, r: radius });
  }

  /* ---------- collision ---------- */

  function doorClosed(d) {
    return Math.abs(angNorm(d.angle - d.rest)) < 0.32;
  }

  function forEachSolid(cb) {
    for (let i = 0; i < walls.length; i++) cb(walls[i]);
    for (let i = 0; i < windows.length; i++) {
      if (windows[i].intact) cb(windows[i]);
    }
  }

  function pointInWall(x, y, pad) {
    const p = pad || 0;
    let hit = null;
    forEachSolid((w) => {
      if (hit) return;
      if (x >= w.x - p && x <= w.x + w.w + p && y >= w.y - p && y <= w.y + w.h + p) hit = w;
    });
    return hit;
  }

  function resolveAgainstRect(ent, w) {
    const cx = clamp(ent.x, w.x, w.x + w.w);
    const cy = clamp(ent.y, w.y, w.y + w.h);
    let dx = ent.x - cx;
    let dy = ent.y - cy;
    let d2 = dx * dx + dy * dy;
    const r = ent.r;
    if (d2 >= r * r) return;
    if (d2 < 1e-6) {
      const left = ent.x - w.x;
      const right = w.x + w.w - ent.x;
      const top = ent.y - w.y;
      const bot = w.y + w.h - ent.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) ent.x = w.x - r;
      else if (m === right) ent.x = w.x + w.w + r;
      else if (m === top) ent.y = w.y - r;
      else ent.y = w.y + w.h + r;
    } else {
      const d = Math.sqrt(d2);
      const pen = r - d;
      ent.x += (dx / d) * pen;
      ent.y += (dy / d) * pen;
    }
  }

  function resolveCircleWalls(ent) {
    forEachSolid((w) => resolveAgainstRect(ent, w));
    ent.x = clamp(ent.x, ent.r + 2, MAP_W - ent.r - 2);
    ent.y = clamp(ent.y, ent.r + 2, MAP_H - ent.r - 2);
  }

  function moveCircle(ent, dx, dy) {
    if (dx) {
      ent.x += dx;
      resolveCircleWalls(ent);
    }
    if (dy) {
      ent.y += dy;
      resolveCircleWalls(ent);
    }
  }

  function clipT(p, q, t) {
    if (p === 0) return q < 0 ? null : t;
    const u = q / p;
    if (p < 0) {
      if (u > t[1]) return null;
      if (u > t[0]) t[0] = u;
    } else {
      if (u < t[0]) return null;
      if (u < t[1]) t[1] = u;
    }
    return t;
  }

  function segmentHitsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = [0, 1];
    if (!clipT(-dx, x1 - rx, t)) return false;
    if (!clipT(dx, rx + rw - x1, t)) return false;
    if (!clipT(-dy, y1 - ry, t)) return false;
    if (!clipT(dy, ry + rh - y1, t)) return false;
    return true;
  }

  function rectHitT(x1, y1, x2, y2, w) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = [0, 1];
    if (!clipT(-dx, x1 - w.x, t)) return null;
    if (!clipT(dx, w.x + w.w - x1, t)) return null;
    if (!clipT(-dy, y1 - w.y, t)) return null;
    if (!clipT(dy, w.y + w.h - y1, t)) return null;
    return t[0];
  }

  function doorHitT(x1, y1, x2, y2, d) {
    if (!d || d.crushed) return null;
    const c = Math.cos(d.angle);
    const s = Math.sin(d.angle);
    const lx1 = (x1 - d.hx) * c + (y1 - d.hy) * s;
    const ly1 = -(x1 - d.hx) * s + (y1 - d.hy) * c;
    const lx2 = (x2 - d.hx) * c + (y2 - d.hy) * s;
    const ly2 = -(x2 - d.hx) * s + (y2 - d.hy) * c;
    return rectHitT(lx1, ly1, lx2, ly2, {
      x: 0,
      y: -d.thick * 0.65,
      w: d.length,
      h: d.thick * 1.3,
    });
  }

  function firstStop(x1, y1, x2, y2) {
    let best = 1;
    let hit = false;
    let door = null;
    for (let i = 0; i < walls.length; i++) {
      const t = rectHitT(x1, y1, x2, y2, walls[i]);
      if (t !== null && t < best) {
        best = t;
        hit = true;
        door = null;
      }
    }
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      const t = doorHitT(x1, y1, x2, y2, d);
      if (t !== null && t < best) {
        best = t;
        hit = true;
        door = d;
      }
    }
    return hit ? { t: best, door: door } : null;
  }

  function firstWallHitT(x1, y1, x2, y2) {
    const s = firstStop(x1, y1, x2, y2);
    return s ? s.t : null;
  }

  function collectGlassHits(x1, y1, x2, y2) {
    const hits = [];
    for (let i = 0; i < windows.length; i++) {
      const g = windows[i];
      if (!g.intact) continue;
      const t = rectHitT(x1, y1, x2, y2, g);
      if (t !== null) hits.push({ g, t });
    }
    hits.sort((a, b) => a.t - b.t);
    return hits;
  }

  function hasLOS(x1, y1, x2, y2) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (segmentHitsRect(x1, y1, x2, y2, w.x, w.y, w.w, w.h)) return false;
    }
    for (let i = 0; i < windows.length; i++) {
      const g = windows[i];
      if (g.intact && segmentHitsRect(x1, y1, x2, y2, g.x, g.y, g.w, g.h)) return false;
    }
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (doorHitT(x1, y1, x2, y2, d) !== null) return false;
    }
    return true;
  }

  function cellBlockedAt(cx, cy) {
    const x = cx * NAV_CELL + NAV_CELL * 0.5;
    const y = cy * NAV_CELL + NAV_CELL * 0.5;
    const r = 14;
    let blocked = false;
    forEachSolid((w) => {
      if (blocked) return;
      const px = clamp(x, w.x, w.x + w.w);
      const py = clamp(y, w.y, w.y + w.h);
      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy < r * r) blocked = true;
    });
    return blocked;
  }

  function rebuildNav() {
    navCols = Math.ceil(MAP_W / NAV_CELL);
    navRows = Math.ceil(MAP_H / NAV_CELL);
    navBlocked = new Uint8Array(navCols * navRows);
    for (let y = 0; y < navRows; y++) {
      for (let x = 0; x < navCols; x++) {
        navBlocked[y * navCols + x] = cellBlockedAt(x, y) ? 1 : 0;
      }
    }
    navDirty = false;
  }

  function worldToCell(x, y) {
    return {
      x: clamp((x / NAV_CELL) | 0, 0, navCols - 1),
      y: clamp((y / NAV_CELL) | 0, 0, navRows - 1),
    };
  }

  function nearestWalkable(c) {
    if (navBlocked[c.y * navCols + c.x] === 0) return c;
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = c.x + dx;
          const y = c.y + dy;
          if (x < 0 || y < 0 || x >= navCols || y >= navRows) continue;
          if (navBlocked[y * navCols + x] === 0) return { x, y };
        }
      }
    }
    return c;
  }

  function astar(ax, ay, bx, by) {
    if (navDirty || !navBlocked) rebuildNav();
    const start = nearestWalkable(worldToCell(ax, ay));
    const goal = nearestWalkable(worldToCell(bx, by));
    const key = (x, y) => y * navCols + x;
    const gScore = new Float32Array(navCols * navRows);
    const came = new Int32Array(navCols * navRows);
    const closed = new Uint8Array(navCols * navRows);
    gScore.fill(1e9);
    came.fill(-1);
    const open = [start.x, start.y];
    gScore[key(start.x, start.y)] = 0;
    const hx = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    let found = false;
    let guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0;
      let best = 1e12;
      for (let i = 0; i < open.length; i += 2) {
        const f = gScore[key(open[i], open[i + 1])] + hx(open[i], open[i + 1]);
        if (f < best) {
          best = f;
          bi = i;
        }
      }
      const cx = open[bi];
      const cy = open[bi + 1];
      open.splice(bi, 2);
      if (cx === goal.x && cy === goal.y) {
        found = true;
        break;
      }
      const ck = key(cx, cy);
      if (closed[ck]) continue;
      closed[ck] = 1;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= navCols || ny >= navRows) continue;
          if (navBlocked[key(nx, ny)]) continue;
          if (ox && oy && (navBlocked[key(cx + ox, cy)] || navBlocked[key(cx, cy + oy)])) continue;
          const cost = ox && oy ? 1.414 : 1;
          const nk = key(nx, ny);
          const ng = gScore[ck] + cost;
          if (ng < gScore[nk]) {
            gScore[nk] = ng;
            came[nk] = ck;
            open.push(nx, ny);
          }
        }
      }
    }
    if (!found) return [];
    const cells = [];
    let ck = key(goal.x, goal.y);
    const sk = key(start.x, start.y);
    while (ck !== sk && ck >= 0 && cells.length < 200) {
      cells.push({ x: ck % navCols, y: (ck / navCols) | 0 });
      ck = came[ck];
    }
    cells.reverse();
    const pts = [];
    for (let i = 0; i < cells.length; i++) {
      pts.push({
        x: cells[i].x * NAV_CELL + NAV_CELL * 0.5,
        y: cells[i].y * NAV_CELL + NAV_CELL * 0.5,
      });
    }
    const slim = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = slim[slim.length - 1];
      const next = pts[i + 1];
      if (prev && next) {
        const ax = next.x - prev.x;
        const ay = next.y - prev.y;
        const bx = pts[i].x - prev.x;
        const by = pts[i].y - prev.y;
        const cross = Math.abs(ax * by - ay * bx);
        if (cross < 80) continue;
      }
      slim.push(pts[i]);
    }
    return slim;
  }

  function steerTo(e, tx, ty, speed, dt) {
    e.repath -= dt;
    if (e.repath <= 0 || !e.path || e.pathI >= (e.path.length || 0)) {
      e.path = astar(e.x, e.y, tx, ty);
      e.pathI = 0;
      e.repath = 0.38 + Math.random() * 0.2;
    }
    let gx = tx;
    let gy = ty;
    if (e.path && e.path[e.pathI]) {
      gx = e.path[e.pathI].x;
      gy = e.path[e.pathI].y;
      if (Math.hypot(gx - e.x, gy - e.y) < 22) e.pathI++;
    }
    const dx = gx - e.x;
    const dy = gy - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return;
    const nrm = norm(dx, dy);
    moveCircle(e, nrm.x * speed * dt, nrm.y * speed * dt);
    pushDoors(e, nrm.x * speed, nrm.y * speed, false);
  }

  /* ---------- level ---------- */

  function pushSegs(list, x, y, length, thick, horizontal, gaps, kind) {
    const doorList = (gaps || []).slice().sort((a, b) => a[0] - b[0]);
    let cursor = horizontal ? x : y;
    const end = cursor + length;
    for (let i = 0; i < doorList.length; i++) {
      const a = doorList[i][0];
      const b = doorList[i][1];
      if (a > cursor + 3) {
        if (horizontal) list.push({ x: cursor, y, w: a - cursor, h: thick, kind });
        else list.push({ x, y: cursor, w: thick, h: a - cursor, kind });
      }
      cursor = Math.max(cursor, b);
    }
    if (end - cursor > 3) {
      if (horizontal) list.push({ x: cursor, y, w: end - cursor, h: thick, kind });
      else list.push({ x, y: cursor, w: thick, h: end - cursor, kind });
    }
  }

  function makeLevelKit() {
    const W = [];
    const D = [];
    const G = [];
    const H = (x, y, w, gaps, kind) => pushSegs(W, x, y, w, WT, true, gaps, kind || "wall");
    const V = (x, y, h, gaps, kind) => pushSegs(W, x, y, h, WT, false, gaps, kind || "wall");
    const box = (x, y, w, h, kind) => W.push({ x, y, w, h, kind: kind || "prop" });
    function vDoor(x, y0, y1) {
      D.push({
        hx: x + WT * 0.5,
        hy: y0 + 2,
        length: y1 - y0 - 4,
        thick: 8,
        rest: Math.PI * 0.5,
        angle: Math.PI * 0.5,
        vel: 0,
        squeak: 0,
        crushed: false,
        slab: { x: x, y: y0, w: WT, h: y1 - y0 },
      });
    }
    function hDoor(x0, y, x1) {
      D.push({
        hx: x0 + 2,
        hy: y + WT * 0.5,
        length: x1 - x0 - 4,
        thick: 8,
        rest: 0,
        angle: 0,
        vel: 0,
        squeak: 0,
        crushed: false,
        slab: { x: x0, y: y, w: x1 - x0, h: WT },
      });
    }
    const glass = (x, y, w, h) => G.push({ x, y, w, h, intact: true });
    return { W, D, G, H, V, box, vDoor, hDoor, glass };
  }

  function levelMintLobby() {
    const k = makeLevelKit();
    const { H, V, box, vDoor, hDoor, glass } = k;
    H(0, 0, MAP_W);
    H(0, MAP_H - WT, MAP_W);
    V(0, 0, MAP_H);
    V(MAP_W - WT, 0, MAP_H);

    V(448, 0, 1180, [
      [188, 278],
      [320, 382],
      [470, 548],
      [600, 662],
      [780, 868],
      [1040, 1128],
    ]);
    H(0, 392, 448, [[80, 168]]);
    H(0, 680, 448, [[160, 250]]);
    H(0, 980, 448, [[170, 260]]);
    V(596, 0, MAP_H, [
      [70, 140],
      [188, 278],
      [500, 590],
      [640, 712],
      [860, 950],
      [1188, 1280],
    ]);
    H(596, 360, 760, [
      [720, 810],
      [980, 1088],
    ]);
    V(1356, 0, 360, [
      [140, 230],
      [260, 332],
    ]);
    H(1356, 360, MAP_W - 1356, [
      [1560, 1650],
      [1740, 1848],
    ]);
    H(596, 720, 520, [[700, 790]]);
    V(1356, 360, 500, [
      [430, 520],
      [620, 710],
    ]);
    H(1116, 860, MAP_W - 1116, [
      [1240, 1330],
      [1400, 1508],
      [1580, 1670],
    ]);
    V(1116, 720, 380, [[780, 868]]);
    V(1356, 860, MAP_H - 860, [
      [1040, 1130],
      [1220, 1292],
    ]);

    box(90, 70, 120, 34, "desk");
    box(280, 86, 70, 70, "crate");
    box(70, 760, 150, 40, "desk");
    box(70, 1080, 200, 46, "table");
    box(240, 1220, 90, 90, "crate");
    box(680, 80, 160, 40, "desk");
    box(980, 90, 46, 120, "shelf");
    box(680, 430, 130, 70, "table");
    box(900, 500, 80, 80, "crate");
    box(1480, 80, 180, 40, "desk");
    box(1720, 180, 90, 90, "crate");
    box(1500, 480, 140, 50, "table");
    box(1680, 620, 70, 110, "shelf");
    box(700, 980, 220, 36, "bar");
    box(700, 1180, 80, 80, "crate");
    box(920, 1280, 140, 50, "table");
    box(1500, 1000, 160, 50, "table");
    box(1720, 1180, 90, 90, "crate");

    vDoor(448, 188, 278);
    vDoor(448, 470, 548);
    vDoor(448, 780, 868);
    vDoor(448, 1040, 1128);
    hDoor(160, 680, 250);
    hDoor(170, 980, 260);
    vDoor(596, 188, 278);
    vDoor(596, 500, 590);
    vDoor(596, 860, 950);
    vDoor(596, 1188, 1280);
    hDoor(720, 360, 810);
    vDoor(1356, 140, 230);
    hDoor(1560, 360, 1650);
    hDoor(700, 720, 790);
    vDoor(1356, 430, 520);
    vDoor(1356, 620, 710);
    hDoor(1240, 860, 1330);
    hDoor(1580, 860, 1670);
    vDoor(1116, 780, 868);
    vDoor(1356, 1040, 1130);

    glass(448, 320, WT, 62);
    glass(448, 600, WT, 62);
    glass(80, 392, 88, WT);
    glass(596, 70, WT, 70);
    glass(596, 640, WT, 72);
    glass(980, 360, 108, WT);
    glass(1356, 260, WT, 72);
    glass(1740, 360, 108, WT);
    glass(1400, 860, 108, WT);
    glass(1356, 1220, WT, 72);

    return {
      id: "mint",
      name: "MINT LOBBY",
      spawn: { x: 220, y: 210 },
      walls: k.W,
      doors: k.D,
      windows: k.G,
      rooms: [
        { x: WT, y: WT, w: 448 - WT, h: 392 - WT, color: "#1a1210", label: "STAFF" },
        { x: WT, y: 392 + WT, w: 448 - WT, h: 680 - 392 - WT, color: "#14181c", label: "LOCKER" },
        { x: WT, y: 680 + WT, w: 448 - WT, h: 980 - 680 - WT, color: "#181410", label: "RECORDS" },
        { x: WT, y: 980 + WT, w: 448 - WT, h: MAP_H - WT - 980 - WT, color: "#161218", label: "BRIEFING" },
        { x: 448 + WT, y: WT, w: 596 - 448 - WT, h: MAP_H - WT * 2, color: "#120e10", label: "" },
        { x: 596 + WT, y: WT, w: 1356 - 596 - WT, h: 360 - WT, color: "#151820", label: "TELLERS" },
        { x: 1356 + WT, y: WT, w: MAP_W - WT - 1356 - WT, h: 360 - WT, color: "#18141c", label: "ACCOUNTS" },
        { x: 596 + WT, y: 360 + WT, w: 720, h: 720 - 360 - WT, color: "#1a1612", label: "BREAK" },
        { x: 1356 + WT, y: 360 + WT, w: MAP_W - WT - 1356 - WT, h: 860 - 360 - WT, color: "#121416", label: "STORE" },
        { x: 596 + WT, y: 860 + WT, w: 1356 - 596 - WT, h: MAP_H - WT - 860 - WT, color: "#1a1012", label: "HALL" },
        { x: 1356 + WT, y: 860 + WT, w: MAP_W - WT - 1356 - WT, h: MAP_H - WT - 860 - WT, color: "#140e14", label: "MANAGER" },
      ],
      enemies: [
        { x: 510, y: 230, weapon: "pistol", angle: Math.PI, color: "#1d4e89" },
        { x: 390, y: 510, weapon: "bat", angle: 0, color: "#163a6b" },
        { x: 655, y: 233, weapon: "shotgun", angle: Math.PI, color: "#245ea8" },
        { x: 650, y: 545, weapon: "pistol", angle: Math.PI, color: "#1a4478" },
        { x: 180, y: 820, weapon: "pistol", angle: 1.2, color: "#1d4e89" },
        { x: 300, y: 1180, weapon: "pistol", angle: -1.4, color: "#163a6b" },
        { x: 160, y: 1320, weapon: "knife", angle: 0.3, color: "#1a4478" },
        { x: 1100, y: 220, weapon: "uzi", angle: Math.PI, color: "#245ea8" },
        { x: 1580, y: 170, weapon: "pistol", angle: 2.6, color: "#1d4e89" },
        { x: 1760, y: 260, weapon: "bat", angle: -2.2, color: "#163a6b" },
        { x: 1040, y: 600, weapon: "knife", angle: -1.0, color: "#1a4478" },
        { x: 1580, y: 560, weapon: "pistol", angle: Math.PI, color: "#1d4e89" },
        { x: 1760, y: 720, weapon: "uzi", angle: -2.4, color: "#245ea8" },
        { x: 780, y: 1080, weapon: "pistol", angle: 1.6, color: "#163a6b" },
        { x: 1020, y: 1240, weapon: "shotgun", angle: Math.PI, color: "#1a4478" },
        { x: 880, y: 1380, weapon: "bat", angle: -1.2, color: "#1d4e89" },
        { x: 1240, y: 1120, weapon: "uzi", angle: 2.8, color: "#245ea8" },
        { x: 1560, y: 1120, weapon: "rifle", angle: Math.PI, color: "#163a6b" },
        { x: 1760, y: 1320, weapon: "knife", angle: -2.0, color: "#1a4478" },
      ],
      pickups: [
        { x: 200, y: 140, id: "pistol" },
        { x: 120, y: 500, id: "bat" },
        { x: 980, y: 140, id: "uzi" },
        { x: 820, y: 600, id: "shotgun" },
        { x: 1600, y: 980, id: "rifle" },
      ],
    };
  }

  function levelVaultFloor() {
    const k = makeLevelKit();
    const { H, V, box, vDoor, hDoor, glass } = k;
    H(0, 0, MAP_W);
    H(0, MAP_H - WT, MAP_W);
    V(0, 0, MAP_H);
    V(MAP_W - WT, 0, MAP_H);

    V(400, 0, MAP_H, [
      [160, 250],
      [430, 510],
      [760, 850],
      [1120, 1210],
    ]);
    H(0, 360, 400, [[120, 210]]);
    H(0, 720, 400, [[130, 220]]);
    H(0, 1080, 400);

    V(1280, 0, MAP_H, [
      [180, 270],
      [620, 720],
      [1040, 1140],
    ]);
    H(400, 480, 880, [
      [560, 650],
      [900, 1000],
    ]);
    H(400, 960, 880, [[700, 800]]);
    H(1280, 360, MAP_W - 1280, [[1480, 1570]]);
    H(1280, 900, MAP_W - 1280, [[1500, 1600]]);
    V(1640, 360, 540, [[560, 650]]);

    box(70, 70, 140, 40, "desk");
    box(80, 200, 70, 70, "crate");
    box(60, 430, 160, 40, "desk");
    box(70, 820, 90, 90, "crate");
    box(80, 1180, 180, 46, "table");
    box(520, 80, 200, 40, "desk");
    box(860, 120, 50, 140, "shelf");
    box(540, 600, 160, 50, "table");
    box(900, 700, 80, 80, "crate");
    box(540, 1100, 220, 40, "desk");
    box(980, 1240, 90, 90, "crate");
    box(1380, 80, 180, 40, "desk");
    box(1740, 160, 80, 80, "crate");
    box(1380, 500, 140, 60, "table");
    box(1740, 700, 70, 120, "shelf");
    box(1380, 1100, 160, 50, "table");
    box(1720, 1240, 90, 90, "crate");

    vDoor(400, 160, 250);
    vDoor(400, 430, 510);
    vDoor(400, 760, 850);
    vDoor(400, 1120, 1210);
    hDoor(120, 360, 210);
    hDoor(130, 720, 220);
    vDoor(1280, 180, 270);
    vDoor(1280, 620, 720);
    vDoor(1280, 1040, 1140);
    hDoor(560, 480, 650);
    hDoor(900, 480, 1000);
    hDoor(700, 960, 800);
    hDoor(1480, 360, 1570);
    hDoor(1500, 900, 1600);
    vDoor(1640, 560, 650);

    glass(400, 280, WT, 70);
    glass(400, 560, WT, 70);
    glass(70, 360, 40, WT);
    glass(1280, 80, WT, 80);
    glass(1280, 780, WT, 80);
    glass(1100, 480, 100, WT);
    glass(1680, 360, 90, WT);
    glass(1680, 900, 90, WT);

    return {
      id: "vault",
      name: "THE VAULT",
      spawn: { x: 180, y: 180 },
      walls: k.W,
      doors: k.D,
      windows: k.G,
      rooms: [
        { x: WT, y: WT, w: 400 - WT, h: 360 - WT, color: "#16120e", label: "ENTRY" },
        { x: WT, y: 360 + WT, w: 400 - WT, h: 720 - 360 - WT, color: "#12161a", label: "LOCKER" },
        { x: WT, y: 720 + WT, w: 400 - WT, h: 1080 - 720 - WT, color: "#181410", label: "ARMORY" },
        { x: WT, y: 1080 + WT, w: 400 - WT, h: MAP_H - WT - 1080 - WT, color: "#141218", label: "CELLS" },
        { x: 400 + WT, y: WT, w: 1280 - 400 - WT, h: 480 - WT, color: "#151820", label: "CONTROL" },
        { x: 400 + WT, y: 480 + WT, w: 1280 - 400 - WT, h: 960 - 480 - WT, color: "#1a1410", label: "CORRIDOR" },
        { x: 400 + WT, y: 960 + WT, w: 1280 - 400 - WT, h: MAP_H - WT - 960 - WT, color: "#121416", label: "SERVERS" },
        { x: 1280 + WT, y: WT, w: MAP_W - WT - 1280 - WT, h: 360 - WT, color: "#18141c", label: "OFFICE" },
        { x: 1280 + WT, y: 360 + WT, w: 1640 - 1280 - WT, h: 900 - 360 - WT, color: "#1c1610", label: "CAGE" },
        { x: 1640 + WT, y: 360 + WT, w: MAP_W - WT - 1640 - WT, h: 900 - 360 - WT, color: "#20180c", label: "VAULT" },
        { x: 1280 + WT, y: 900 + WT, w: MAP_W - WT - 1280 - WT, h: MAP_H - WT - 900 - WT, color: "#140e14", label: "GOLD" },
      ],
      enemies: [
        { x: 460, y: 200, weapon: "shotgun", angle: Math.PI, color: "#1d4e89" },
        { x: 340, y: 470, weapon: "pistol", angle: 0, color: "#163a6b" },
        { x: 460, y: 800, weapon: "rifle", angle: Math.PI, color: "#245ea8" },
        { x: 340, y: 1160, weapon: "uzi", angle: 0, color: "#1a4478" },
        { x: 200, y: 500, weapon: "bat", angle: 1.2, color: "#163a6b" },
        { x: 180, y: 860, weapon: "pistol", angle: -0.4, color: "#1d4e89" },
        { x: 220, y: 1280, weapon: "knife", angle: 0.5, color: "#1a4478" },
        { x: 700, y: 160, weapon: "pistol", angle: 2.4, color: "#245ea8" },
        { x: 1040, y: 220, weapon: "uzi", angle: Math.PI, color: "#1d4e89" },
        { x: 620, y: 700, weapon: "shotgun", angle: 0.2, color: "#163a6b" },
        { x: 980, y: 800, weapon: "rifle", angle: Math.PI, color: "#1a4478" },
        { x: 760, y: 1180, weapon: "pistol", angle: -1.2, color: "#245ea8" },
        { x: 1340, y: 220, weapon: "pistol", angle: Math.PI, color: "#1d4e89" },
        { x: 1340, y: 670, weapon: "shotgun", angle: Math.PI, color: "#163a6b" },
        { x: 1500, y: 620, weapon: "rifle", angle: 0, color: "#245ea8" },
        { x: 1760, y: 620, weapon: "uzi", angle: Math.PI, color: "#1a4478" },
        { x: 1340, y: 1090, weapon: "pistol", angle: Math.PI, color: "#1d4e89" },
        { x: 1700, y: 1180, weapon: "knife", angle: -2.1, color: "#163a6b" },
      ],
      pickups: [
        { x: 120, y: 120, id: "pistol" },
        { x: 140, y: 800, id: "shotgun" },
        { x: 1100, y: 140, id: "uzi" },
        { x: 1500, y: 500, id: "rifle" },
        { x: 1760, y: 1080, id: "bat" },
      ],
    };
  }

  class LevelManager {
    constructor() {
      this.index = 0;
      this.builders = [levelMintLobby, levelVaultFloor];
    }
    get last() {
      return this.index >= this.builders.length - 1;
    }
    get name() {
      return this.index === 0 ? "MINT LOBBY" : "THE VAULT";
    }
    apply(i) {
      this.index = clamp(i, 0, this.builders.length - 1);
      const d = this.builders[this.index]();
      walls = d.walls;
      doors = d.doors;
      windows = d.windows;
      rooms = d.rooms;
      enemyTemplate = d.enemies;
      pickupTemplate = d.pickups;
      spawn.x = d.spawn.x;
      spawn.y = d.spawn.y;
      navDirty = true;
      return d;
    }
    restart() {
      return this.apply(this.index);
    }
    advance() {
      if (this.last) return false;
      this.apply(this.index + 1);
      return true;
    }
  }

  /* ---------- entities ---------- */

  function makePlayer() {
    return {
      x: spawn.x,
      y: spawn.y,
      r: PLAYER_R,
      angle: 0.15,
      color: "#e10600",
      jacket: "#c1121f",
      mask: "#f4efe4",
      dali: true,
      isPlayer: true,
      alive: true,
      weapon: copyWeapon("pistol"),
      cooldown: 0,
      swinging: 0,
      stepAcc: 0,
      vx: 0,
      vy: 0,
      sprint: false,
      dodgeT: 0,
      dodgeCd: 0,
      dodgeDx: 0,
      dodgeDy: 0,
    };
  }

  function makeEnemy(t) {
    return {
      x: t.x,
      y: t.y,
      r: ENEMY_R,
      angle: t.angle,
      wishAngle: t.angle,
      color: t.color || COP_BLUE,
      baseColor: t.color || COP_BLUE,
      cop: true,
      dali: false,
      isPlayer: false,
      alive: true,
      weapon: copyWeapon(t.weapon),
      cooldown: rand(0.15, 0.6),
      alert: false,
      mode: "idle",
      lastSeen: { x: t.x, y: t.y },
      lookT: rand(0.6, 2.2),
      searchT: 0,
      stun: 0,
      knockVx: 0,
      knockVy: 0,
      swinging: 0,
      path: [],
      pathI: 0,
      repath: 0,
      kind: WEAPONS[t.weapon].type,
      speed: WEAPONS[t.weapon].type === "melee" ? 188 : 148,
    };
  }

  function makePickup(x, y, id, ammo) {
    return { x, y, id, ammo, t: 0 };
  }

  function resetRun() {
    if (levels) levels.restart();
    player = makePlayer();
    enemies = enemyTemplate.map(makeEnemy);
    pickups = pickupTemplate.map((p) => makePickup(p.x, p.y, p.id));
    bullets.length = 0;
    thrown.length = 0;
    particles.length = 0;
    stains.length = 0;
    corpses.length = 0;
    flashes.length = 0;
    trails.length = 0;
    noises.length = 0;
    kills = 0;
    combo.count = 0;
    combo.timer = 0;
    combo.pop = 0;
    combo.shake = 0;
    shake.mag = 0;
    shake.x = 0;
    shake.y = 0;
    shake.kx = 0;
    shake.ky = 0;
    navDirty = true;
    cam.x = player.x;
    cam.y = player.y;
    mouse.left = false;
    mouse.right = false;
    mouse.leftClicked = false;
    mouse.rightClicked = false;
    keys.dodge = false;
    mode = "play";
    hideOverlay();
    updateHud();
    updateComboHud();
  }

  function resetCombo() {
    combo.count = 0;
    combo.timer = 0;
    combo.pop = 0;
    combo.shake = 0;
    updateComboHud();
  }

  function addCombo() {
    combo.count += 1;
    combo.timer = COMBO_WINDOW;
    combo.pop = 1;
    combo.shake = Math.min(16, 5 + combo.count * 1.4);
    addShake(2 + Math.min(8, combo.count), rand(0, TAU));
    updateComboHud();
  }

  function updateCombo(dt) {
    if (combo.count > 0) {
      combo.timer -= dt;
      if (combo.timer <= 0) resetCombo();
    }
    combo.pop = Math.max(0, combo.pop - dt * 3.4);
    combo.shake *= Math.pow(0.04, dt);
    if (comboEl && combo.count > 0) {
      const jx = (Math.random() - 0.5) * combo.shake * 1.6;
      const jy = (Math.random() - 0.5) * combo.shake * 1.2;
      const sc = 1 + combo.pop * 0.12;
      comboEl.style.transform =
        "translate(calc(-50% + " + jx.toFixed(1) + "px), " + jy.toFixed(1) + "px) scale(" + sc.toFixed(3) + ")";
      if (comboFill) comboFill.style.transform = "scaleX(" + clamp(combo.timer / COMBO_WINDOW, 0, 1) + ")";
    }
  }

  function updateComboHud() {
    if (!comboEl) return;
    if (combo.count <= 0) {
      comboEl.className = "off";
      comboEl.setAttribute("aria-hidden", "true");
      comboEl.style.transform = "translate(-50%, 0)";
      return;
    }
    comboMult.textContent = combo.count + "x";
    comboWord.textContent = combo.count >= 6 ? "KILLING SPREE!!" : combo.count >= 4 ? "COMBO!!" : "COMBO!";
    comboEl.className = combo.count >= 4 ? "hot" : "";
    comboEl.setAttribute("aria-hidden", "false");
    comboEl.classList.remove("pop");
    void comboEl.offsetWidth;
    comboEl.classList.add("pop");
    if (comboFill) comboFill.style.transform = "scaleX(1)";
  }

  /* ---------- audio ---------- */

  function ensureAudio() {
    if (audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const master = ac.createGain();
    master.gain.value = 0.9;
    const sfx = ac.createGain();
    sfx.gain.value = 0.85;
    const music = ac.createGain();
    music.gain.value = 0.42;
    sfx.connect(master);
    music.connect(master);
    master.connect(ac.destination);
    audio.ctx = ac;
    audio.master = master;
    audio.sfx = sfx;
    audio.music = music;
  }

  function resumeAudio() {
    ensureAudio();
    if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
  }

  function envGain(start, peak, a, d, vol) {
    const g = audio.ctx.createGain();
    const t = start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  }

  function playNoise(duration, freq, q, vol) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const buf = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * duration), audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const bp = audio.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = envGain(t, vol, 0.004, duration, vol);
    src.connect(bp);
    bp.connect(g);
    g.connect(audio.sfx);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  function playTone(type, freq, dur, vol, slide) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = envGain(t, vol, 0.005, dur, vol);
    o.connect(g);
    g.connect(audio.sfx);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function sfxShoot(kind) {
    if (kind === "shotgun") {
      playNoise(0.18, 900, 0.7, 0.55);
      playTone("square", 180, 0.12, 0.18, 50);
    } else if (kind === "uzi") {
      playNoise(0.05, 1800, 1.1, 0.22);
      playTone("square", 420, 0.04, 0.08, 120);
    } else if (kind === "rifle") {
      playNoise(0.1, 1400, 0.9, 0.38);
      playTone("sawtooth", 260, 0.08, 0.12, 70);
    } else {
      playNoise(0.08, 1600, 1, 0.32);
      playTone("square", 320, 0.06, 0.1, 90);
    }
  }

  function sfxEmpty() {
    playTone("square", 90, 0.04, 0.06);
    playNoise(0.04, 2400, 2, 0.08);
  }

  function sfxMelee() {
    playNoise(0.07, 400, 0.8, 0.22);
    playTone("triangle", 140, 0.08, 0.1, 60);
  }

  function sfxThrow() {
    playNoise(0.08, 700, 0.6, 0.16);
    playTone("triangle", 220, 0.12, 0.08, 80);
  }

  function sfxHit() {
    playNoise(0.12, 280, 0.5, 0.4);
    playTone("sine", 90, 0.16, 0.18, 30);
    addShake(8);
  }

  function sfxPickup() {
    playTone("square", 520, 0.06, 0.08);
    playTone("square", 780, 0.08, 0.07);
  }

  function sfxClick() {
    playNoise(0.03, 2000, 1.4, 0.08);
  }

  function sfxDoorCreak() {
    playNoise(0.06, 420, 0.7, 0.12);
    playTone("triangle", 180, 0.07, 0.05, 90);
  }

  function sfxDoorSlam() {
    playNoise(0.14, 180, 0.55, 0.42);
    playTone("sine", 70, 0.12, 0.16, 28);
  }

  function sfxGlass() {
    playNoise(0.16, 4200, 0.9, 0.38);
    playNoise(0.1, 7200, 1.4, 0.22);
    playTone("square", 1400, 0.05, 0.06, 400);
  }

  function sfxDodge() {
    playNoise(0.06, 900, 0.8, 0.12);
    playTone("triangle", 260, 0.08, 0.06, 90);
  }

  function startHtmlMusic() {
    if (audio.html) {
      audio.html.pause();
      audio.html = null;
    }
    const tryIndex = (i, attempts) => {
      if (attempts >= TRACKS.length) {
        audio.usingHtml = false;
        audio.html = null;
        startSynthMusic();
        return;
      }
      const track = TRACKS[i % TRACKS.length];
      const el = new Audio(track.src);
      el.preload = "auto";
      el.loop = false;
      el.volume = audio.muted || !audio.musicOn ? 0 : 0.52;
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        el.pause();
        tryIndex(i + 1, attempts + 1);
      };
      el.addEventListener("ended", () => {
        audio.trackIndex = (audio.trackIndex + 1) % TRACKS.length;
        startHtmlMusic();
      });
      el.addEventListener("error", fail);
      audio.html = el;
      audio.trackIndex = i % TRACKS.length;
      const played = () => {
        audio.usingHtml = true;
        stopSynthMusic();
        audio.currentLabel = track.title + " — " + track.artist + " (CC BY)";
        if (hudTrack) hudTrack.textContent = audio.currentLabel;
      };
      const p = el.play();
      if (p && p.then) p.then(played).catch(fail);
      else played();
    };
    tryIndex(audio.trackIndex, 0);
  }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function startSynthMusic() {
    if (!audio.ctx || audio.synth) return;
    const ac = audio.ctx;
    const out = ac.createGain();
    out.gain.value = audio.muted || !audio.musicOn ? 0 : 0.28;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    out.connect(filter);
    filter.connect(audio.music);

    const bpm = 142;
    const stepDur = 60 / bpm / 4;
    let step = 0;
    let next = ac.currentTime + 0.05;
    const bassProg = [33, 33, 29, 36, 33, 29, 31, 36];
    const arp = [69, 72, 76, 79, 76, 72, 69, 64];

    function kick(t) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.18);
    }
    function snare(t) {
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.12), ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ac.createBufferSource();
      s.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1800;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      s.connect(bp);
      bp.connect(g);
      g.connect(out);
      s.start(t);
      s.stop(t + 0.13);
    }
    function hat(t, open) {
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * (open ? 0.12 : 0.04)), ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ac.createBufferSource();
      s.buffer = buf;
      const hp = ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 7000;
      const g = ac.createGain();
      g.gain.setValueAtTime(open ? 0.12 : 0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.1 : 0.03));
      s.connect(hp);
      hp.connect(g);
      g.connect(out);
      s.start(t);
      s.stop(t + 0.12);
    }
    function bass(t, midi) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const f = ac.createBiquadFilter();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(midiToFreq(midi), t);
      f.type = "lowpass";
      f.frequency.setValueAtTime(420, t);
      f.frequency.exponentialRampToValueAtTime(140, t + 0.18);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(f);
      f.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.24);
    }
    function lead(t, midi) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(midiToFreq(midi), t);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.1);
    }

    function tick() {
      if (!audio.synth) return;
      const now = ac.currentTime;
      while (next < now + 0.25) {
        const s = step % 16;
        const bar = Math.floor(step / 16) % 8;
        if (s === 0 || s === 8) kick(next);
        if (s === 4 || s === 12) snare(next);
        if (s % 2 === 0) hat(next, s % 8 === 6);
        if (s % 2 === 0) bass(next, bassProg[bar] + (s === 6 || s === 14 ? 12 : 0));
        if (s % 2 === 1) lead(next, arp[(s + bar) % arp.length] - (bar % 2 ? 0 : 12) + 12);
        next += stepDur;
        step++;
      }
      audio.synth.timer = setTimeout(tick, 40);
    }

    audio.synth = { out, filter, timer: null };
    audio.currentLabel = "COLD COLUMN THEME — procedural synthwave";
    if (hudTrack) hudTrack.textContent = audio.currentLabel;
    tick();
  }

  function stopSynthMusic() {
    if (!audio.synth) return;
    clearTimeout(audio.synth.timer);
    try {
      audio.synth.out.disconnect();
    } catch (e) {}
    audio.synth = null;
  }

  function startMusic() {
    audio.trackIndex = irand(0, 2);
    startHtmlMusic();
  }

  function setMusicEnabled(on) {
    audio.musicOn = on;
    if (audio.html) audio.html.volume = on && !audio.muted ? 0.52 : 0;
    if (audio.synth) audio.synth.out.gain.value = on && !audio.muted ? 0.28 : 0;
    if (audio.dread) audio.dread.volume = on && !audio.muted ? 0.48 : 0;
  }

  function startDreadSting() {
    stopDreadSting();
    if (audio.html) audio.html.volume = audio.musicOn && !audio.muted ? 0.08 : 0;
    const el = new Audio("music/absolute-terror.mp3");
    el.volume = audio.musicOn && !audio.muted ? 0.48 : 0;
    el.loop = true;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    audio.dread = el;
    if (audio.ctx) {
      const t = audio.ctx.currentTime;
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(46, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.8);
      o.connect(g);
      g.connect(audio.music);
      o.start(t);
      audio.drone = { o, g };
    }
  }

  function stopDreadSting() {
    if (audio.dread) {
      audio.dread.pause();
      audio.dread = null;
    }
    if (audio.drone) {
      try {
        audio.drone.g.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + 0.3);
        audio.drone.o.stop(audio.ctx.currentTime + 0.35);
      } catch (err) {}
      audio.drone = null;
    }
    if (audio.html) audio.html.volume = audio.musicOn && !audio.muted ? 0.52 : 0;
  }

  /* ---------- combat ---------- */

  function shatterGlass(g, hx, hy) {
    if (!g.intact) return;
    g.intact = false;
    navDirty = true;
    sfxGlass();
    const cx = g.x + g.w * 0.5;
    const cy = g.y + g.h * 0.5;
    const n = 22 + irand(0, 10);
    for (let i = 0; i < n; i++) {
      if (particles.length >= PARTICLE_CAP) particles.shift();
      const a = rand(0, TAU);
      const spd = rand(80, 360);
      particles.push({
        x: hx != null ? hx : cx + rand(-g.w * 0.4, g.w * 0.4),
        y: hy != null ? hy : cy + rand(-g.h * 0.4, g.h * 0.4),
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: rand(0.18, 0.45),
        size: irand(1, 3),
        r: pick(["#e8fbff", "#9adfff", "#ffffff", "#7ec8e8", "#c9f0ff"]),
        stain: false,
      });
    }
    emitNoise(cx, cy, 320);
    if (!player || !player.alive) return;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const d = Math.hypot(e.x - cx, e.y - cy);
      if (d > 280) continue;
      if (hasLOS(e.x, e.y, player.x, player.y)) setCombat(e, player.x, player.y);
      else setSearch(e, player.x, player.y);
    }
  }

  function breakGlassOnSegment(x1, y1, x2, y2) {
    const hits = collectGlassHits(x1, y1, x2, y2);
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      shatterGlass(h.g, x1 + (x2 - x1) * h.t, y1 + (y2 - y1) * h.t);
    }
    return hits.length > 0;
  }

  function stunEnemy(e, ang) {
    if (!e.alive) return;
    e.stun = 1.85;
    e.knockVx = Math.cos(ang) * 260;
    e.knockVy = Math.sin(ang) * 260;
    e.mode = "search";
    e.alert = true;
    e.color = mixHex(e.baseColor, "#e09028", 0.45);
    e.lastSeen.x = player ? player.x : e.x;
    e.lastSeen.y = player ? player.y : e.y;
    addShake(6, ang);
  }

  function crushDoor(d, hx, hy) {
    if (!d || d.crushed) return;
    d.crushed = true;
    d.vel = 0;
    navDirty = true;
    const cx = hx != null ? hx : d.hx + Math.cos(d.angle) * d.length * 0.5;
    const cy = hy != null ? hy : d.hy + Math.sin(d.angle) * d.length * 0.5;
    for (let i = 0; i < 22; i++) {
      if (particles.length >= PARTICLE_CAP) particles.shift();
      const a = rand(0, TAU);
      const spd = rand(70, 300);
      particles.push({
        x: cx + rand(-8, 8),
        y: cy + rand(-8, 8),
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: rand(0.2, 0.5),
        size: irand(1, 3),
        r: pick(["#6a3a22", "#8a5a32", "#3a2214", "#c4a070", "#4a2a18"]),
        stain: false,
      });
    }
    playNoise(0.14, 260, 0.5, 0.4);
    playTone("triangle", 90, 0.1, 0.12, 40);
    emitNoise(cx, cy, 240);
    addShake(6, rand(0, TAU));
  }

  function slamDoor(d, towardSide) {
    d.vel = towardSide * 16;
    const slamAng = d.angle + (towardSide > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
    addShake(11, slamAng);
    sfxDoorSlam();
    emitNoise(d.hx + Math.cos(d.angle) * d.length * 0.5, d.hy + Math.sin(d.angle) * d.length * 0.5, 280);
    const c = Math.cos(d.angle);
    const s = Math.sin(d.angle);
    const x2 = d.hx + c * d.length;
    const y2 = d.hy + s * d.length;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const eside = Math.sign(c * (e.y - d.hy) - s * (e.x - d.hx));
      const hit = closestOnSeg(e.x, e.y, d.hx, d.hy, x2, y2);
      const dist = Math.hypot(e.x - hit.x, e.y - hit.y);
      const along = hit.t >= -0.08 && hit.t <= 1.18;
      if (along && (eside === towardSide || eside === 0) && dist < 80) {
        stunEnemy(e, slamAng);
      }
    }
  }

  function pushDoors(ent, vx, vy, bash) {
    const speed = Math.hypot(vx, vy);
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.crushed) continue;
      const c = Math.cos(d.angle);
      const s = Math.sin(d.angle);
      const x2 = d.hx + c * d.length;
      const y2 = d.hy + s * d.length;
      const hit = closestOnSeg(ent.x, ent.y, d.hx, d.hy, x2, y2);
      const dx = ent.x - hit.x;
      const dy = ent.y - hit.y;
      const dist = Math.hypot(dx, dy);
      const rad = ent.r + d.thick * 0.55;
      if (dist >= rad) continue;
      const side = Math.sign(c * (ent.y - d.hy) - s * (ent.x - d.hx)) || 1;
      const lever = 0.28 + hit.t;
      const into = vx * -s + vy * c;
      if (bash && speed > 300 && Math.abs(angNorm(d.angle - d.rest)) < 0.7) {
        slamDoor(d, -side);
      } else {
        d.vel += -side * (2.1 + Math.abs(into) * 0.014) * lever;
        if (d.squeak <= 0 && Math.abs(d.vel) > 1.2) {
          sfxDoorCreak();
          d.squeak = 0.28;
        }
      }
      if (dist < 0.001) {
        ent.x += -s * side * 2;
        ent.y += c * side * 2;
      } else {
        const pen = (rad - dist) * 0.5;
        ent.x += (dx / dist) * pen;
        ent.y += (dy / dist) * pen;
      }
    }
  }

  function updateDoors(dt) {
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.crushed) continue;
      d.squeak = Math.max(0, d.squeak - dt);
      d.vel *= Math.pow(0.1, dt);
      if (Math.abs(d.vel) < 0.45) d.vel += angNorm(d.rest - d.angle) * 2.4 * dt;
      d.angle += d.vel * dt;
      const minA = d.rest - 2.45;
      const maxA = d.rest + 2.45;
      if (d.angle < minA) {
        d.angle = minA;
        d.vel *= -0.18;
      } else if (d.angle > maxA) {
        d.angle = maxA;
        d.vel *= -0.18;
      }
      if (d.vel > 16) d.vel = 16;
      if (d.vel < -16) d.vel = -16;
    }
  }

  function sprayBlood(x, y, angle, power) {
    const n = 28 + ((Math.random() * 18) | 0);
    const pwr = power || 1;
    for (let i = 0; i < n; i++) {
      if (particles.length >= PARTICLE_CAP) particles.shift();
      const a = angle + rand(-1.15, 1.15) + (Math.random() < 0.35 ? Math.PI : 0);
      const spd = rand(50, 320) * pwr;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: rand(0.18, 0.55),
        size: irand(1, 3),
        r: pick(["#9b0f24", "#c4162e", "#7a0b1b", "#e11d38", "#5c0814"]),
        stain: Math.random() < 0.78,
      });
    }
    for (let i = 0; i < 8; i++) {
      if (stains.length >= STAIN_CAP) stains.shift();
      stains.push({
        x: x + rand(-10, 10),
        y: y + rand(-10, 10),
        size: rand(2, 7),
        a: rand(0.35, 0.7),
        r: pick(["#6e0c18", "#8d1020", "#4d0811"]),
      });
    }
  }

  function addCorpse(ent) {
    corpses.push({
      x: ent.x,
      y: ent.y,
      angle: ent.angle,
      color: ent.color,
      r: ent.r,
      mask: ent.mask || null,
      dali: !!ent.dali,
      cop: !!ent.cop,
      isPlayer: !!ent.isPlayer,
    });
  }

  function dropWeapon(x, y, weapon) {
    if (!weapon || weapon.id === "fists") return;
    pickups.push(makePickup(x + rand(-6, 6), y + rand(-6, 6), weapon.id, weapon.ammo));
  }

  function killEnemy(e, hx, hy) {
    if (!e.alive) return;
    e.alive = false;
    const a = Math.atan2(hy - e.y, hx - e.x);
    sprayBlood(e.x, e.y, a, 1.05);
    addCorpse(e);
    dropWeapon(e.x, e.y, e.weapon);
    sfxHit();
    kills += 1;
    addCombo();
    updateHud();
    if (enemies.every((n) => !n.alive)) winGame();
  }

  function killPlayer(hx, hy) {
    if (!player.alive) return;
    player.alive = false;
    const a = Math.atan2(hy - player.y, hx - player.x);
    sprayBlood(player.x, player.y, a, 1.2);
    addCorpse(player);
    sfxHit();
    addShake(14, a);
    resetCombo();
    mode = "dead";
    showDead();
  }

  function muzzle(x, y, angle) {
    flashes.push({ x, y, angle, life: 0.05 });
  }

  function spawnBullets(owner, weapon, x, y, angle) {
    const n = weapon.pellets || 1;
    for (let i = 0; i < n; i++) {
      const a = angle + rand(-weapon.spread, weapon.spread);
      bullets.push({
        x,
        y,
        vx: Math.cos(a) * weapon.speed,
        vy: Math.sin(a) * weapon.speed,
        r: n > 1 ? 2.2 : 2.8,
        owner,
        life: 0.9,
        px: x,
        py: y,
      });
    }
    muzzle(x, y, angle);
    emitNoise(x, y, HEAR_GUN);
  }

  function fireGun(ent, isPlayer) {
    const w = ent.weapon;
    if (!w || w.type !== "gun") return;
    if (ent.cooldown > 0) return;
    if (w.ammo <= 0) {
      if (isPlayer) sfxEmpty();
      ent.cooldown = 0.18;
      return;
    }
    w.ammo -= 1;
    ent.cooldown = w.rate;
    const ox = ent.x + Math.cos(ent.angle) * (ent.r + 14);
    const oy = ent.y + Math.sin(ent.angle) * (ent.r + 14);
    spawnBullets(isPlayer ? "player" : ent, w, ox, oy, ent.angle);
    const kick = w.id === "shotgun" ? 8.5 : w.id === "rifle" ? 5 : w.id === "uzi" ? 2.4 : 3.6;
    addShake(kick, ent.angle);
    if (isPlayer) {
      sfxShoot(w.id);
      updateHud();
    } else {
      sfxShoot(w.id === "shotgun" ? "shotgun" : w.id === "uzi" ? "uzi" : "pistol");
    }
  }

  function meleeHit(ent, isPlayer) {
    const w = ent.weapon;
    const range = w.range || 30;
    const swing = w.swing || 1.1;
    if (isPlayer) {
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive) continue;
        const dx = e.x - ent.x;
        const dy = e.y - ent.y;
        const d = Math.hypot(dx, dy);
        if (d > range + e.r) continue;
        const a = Math.atan2(dy, dx);
        if (angDiff(ent.angle, a) < swing * 0.55) killEnemy(e, ent.x, ent.y);
      }
    } else if (player.alive) {
      const dx = player.x - ent.x;
      const dy = player.y - ent.y;
      const d = Math.hypot(dx, dy);
      if (d <= range + player.r && angDiff(ent.angle, Math.atan2(dy, dx)) < 0.9) {
        killPlayer(ent.x, ent.y);
      }
    }
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.crushed) continue;
      const c = Math.cos(d.angle);
      const s = Math.sin(d.angle);
      const hit = closestOnSeg(ent.x, ent.y, d.hx, d.hy, d.hx + c * d.length, d.hy + s * d.length);
      const dist = Math.hypot(ent.x - hit.x, ent.y - hit.y);
      const ang = Math.atan2(hit.y - ent.y, hit.x - ent.x);
      if (dist < range + 12 && angDiff(ent.angle, ang) < 1.05) crushDoor(d, hit.x, hit.y);
    }
    emitNoise(ent.x, ent.y, HEAR_MELEE);
    sfxMelee();
    addShake(isPlayer ? 3.4 : 5.2, ent.angle);
  }

  function swingMelee(ent, isPlayer) {
    if (!ent.weapon || ent.weapon.type !== "melee") return;
    if (ent.cooldown > 0) return;
    ent.cooldown = ent.weapon.rate;
    ent.swinging = 0.14;
    meleeHit(ent, isPlayer);
  }

  function throwWeapon(ent) {
    const w = ent.weapon;
    if (!w || !w.throw) return;
    const spd = w.throwSpeed || 560;
    const ox = ent.x + Math.cos(ent.angle) * (ent.r + 10);
    const oy = ent.y + Math.sin(ent.angle) * (ent.r + 10);
    thrown.push({
      x: ox,
      y: oy,
      vx: Math.cos(ent.angle) * spd,
      vy: Math.sin(ent.angle) * spd,
      angle: ent.angle,
      spin: rand(10, 18) * (Math.random() < 0.5 ? -1 : 1),
      id: w.id,
      ammo: w.ammo,
      color: w.color,
      r: 8,
      life: 1.4,
    });
    ent.weapon = copyWeapon("fists");
    emitNoise(ox, oy, HEAR_THROW * 0.45);
    sfxThrow();
    updateHud();
  }

  function tryPickup() {
    if (!player.alive) return;
    if (player.weapon && player.weapon.id !== "fists") return;
    let best = -1;
    let bestD = 26;
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      const p = pickups[best];
      player.weapon = copyWeapon(p.id, p.ammo);
      pickups.splice(best, 1);
      sfxPickup();
      updateHud();
    }
  }

  /* ---------- senses / AI ---------- */

  function canSee(e, tx, ty) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d > VIEW_RANGE) return false;
    if (angDiff(e.angle, Math.atan2(dy, dx)) > VIEW_FOV * 0.5) return false;
    return hasLOS(e.x, e.y, tx, ty);
  }

  function canSeeCorpse(e, c) {
    if (!c || c.isPlayer) return false;
    const dx = c.x - e.x;
    const dy = c.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > CORPSE_RANGE) return false;
    if (!hasLOS(e.x, e.y, c.x, c.y)) return false;
    if (d < CORPSE_NEAR) return true;
    return angDiff(e.angle, Math.atan2(dy, dx)) < CORPSE_FOV * 0.5;
  }

  function canHear(e, n) {
    const d = Math.hypot(n.x - e.x, n.y - e.y);
    if (d > n.r) return false;
    return hasLOS(e.x, e.y, n.x, n.y);
  }

  function setSearch(e, x, y) {
    if (!e.alive || e.mode === "combat") return;
    e.mode = "search";
    e.alert = true;
    e.lastSeen.x = x;
    e.lastSeen.y = y;
    e.color = mixHex(e.baseColor, "#e09028", 0.45);
    e.searchT = 0.15;
  }

  function setCombat(e, x, y) {
    if (!e.alive) return;
    e.mode = "combat";
    e.alert = true;
    e.lastSeen.x = x;
    e.lastSeen.y = y;
    e.color = mixHex(e.baseColor, "#ff5320", 0.28);
  }

  function updateEnemy(e, dt) {
    if (!e.alive) return;
    e.cooldown = Math.max(0, e.cooldown - dt);
    e.swinging = Math.max(0, e.swinging - dt);

    if (e.stun > 0) {
      e.stun -= dt;
      moveCircle(e, e.knockVx * dt, e.knockVy * dt);
      pushDoors(e, e.knockVx, e.knockVy, false);
      e.knockVx *= Math.pow(0.04, dt);
      e.knockVy *= Math.pow(0.04, dt);
      if (e.stun <= 0) setCombat(e, player ? player.x : e.x, player ? player.y : e.y);
      return;
    }

    if (player.alive) {
      if (canSee(e, player.x, player.y)) setCombat(e, player.x, player.y);
      else {
        for (let i = 0; i < noises.length; i++) {
          if (canHear(e, noises[i])) {
            setCombat(e, noises[i].x, noises[i].y);
            break;
          }
        }
      }
    }

    if (e.mode === "idle") {
      for (let i = 0; i < corpses.length; i++) {
        if (canSeeCorpse(e, corpses[i])) {
          setSearch(e, corpses[i].x, corpses[i].y);
          break;
        }
      }
    }

    if (e.mode === "idle") {
      e.lookT -= dt;
      if (e.lookT <= 0) {
        e.wishAngle = e.angle + rand(-1.1, 1.1);
        e.lookT = rand(1.1, 2.8);
      }
      e.angle = angLerp(e.angle, e.wishAngle, 1 - Math.pow(0.08, dt));
      return;
    }

    if (e.mode === "search") {
      e.searchT -= dt;
      const dx = e.lastSeen.x - e.x;
      const dy = e.lastSeen.y - e.y;
      const d = Math.hypot(dx, dy);
      const desired = Math.atan2(dy, dx);
      e.angle = angLerp(e.angle, desired, 1 - Math.pow(0.012, dt));
      if (d > 24) {
        steerTo(e, e.lastSeen.x, e.lastSeen.y, 138, dt);
      } else if (e.searchT <= 0) {
        e.lastSeen.x = clamp(e.lastSeen.x + rand(-150, 150), 40, MAP_W - 40);
        e.lastSeen.y = clamp(e.lastSeen.y + rand(-150, 150), 40, MAP_H - 40);
        e.searchT = rand(0.7, 1.7);
        e.repath = 0;
      }
      return;
    }

    if (!player.alive) return;

    const sees = canSee(e, player.x, player.y);
    const aimX = sees ? player.x : e.lastSeen.x;
    const aimY = sees ? player.y : e.lastSeen.y;
    const desired = Math.atan2(aimY - e.y, aimX - e.x);
    e.angle = angLerp(e.angle, desired, 1 - Math.pow(0.0008, dt));

    const w = e.weapon;
    if (w.type === "melee") {
      const d = Math.hypot(aimX - e.x, aimY - e.y);
      if (d > 18) steerTo(e, aimX, aimY, e.speed, dt);
      if (player.alive && Math.hypot(player.x - e.x, player.y - e.y) < w.range + 6) {
        swingMelee(e, false);
      }
    } else if (sees && angDiff(e.angle, desired) < 0.22) {
      if (w.auto || e.cooldown <= 0) fireGun(e, false);
    } else if (!sees) {
      steerTo(e, aimX, aimY, e.speed, dt);
    }
  }

  /* ---------- update ---------- */

  function updatePlayer(dt) {
    if (!player.alive) return;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.swinging = Math.max(0, player.swinging - dt);
    player.dodgeT = Math.max(0, player.dodgeT - dt);
    player.dodgeCd = Math.max(0, player.dodgeCd - dt);
    player.sprint = !!(keys.ShiftLeft || keys.ShiftRight);

    let ix = 0;
    let iy = 0;
    if (keys.KeyW || keys.ArrowUp) iy -= 1;
    if (keys.KeyS || keys.ArrowDown) iy += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;

    if (keys.dodge && player.dodgeCd <= 0) {
      keys.dodge = false;
      const dir = ix || iy ? norm(ix, iy) : { x: Math.cos(player.angle), y: Math.sin(player.angle) };
      player.dodgeT = DODGE_TIME;
      player.dodgeCd = DODGE_CD;
      player.dodgeDx = dir.x;
      player.dodgeDy = dir.y;
      sfxDodge();
      emitNoise(player.x, player.y, HEAR_STEP * 1.5);
    }

    if (player.dodgeT > 0) {
      player.vx = player.dodgeDx * DODGE_SPEED;
      player.vy = player.dodgeDy * DODGE_SPEED;
      moveCircle(player, player.vx * dt, player.vy * dt);
      pushDoors(player, player.vx, player.vy, true);
    } else if (ix || iy) {
      const nrm = norm(ix, iy);
      const sp = PLAYER_SPEED * (player.sprint ? SPRINT_MUL : 1);
      player.vx = nrm.x * sp;
      player.vy = nrm.y * sp;
      moveCircle(player, player.vx * dt, player.vy * dt);
      pushDoors(player, player.vx, player.vy, player.sprint);
      player.stepAcc += dt * (player.sprint ? 1.35 : 1);
      if (player.stepAcc > 0.29) {
        player.stepAcc = 0;
        emitNoise(player.x, player.y, HEAR_STEP * (player.sprint ? 1.25 : 1));
      }
    } else {
      player.vx = 0;
      player.vy = 0;
      player.stepAcc = 0;
    }

    const mw = screenToWorld(mouse.x, mouse.y);
    player.angle = Math.atan2(mw.y - player.y, mw.x - player.x);

    const w = player.weapon;
    if (w.type === "gun") {
      if (w.auto) {
        if (mouse.left) fireGun(player, true);
      } else if (mouse.leftClicked) {
        fireGun(player, true);
      }
    } else if (mouse.leftClicked) {
      swingMelee(player, true);
    }

    if (mouse.rightClicked) throwWeapon(player);
    tryPickup();
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;
      if (trails.length > 90) trails.shift();
      trails.push({
        x1: b.x,
        y1: b.y,
        x2: nx,
        y2: ny,
        life: 0.09,
        max: 0.09,
      });
      breakGlassOnSegment(b.x, b.y, nx, ny);
      const stop = firstStop(b.x, b.y, nx, ny);
      if (stop) {
        if (stop.door) {
          crushDoor(
            stop.door,
            b.x + (nx - b.x) * stop.t,
            b.y + (ny - b.y) * stop.t
          );
        }
        bullets.splice(i, 1);
        continue;
      }
      b.px = b.x;
      b.py = b.y;
      b.x = nx;
      b.y = ny;
      if (b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }

      if (b.owner === "player") {
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          if (!e.alive) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            killEnemy(e, b.x - b.vx * dt, b.y - b.vy * dt);
            bullets.splice(i, 1);
            break;
          }
        }
      } else {
        if (player.alive && Math.hypot(player.x - b.x, player.y - b.y) < player.r + b.r) {
          killPlayer(b.x, b.y);
          bullets.splice(i, 1);
          continue;
        }
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          if (!e.alive || e === b.owner) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            killEnemy(e, b.x, b.y);
            bullets.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  function updateThrown(dt) {
    for (let i = thrown.length - 1; i >= 0; i--) {
      const t = thrown[i];
      t.life -= dt;
      t.angle += t.spin * dt;
      const nx = t.x + t.vx * dt;
      const ny = t.y + t.vy * dt;
      breakGlassOnSegment(t.x, t.y, nx, ny);
      const stop = firstStop(t.x, t.y, nx, ny);
      let dead = false;
      if (stop) {
        t.x += t.vx * dt * Math.max(0, stop.t - 0.02);
        t.y += t.vy * dt * Math.max(0, stop.t - 0.02);
        if (stop.door) crushDoor(stop.door, t.x, t.y);
        pickups.push(makePickup(t.x, t.y, t.id, t.ammo));
        emitNoise(t.x, t.y, HEAR_THROW);
        sfxClick();
        dead = true;
      } else {
        t.x = nx;
        t.y = ny;
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          if (!e.alive) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) < e.r + t.r) {
            killEnemy(e, t.x, t.y);
            pickups.push(makePickup(e.x, e.y, t.id, t.ammo));
            dead = true;
            break;
          }
        }
      }
      if (!dead && t.life <= 0) {
        pickups.push(makePickup(t.x, t.y, t.id, t.ammo));
        dead = true;
      }
      if (dead) thrown.splice(i, 1);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (pointInWall(nx, ny, 0)) {
        p.vx = 0;
        p.vy = 0;
        p.life = 0;
      } else {
        p.x = nx;
        p.y = ny;
        p.vx *= Math.pow(0.03, dt);
        p.vy *= Math.pow(0.03, dt);
        p.vy += 18 * dt;
      }
      if (p.life <= 0) {
        if (p.stain) {
          if (stains.length >= STAIN_CAP) stains.shift();
          stains.push({ x: p.x, y: p.y, size: p.size, a: rand(0.4, 0.8), r: p.r });
        }
        particles.splice(i, 1);
      }
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].life -= dt;
      if (flashes[i].life <= 0) flashes.splice(i, 1);
    }
    for (let i = trails.length - 1; i >= 0; i--) {
      trails[i].life -= dt;
      if (trails[i].life <= 0) trails.splice(i, 1);
    }
    for (let i = 0; i < pickups.length; i++) pickups[i].t += dt;
  }

  function updateCamera(dt) {
    if (!player) return;
    const look = 0.2;
    const tx = player.x + (mouse.x - viewW * 0.5) * look;
    const ty = player.y + (mouse.y - viewH * 0.5) * look;
    const k = mode === "play" ? 1 - Math.pow(0.0008, dt) : 1;
    cam.x = lerp(cam.x, tx, k);
    cam.y = lerp(cam.y, ty, k);
    shake.mag *= Math.pow(0.015, dt);
    shake.kx *= Math.pow(0.018, dt);
    shake.ky *= Math.pow(0.018, dt);
    if (shake.mag < 0.12 && Math.abs(shake.kx) < 0.12 && Math.abs(shake.ky) < 0.12) {
      shake.mag = 0;
      shake.kx = 0;
      shake.ky = 0;
      shake.x = 0;
      shake.y = 0;
    } else {
      shake.x = shake.kx + rand(-1, 1) * shake.mag * 0.32;
      shake.y = shake.ky + rand(-1, 1) * shake.mag * 0.32;
    }
  }

  function update(dt) {
    noises.length = 0;
    if (mode === "talk") updateTalk(dt);
    if (mode === "play") {
      updatePlayer(dt);
      for (let i = 0; i < enemies.length; i++) updateEnemy(enemies[i], dt);
      updateDoors(dt);
      updateCombo(dt);
    } else if (mode === "dead" || mode === "won") {
      if (player) {
        player.cooldown = 0;
        player.swinging = Math.max(0, player.swinging - dt);
      }
    }
    updateBullets(dt);
    updateThrown(dt);
    updateParticles(dt);
    updateCamera(dt);
    mouse.leftClicked = false;
    mouse.rightClicked = false;
  }

  /* ---------- render ---------- */

  function drawPerson(ent, isPlayer, dead) {
    ctx.save();
    ctx.translate(ent.x, ent.y);
    const down = !dead && ent.stun > 0;
    ctx.rotate(ent.angle + (down ? Math.PI * 0.5 : 0));
    if (down) ctx.scale(1.05, 0.62);
    ctx.globalAlpha = dead ? 0.72 : down ? 0.9 : 1;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(1, 3, ent.r + 3, ent.r * 0.75, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = dead ? shade(ent.color || ent.jacket || "#444", 0.45) : ent.color || ent.jacket;
    roundRect(-ent.r, -ent.r * 0.78, ent.r * 2, ent.r * 1.56, 6);
    ctx.fill();

    ctx.fillStyle = isPlayer ? "#f3efe6" : "#e6c2a4";
    ctx.beginPath();
    ctx.arc(ent.r * 0.18, 0, ent.r * 0.56, 0, TAU);
    ctx.fill();

    if (isPlayer || ent.dali) {
      ctx.fillStyle = "#1a1210";
      ctx.fillRect(2, -6, 5, 3.4);
      ctx.fillRect(2, 3, 5, 3.4);
      ctx.strokeStyle = "#1a1210";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ent.r * 0.55, -4.2, 3.2, Math.PI * 0.15, Math.PI * 1.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ent.r * 0.55, 4.2, 3.2, -Math.PI * 1.05, -Math.PI * 0.15);
      ctx.stroke();
      ctx.fillStyle = "#e10600";
      ctx.fillRect(-ent.r * 0.2, -ent.r * 0.78, 4, ent.r * 1.56);
    } else {
      ctx.fillStyle = "#1a2430";
      ctx.fillRect(2, -4.5, 4, 2.6);
      ctx.fillRect(2, 2, 4, 2.6);
      ctx.fillStyle = "#d4af37";
      ctx.beginPath();
      ctx.arc(-2, 6, 2.1, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#0d1b2a";
      ctx.fillRect(-ent.r * 0.35, -ent.r * 0.95, ent.r * 1.1, 4);
    }

    if (!dead && !down && ent.weapon) drawHeldWeapon(ent);
    ctx.restore();
  }

  function shade(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) * t;
    const g = ((n >> 8) & 255) * t;
    const b = (n & 255) * t;
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")";
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawHeldWeapon(ent) {
    const w = ent.weapon;
    const swing = ent.swinging > 0 ? -0.8 : 0;
    ctx.save();
    ctx.translate(ent.r * 0.55, 7);
    ctx.rotate(swing);
    if (w.type === "melee") {
      ctx.fillStyle = w.color;
      if (w.id === "bat") {
        ctx.fillRect(0, -2, 28, 4);
        ctx.fillStyle = "#d8c2a0";
        ctx.fillRect(22, -3, 8, 6);
      } else if (w.id === "knife") {
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(0, -1.5, 8, 3);
        ctx.fillStyle = "#dfe6ee";
        ctx.beginPath();
        ctx.moveTo(8, -2.4);
        ctx.lineTo(24, 0);
        ctx.lineTo(8, 2.4);
        ctx.fill();
      } else {
        ctx.fillStyle = "#e8d4c8";
        ctx.fillRect(0, -2, 8, 4);
      }
    } else {
      ctx.fillStyle = w.color;
      const L = w.length || 18;
      ctx.fillRect(0, -2.2, L, 4.4);
      ctx.fillStyle = "#111";
      ctx.fillRect(L - 4, -1.2, 6, 2.4);
    }
    ctx.restore();
  }

  function drawWeaponIcon(x, y, id, angle) {
    const w = WEAPONS[id];
    if (!w) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.fillStyle = w.color;
    if (w.type === "melee") {
      ctx.fillRect(-12, -2, 24, 4);
    } else {
      ctx.fillRect(-11, -2.2, 22, 4.4);
      ctx.fillStyle = "#111";
      ctx.fillRect(6, -1, 6, 2);
    }
    ctx.restore();
  }

  function drawWorld() {
    ctx.save();
    ctx.translate(viewW * 0.5 - cam.x + shake.x, viewH * 0.5 - cam.y + shake.y);

    ctx.fillStyle = "#0c090e";
    ctx.fillRect(-200, -200, MAP_W + 400, MAP_H + 400);

    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, MAP_W, MAP_H);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= MAP_W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MAP_H);
      ctx.stroke();
    }
    for (let y = 0; y <= MAP_H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_W, y);
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < stains.length; i++) {
      const s = stains[i];
      ctx.fillStyle = s.r;
      ctx.globalAlpha = s.a;
      ctx.fillRect(s.x | 0, s.y | 0, s.size | 0 || 1, s.size | 0 || 1);
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < corpses.length; i++) drawPerson(corpses[i], !!corpses[i].dali, true);

    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      const bob = Math.sin(p.t * 5) * 1.5;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 6, 8, 3, 0, 0, TAU);
      ctx.fill();
      drawWeaponIcon(p.x, p.y + bob, p.id, p.t * 0.2);
    }

    for (let i = 0; i < windows.length; i++) {
      const g = windows[i];
      ctx.fillStyle = "#1a1418";
      ctx.fillRect(g.x - 3, g.y - 3, g.w + 6, g.h + 6);
      if (g.intact) {
        ctx.fillStyle = "rgba(90, 190, 220, 0.28)";
        ctx.fillRect(g.x, g.y, g.w, g.h);
        ctx.strokeStyle = "rgba(180, 240, 255, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (g.w > g.h) {
          ctx.moveTo(g.x + g.w * 0.5, g.y);
          ctx.lineTo(g.x + g.w * 0.5, g.y + g.h);
        } else {
          ctx.moveTo(g.x, g.y + g.h * 0.5);
          ctx.lineTo(g.x + g.w, g.y + g.h * 0.5);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(40, 30, 36, 0.15)";
        ctx.fillRect(g.x, g.y, g.w, g.h);
        ctx.strokeStyle = "rgba(200, 230, 240, 0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g.x + 2, g.y + 2);
        ctx.lineTo(g.x + 8, g.y + g.h * 0.4);
        ctx.moveTo(g.x + g.w - 3, g.y + 1);
        ctx.lineTo(g.x + g.w - 10, g.y + g.h * 0.55);
        ctx.stroke();
      }
    }

    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (w.kind === "prop" || w.kind === "desk" || w.kind === "table" || w.kind === "crate" || w.kind === "shelf" || w.kind === "bar") {
        ctx.fillStyle = w.kind === "crate" ? "#6a4630" : w.kind === "shelf" ? "#3a322c" : "#5a4034";
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(w.x, w.y, w.w, 3);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
      } else {
        ctx.fillStyle = "#1c1814";
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = "#e10600";
        if (w.h <= WT + 2) ctx.fillRect(w.x, w.y, w.w, 3);
        else ctx.fillRect(w.x, w.y, 3, w.h);
        ctx.fillStyle = "rgba(212,175,55,0.28)";
        if (w.h <= WT + 2) ctx.fillRect(w.x, w.y + w.h - 2, w.w, 2);
        else ctx.fillRect(w.x + w.w - 2, w.y, 2, w.h);
      }
    }

    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.crushed) {
        ctx.save();
        ctx.translate(d.hx, d.hy);
        ctx.rotate(d.rest);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(4, -2, 10, 4);
        ctx.fillRect(d.length * 0.4, 3, 14, 3);
        ctx.fillRect(d.length * 0.7, -5, 8, 3);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.translate(d.hx, d.hy);
      ctx.rotate(d.angle);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(2, 3, d.length, d.thick);
      ctx.fillStyle = doorClosed(d) ? "#6a3a22" : "#8a4e2c";
      ctx.fillRect(0, -d.thick * 0.5, d.length, d.thick);
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(0, -d.thick * 0.5, d.length, 2);
      ctx.fillStyle = "#e10600";
      ctx.beginPath();
      ctx.arc(d.length - 10, 0, 2.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (!r.label) continue;
      ctx.fillStyle = "rgba(255,45,106,0.28)";
      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.fillText(r.label, r.x + 10, r.y + 18);
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.fillStyle = p.r;
      ctx.globalAlpha = clamp(p.life * 3, 0.2, 1);
      ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < thrown.length; i++) {
      const t = thrown[i];
      drawWeaponIcon(t.x, t.y, t.id, t.angle);
    }

    for (let i = 0; i < trails.length; i++) {
      const t = trails[i];
      const a = clamp(t.life / t.max, 0, 1) * 0.42;
      ctx.strokeStyle = "rgba(255, 228, 140," + a + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const ang = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.strokeStyle = "rgba(255, 240, 170, 0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(ang) * 16, b.y - Math.sin(ang) * 16);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.fillStyle = "#ffe566";
      ctx.fillRect(-6, -1.2, 10, 2.4);
      ctx.fillStyle = "#fff";
      ctx.fillRect(2, -0.8, 4, 1.6);
      ctx.restore();
    }

    for (let i = 0; i < flashes.length; i++) {
      const f = flashes[i];
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.fillStyle = "rgba(255,230,120,0.85)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(18, -8);
      ctx.lineTo(26, 0);
      ctx.lineTo(18, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) drawPerson(enemies[i], false, false);
    }
    if (player && player.alive) drawPerson(player, true, false);

    ctx.restore();
  }

  function drawLighting() {
    if (!player) return;
    const px = viewW * 0.5 + (player.x - cam.x) + shake.x;
    const py = viewH * 0.5 + (player.y - cam.y) + shake.y;
    const g = ctx.createRadialGradient(px, py, 40, px, py, 520);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.55, "rgba(0,0,0,0.18)");
    g.addColorStop(1, "rgba(4,0,6,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);

    if (mode === "dead") {
      ctx.fillStyle = "rgba(90,0,16,0.18)";
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  function drawCrosshair() {
    const x = mouse.x;
    const y = mouse.y;
    ctx.save();
    ctx.strokeStyle = "#e10600";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 3, y);
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y - 3);
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    drawWorld();
    drawLighting();
    if (talk.active) drawTalkPortrait();
    if (mode === "play") drawCrosshair();
  }

  /* ---------- dialogue ---------- */

  const SCRIPT_INTRO = [
    { who: "THE PROFESSOR", text: "Four minutes. The mint still thinks tonight is ordinary.", side: "left" },
    { who: "RED", text: "Masks on. No names. If they see the face, they see Dalí.", side: "right" },
    { who: "THE PROFESSOR", text: "The police will be slow. You will not. Take the lobby. Then the vault.", side: "left" },
  ];
  const SCRIPT_VAULT = [
    { who: "THE PROFESSOR", text: "The floor went quiet. Too quiet.", side: "left" },
    { who: "???", text: "You left something in the dark under the gold.", side: "left" },
    { who: "THE PROFESSOR", text: "Do not answer that voice. Finish the job. The vault is waiting.", side: "left" },
  ];
  const SCRIPT_END = [
    { who: "RED", text: "The city will print money again tomorrow.", side: "right" },
    { who: "THE PROFESSOR", text: "And they will remember the red.", side: "left" },
  ];

  function currentTalkLine() {
    return talk.lines[talk.i] || null;
  }

  function refreshTalkUi() {
    const line = currentTalkLine();
    if (!talkEl || !line) return;
    talkWho.textContent = line.who;
    talkLine.textContent = line.text.slice(0, talk.typed | 0);
  }

  function playTalk(lines, onDone, dread) {
    talk.active = true;
    talk.lines = lines.slice();
    talk.i = 0;
    talk.typed = 0;
    talk.acc = 0;
    talk.bob = 0;
    talk.mouth = 0;
    talk.dread = !!dread;
    talk.onDone = onDone || null;
    mode = "talk";
    if (talkEl) {
      talkEl.className = dread ? "dread" : "";
    }
    if (dread) startDreadSting();
    else stopDreadSting();
    refreshTalkUi();
    if (overlay) overlay.className = "";
    if (hud) hud.style.display = "none";
  }

  function endTalk() {
    talk.active = false;
    if (talkEl) talkEl.className = "off";
    const cb = talk.onDone;
    talk.onDone = null;
    stopDreadSting();
    if (cb) cb();
  }

  function advanceTalk() {
    if (!talk.active) return;
    const line = currentTalkLine();
    if (!line) {
      endTalk();
      return;
    }
    if (talk.typed < line.text.length) {
      talk.typed = line.text.length;
      refreshTalkUi();
      return;
    }
    talk.i += 1;
    if (talk.i >= talk.lines.length) {
      endTalk();
      return;
    }
    talk.typed = 0;
    talk.acc = 0;
    refreshTalkUi();
  }

  function updateTalk(dt) {
    if (!talk.active) return;
    const line = currentTalkLine();
    if (!line) return;
    talk.bob += dt;
    talk.mouth += dt * 14;
    if (talk.typed < line.text.length) {
      talk.acc += dt * 38;
      const n = talk.acc | 0;
      if (n > 0) {
        talk.typed = Math.min(line.text.length, talk.typed + n);
        talk.acc -= n;
        refreshTalkUi();
      }
    }
  }

  function drawTalkPortrait() {
    const line = currentTalkLine();
    if (!line) return;
    const left = line.side !== "right";
    const px = left ? 130 : viewW - 130;
    const py = viewH * 0.58 + Math.sin(talk.bob * 2.4) * 6;
    const talking = currentTalkLine() && talk.typed < currentTalkLine().text.length;
    const mouth = talking ? 3 + Math.abs(Math.sin(talk.mouth)) * 5 : 2;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(left ? 1 : -1, 1);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(8, 78, 52, 14, 0, 0, TAU);
    ctx.fill();
    if (line.who === "RED") {
      ctx.fillStyle = "#e10600";
      roundRect(-42, -20, 84, 96, 12);
      ctx.fill();
      ctx.fillStyle = "#f4efe4";
      ctx.beginPath();
      ctx.arc(0, -38, 34, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#1a1210";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(10, -44, 9, 0.2, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(10, -32, 9, -Math.PI, -0.2);
      ctx.stroke();
      ctx.fillStyle = "#1a1210";
      ctx.fillRect(-6, -50, 7, 6);
      ctx.fillRect(-6, -32, 7, 6);
      ctx.fillStyle = "#1a1210";
      ctx.fillRect(-4, -38 + mouth, 14, 3);
    } else if (line.who === "???") {
      ctx.fillStyle = "#12080c";
      roundRect(-40, -18, 80, 94, 10);
      ctx.fill();
      ctx.fillStyle = "#2a1016";
      ctx.beginPath();
      ctx.arc(0, -36, 32, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#e10600";
      ctx.globalAlpha = 0.35 + Math.abs(Math.sin(talk.bob * 1.6)) * 0.35;
      ctx.beginPath();
      ctx.arc(-8, -40, 5, 0, TAU);
      ctx.arc(10, -40, 5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "#141018";
      roundRect(-42, -16, 84, 98, 10);
      ctx.fill();
      ctx.fillStyle = "#e6c2a4";
      ctx.beginPath();
      ctx.arc(0, -38, 32, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-10, -42, 8, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(10, -42, 8, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2, -42);
      ctx.lineTo(2, -42);
      ctx.stroke();
      ctx.fillStyle = "#1a1210";
      ctx.fillRect(-6, -28, 12, mouth);
    }
    ctx.restore();
  }

  /* ---------- hud / overlay ---------- */

  function updateHud() {
    if (!player) return;
    const w = player.weapon;
    hudWeapon.textContent = w.name;
    if (w.type === "gun") hudAmmo.textContent = w.ammo + " / " + WEAPONS[w.id].ammo;
    else hudAmmo.textContent = w.id === "fists" ? "UNARMED" : "MELEE";
    const floor = levels ? levels.name : "";
    hudKills.textContent = (floor ? floor + "  ·  " : "") + kills + (kills === 1 ? " KILL" : " KILLS");
    if (audio.currentLabel) hudTrack.textContent = audio.currentLabel;
  }

  function hideOverlay() {
    overlay.className = "";
    overlay.innerHTML = "";
    hud.style.display = "flex";
  }

  function showDead() {
    hud.style.display = "flex";
    overlay.className = "show dead";
    overlay.innerHTML =
      '<div class="overlay-inner"><p class="eyebrow">COLD COLUMN</p><h1>YOU\'RE<br/>DEAD</h1><p class="prompt">PRESS SPACE</p></div>';
  }

  function showWon() {
    overlay.className = "show won";
    const more = levels && !levels.last;
    overlay.innerHTML =
      '<div class="overlay-inner"><p class="eyebrow">' +
      (levels ? levels.name : "JOB") +
      '</p><h1>CLEAR</h1><p class="tagline">' +
      kills +
      (more ? " DOWN — THE VAULT IS OPEN" : " BODIES — ISTANBUL SLEEPS") +
      '</p><p class="prompt">PRESS SPACE</p></div>';
  }

  function winGame() {
    if (mode !== "play") return;
    mode = "won";
    showWon();
  }

  function continueAfterClear() {
    if (levels && !levels.last) {
      playTalk(SCRIPT_VAULT, () => {
        levels.advance();
        resetRun();
      }, true);
    } else {
      playTalk(SCRIPT_END, () => showMenu(), true);
    }
  }

  function showMenu() {
    mode = "menu";
    started = false;
    talk.active = false;
    if (talkEl) talkEl.className = "off";
    stopDreadSting();
    if (!levels) levels = new LevelManager();
    levels.apply(0);
    player = makePlayer();
    enemies = enemyTemplate.map(makeEnemy);
    pickups = pickupTemplate.map((p) => makePickup(p.x, p.y, p.id));
    bullets.length = 0;
    thrown.length = 0;
    particles.length = 0;
    stains.length = 0;
    corpses.length = 0;
    flashes.length = 0;
    trails.length = 0;
    cam.x = player.x;
    cam.y = player.y;
    hud.style.display = "none";
    overlay.className = "show menu";
    overlay.innerHTML = MENU_HTML;
    const btn = document.getElementById("start-btn");
    if (btn) btn.addEventListener("click", startGame);
  }

  /* ---------- loop / input ---------- */

  function frame(now) {
    if (!lastTime) lastTime = now;
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function bindInput() {
    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (e.code === "Space") {
        e.preventDefault();
        if (mode === "talk") advanceTalk();
        else if (mode === "dead") resetRun();
        else if (mode === "won") continueAfterClear();
        else if (mode === "menu") startGame();
      }
      if ((e.code === "KeyC" || e.code === "ControlLeft" || e.code === "ControlRight") && !e.repeat) {
        keys.dodge = true;
      }
      if (e.code === "KeyM" && !e.repeat) {
        audio.musicOn = !audio.musicOn;
        setMusicEnabled(audio.musicOn);
        if (hudTrack) {
          hudTrack.textContent = audio.musicOn
            ? audio.currentLabel
            : "MUSIC OFF";
        }
      }
    });
    window.addEventListener("keyup", (e) => {
      keys[e.code] = false;
    });
    window.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    window.addEventListener("mousedown", (e) => {
      if (mode === "menu") return;
      if (mode === "talk") {
        if (e.button === 0) advanceTalk();
        return;
      }
      if (e.button === 0) {
        mouse.left = true;
        mouse.leftClicked = true;
      }
      if (e.button === 2) {
        mouse.right = true;
        mouse.rightClicked = true;
        e.preventDefault();
      }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) mouse.left = false;
      if (e.button === 2) mouse.right = false;
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", () => {
      mouse.left = false;
      mouse.right = false;
      for (const k in keys) keys[k] = false;
    });
    canvas.addEventListener("mouseleave", () => {
      mouse.left = false;
      mouse.right = false;
    });
  }

  function startGame() {
    if (mode !== "menu") return;
    started = true;
    resumeAudio();
    startMusic();
    if (!levels) levels = new LevelManager();
    levels.apply(0);
    player = makePlayer();
    enemies = enemyTemplate.map(makeEnemy);
    pickups = pickupTemplate.map((p) => makePickup(p.x, p.y, p.id));
    cam.x = player.x;
    cam.y = player.y;
    canvas.focus();
    playTalk(SCRIPT_INTRO, () => resetRun(), false);
  }

  function boot() {
    resize();
    window.addEventListener("resize", resize);
    bindInput();
    levels = new LevelManager();
    showMenu();
    updateHud();
    updateComboHud();

    requestAnimationFrame(frame);
  }

  boot();
})();
