const Ent = {
  list: [],
  byId: new Map(),
  projectiles: [],
  floats: [],
  particles: [],

  reset() {
    this.list = [];
    this.byId.clear();
    this.projectiles = [];
    this.floats = [];
    this.particles = [];
  },

  add(e) {
    e.id = U.uid();
    this.list.push(e);
    this.byId.set(e.id, e);
    return e;
  },

  remove(e) {
    e.dead = true;
    this.byId.delete(e.id);
  },

  resource(kind, tx, ty, x, y) {
    const spec = CFG.resources[kind];
    return this.add({
      kind: "resource",
      type: kind,
      owner: -1,
      tx,
      ty,
      x,
      y,
      r: kind === "wood" ? 16 : 14,
      amount: spec.nodeHp,
      max: spec.nodeHp,
      job: null,
    });
  },

  unit(type, owner, x, y) {
    const def = UNIT[type];
    return this.add({
      kind: "unit",
      type,
      owner,
      x,
      y,
      r: def.radius,
      hp: def.hp,
      maxHp: def.hp,
      facing: U.rand(0, Math.PI * 2),
      state: "idle",
      path: [],
      pathI: 0,
      target: null,
      dest: null,
      attackCd: 0,
      gatherT: 0,
      carryType: null,
      carryAmount: 0,
      taskRes: null,
      homeNode: null,
      buildSite: null,
      aggro: def.aggro != null ? def.aggro : def.role === "military" ? 160 : 70,
      job: def.job,
      voice: def.voice,
      stuck: 0,
      lastX: x,
      lastY: y,
    });
  },

  building(type, owner, tx, ty, instant) {
    const def = BLD[type];
    const x = tx * CFG.tile;
    const y = ty * CFG.tile;
    const b = this.add({
      kind: "building",
      type,
      owner,
      tx,
      ty,
      x,
      y,
      w: def.size * CFG.tile,
      h: def.size * CFG.tile,
      r: def.size * CFG.tile * 0.45,
      hp: instant ? def.hp : 1,
      maxHp: def.hp,
      built: !!instant,
      construct: instant ? 1 : 0.01,
      queue: [],
      prodT: 0,
      prodNeed: 0,
      rally: {
        x: x + def.size * CFG.tile + 16,
        y: y + def.size * CFG.tile * 0.5,
      },
      attackCd: 0,
      job: null,
      amount: type === "farm" ? 0 : 0,
      max: type === "farm" ? CFG.farm.stock : 0,
    });
    if (type === "farm" && instant) this.seedFarm(b);
    World.occupy(tx, ty, def.size, true);
    return b;
  },

  cx(e) {
    if (e.kind === "building") return e.x + e.w * 0.5;
    return e.x;
  },
  cy(e) {
    if (e.kind === "building") return e.y + e.h * 0.65;
    return e.y;
  },

  popOf(owner) {
    let used = 0;
    let cap = 0;
    for (const e of this.list) {
      if (e.dead || e.owner !== owner) continue;
      if (e.kind === "unit") used++;
      if (e.kind === "building" && e.built) {
        const def = BLD[e.type];
        if (def.pop) cap += def.pop;
      }
    }
    return { used, cap };
  },

  acceptsDrop(b, resType) {
    if (!b || b.dead || b.kind !== "building" || !b.built) return false;
    const def = BLD[b.type];
    if (!def.dropOff) return false;
    if (!def.drops) return true;
    return !resType || def.drops.indexOf(resType) !== -1;
  },

  dropOffs(owner, resType) {
    return this.list.filter((e) => !e.dead && e.owner === owner && this.acceptsDrop(e, resType));
  },

  nearest(list, x, y, pred) {
    let best = null;
    let bd = 1e15;
    for (const e of list) {
      if (e.dead) continue;
      if (pred && !pred(e)) continue;
      const d = U.dist2(x, y, this.cx(e), this.cy(e));
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  },

  atPoint(x, y, ownerFog) {
    let hit = null;
    let best = 1e9;
    for (const e of this.list) {
      if (e.dead) continue;
      if (ownerFog !== undefined && e.owner !== 0 && !World.visible(0, this.cx(e), this.cy(e))) continue;
      let d;
      if (e.kind === "building") {
        if (!U.pointInRect(x, y, e.x, e.y, e.w, e.h)) continue;
        d = U.dist2(x, y, this.cx(e), this.cy(e)) * 0.5;
      } else {
        d = U.dist2(x, y, e.x, e.y);
        const rad = e.r + 6;
        if (d > rad * rad) continue;
      }
      if (d < best) {
        best = d;
        hit = e;
      }
    }
    return hit;
  },

  inBox(x0, y0, x1, y1, pred) {
    const ax = Math.min(x0, x1);
    const ay = Math.min(y0, y1);
    const bx = Math.max(x0, x1);
    const by = Math.max(y0, y1);
    const out = [];
    for (const e of this.list) {
      if (e.dead) continue;
      if (pred && !pred(e)) continue;
      const x = this.cx(e);
      const y = this.cy(e);
      if (x >= ax && x <= bx && y >= ay && y <= by) out.push(e);
    }
    return out;
  },

  standBeside(fromX, fromY, x, y, w, h, gap) {
    gap = gap == null ? 6 : gap;
    const midX = x + w * 0.5;
    const midY = y + h * 0.5;
    const cands = [
      { x: midX, y: y - gap },
      { x: midX, y: y + h + gap },
      { x: x - gap, y: midY },
      { x: x + w + gap, y: midY },
    ];
    let best = null;
    let bestD = 1e15;
    for (const c of cands) {
      if (!World.walkableWorld(c.x, c.y)) continue;
      const d = U.dist2(fromX, fromY, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return best;
    return World.nearestWalkableWorld(fromX, fromY);
  },

  rectClearance(px, py, x, y, w, h) {
    const qx = U.clamp(px, x, x + w);
    const qy = U.clamp(py, y, y + h);
    return U.dist(px, py, qx, qy);
  },

  attackReach(u, target, def) {
    if (!target) return 1e9;
    if (target.kind === "building") return this.rectClearance(u.x, u.y, target.x, target.y, target.w, target.h);
    return U.dist(u.x, u.y, this.cx(target), this.cy(target)) - (target.r || 10);
  },

  approachPoint(e, target, extra) {
    extra = extra || 0;
    if (target.kind === "building") {
      const stand = this.standBeside(e.x, e.y, target.x, target.y, target.w, target.h, 6 + extra);
      return { x: stand.x, y: stand.y, close: this.rectClearance(e.x, e.y, target.x, target.y, target.w, target.h) <= 10 + extra };
    }
    if (target.kind === "resource") {
      const stand = this.standBeside(
        e.x,
        e.y,
        target.tx * CFG.tile,
        target.ty * CFG.tile,
        CFG.tile,
        CFG.tile,
        6 + extra
      );
      return { x: stand.x, y: stand.y, close: this.inReach(e, target) };
    }
    const d = U.dist(e.x, e.y, target.x, target.y);
    const need = (target.r || 12) + e.r + extra;
    return { x: target.x, y: target.y, close: d <= need + 2, d, need };
  },

  inReach(u, target) {
    if (!target) return false;
    if (target.kind === "resource") {
      const x0 = target.tx * CFG.tile;
      const y0 = target.ty * CFG.tile;
      const cx = U.clamp(u.x, x0, x0 + CFG.tile);
      const cy = U.clamp(u.y, y0, y0 + CFG.tile);
      return U.dist(u.x, u.y, cx, cy) <= 12;
    }
    if (target.kind === "building") {
      const pad = 12;
      return U.pointInRect(u.x, u.y, target.x - pad, target.y - pad, target.w + pad * 2, target.h + pad * 2);
    }
    return U.dist(u.x, u.y, target.x, target.y) <= (target.r || 12) + u.r + 8;
  },

  adjacent(a, b) {
    const ta = U.tileAt(a.x, a.y);
    const bx = this.cx(b);
    const by = this.cy(b);
    const tb = U.tileAt(bx, by);
    if (b.kind === "building") {
      const s = BLD[b.type].size;
      const dx = U.clamp(ta.tx, b.tx - 1, b.tx + s);
      const dy = U.clamp(ta.ty, b.ty - 1, b.ty + s);
      return Math.abs(ta.tx - dx) + Math.abs(ta.ty - dy) <= 1 ||
        (ta.tx >= b.tx - 1 && ta.tx <= b.tx + s && ta.ty >= b.ty - 1 && ta.ty <= b.ty + s);
    }
    return Math.max(Math.abs(ta.tx - tb.tx), Math.abs(ta.ty - tb.ty)) <= 1;
  },

  setPath(e, x, y) {
    if (!World.walkableWorld(e.x, e.y)) this.unstuck(e);
    e.path = Path.worldPath(World.block, e.x, e.y, x, y);
    e.pathI = 0;
    e.dest = { x, y };
    e.repathT = 0.4;
  },

  maybeRepath(e, x, y) {
    if (e.repathT > 0 && e.path && e.pathI < e.path.length) return;
    this.setPath(e, x, y);
  },

  freeSlot(x, y, used) {
    for (let r = 0; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (r && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const px = x + dx * 18;
          const py = y + dy * 18;
          if (!World.walkableWorld(px, py)) continue;
          const key = ((px / 18) | 0) + ":" + ((py / 18) | 0);
          if (used.has(key)) continue;
          used.add(key);
          return { x: px, y: py };
        }
      }
    }
    return { x, y };
  },

  formationPoints(units, x, y) {
    const n = units.length;
    if (n === 1) return [{ u: units[0], x, y }];
    let cx = 0;
    let cy = 0;
    for (const u of units) {
      cx += u.x;
      cy += u.y;
    }
    cx /= n;
    cy /= n;
    const dist = U.dist(cx, cy, x, y);
    const ang = dist < 8 ? 0 : Math.atan2(y - cy, x - cx);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const space = 36;
    const cols = Math.max(1, Math.round(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    const slots = [];
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      const lx = (col - (cols - 1) / 2) * space;
      const ly = (row - (rows - 1) / 2) * space;
      slots.push({
        x: x + -sa * lx - ca * ly,
        y: y + ca * lx - sa * ly,
      });
    }
    const rx = -sa;
    const ry = ca;
    const ordered = units.slice().sort((a, b) => a.x * rx + a.y * ry - (b.x * rx + b.y * ry));
    const used = new Set();
    return ordered.map((u, i) => {
      const p = this.freeSlot(slots[i].x, slots[i].y, used);
      return { u, x: p.x, y: p.y };
    });
  },

  issueMove(units, x, y) {
    if (!units.length) return;
    const minSp = Math.min.apply(
      null,
      units.map((u) => UNIT[u.type].speed)
    );
    for (const p of this.formationPoints(units, x, y)) {
      const u = p.u;
      u.state = "move";
      u.target = null;
      u.buildSite = null;
      u.homeNode = null;
      u.formDest = { x: p.x, y: p.y };
      u.marchSpeed = units.length > 1 ? minSp : 0;
      this.setPath(u, p.x, p.y);
    }
  },

  gatherType(node) {
    if (!node) return null;
    if (node.kind === "resource") return node.type;
    if (node.type === "farm") return "food";
    return null;
  },

  farmStock(owner) {
    const age = Game.players[owner] ? Game.players[owner].age : 1;
    return age >= 2 ? CFG.farm.stockAge2 : CFG.farm.stock;
  },

  farmYield(owner) {
    const age = Game.players[owner] ? Game.players[owner].age : 1;
    return age >= 2 ? CFG.farm.yieldAge2 : 1;
  },

  seedFarm(b) {
    const stock = this.farmStock(b.owner);
    b.amount = stock;
    b.max = stock;
  },

  reseedFarm(b, owner) {
    if (!b || b.dead || b.type !== "farm" || !b.built) return false;
    if (b.amount > 0) return false;
    if (!U.pay(Game.players[owner].res, CFG.farm.replant)) {
      if (owner === 0) UI.toast("Need wood to replant");
      return false;
    }
    this.seedFarm(b);
    if (owner === 0) {
      SFX.place();
      UI.toast("Farm replanted");
    }
    return true;
  },

  hasFood(node) {
    if (!node || node.dead) return false;
    if (node.kind === "resource") return node.type === "food" && node.amount > 0;
    return node.type === "farm" && node.built && node.amount > 0;
  },

  issueGather(units, node) {
    const res = this.gatherType(node);
    if (!res) return;
    for (const u of units) {
      if (u.type !== "worker") continue;
      u.state = "gather";
      u.target = node;
      u.homeNode = node;
      u.taskRes = res;
      u.buildSite = null;
      const ap = this.approachPoint(u, node, 0);
      this.setPath(u, ap.x, ap.y);
    }
  },

  issueAttack(units, target) {
    const fighters = units.filter((u) => UNIT[u.type].role !== "support");
    if (!fighters.length) return;
    const ax = this.cx(target);
    const ay = this.cy(target);
    const formed = this.formationPoints(fighters, ax, ay);
    for (const p of formed) {
      const u = p.u;
      u.state = "attack";
      u.target = target;
      u.buildSite = null;
      u.formDest = { x: p.x, y: p.y };
      const ap = this.approachPoint(u, target, UNIT[u.type].range * 0.15);
      const dest = fighters.length > 1 ? p : ap;
      this.setPath(u, dest.x, dest.y);
    }
  },

  issueHeal(units, target) {
    for (const u of units) {
      if (UNIT[u.type].role !== "support") continue;
      u.state = "heal";
      u.target = target;
      u.buildSite = null;
      this.setPath(u, this.cx(target), this.cy(target));
    }
  },

  issueRepair(units, site) {
    this.issueBuild(units, site);
  },

  issueBuild(units, site) {
    for (const u of units) {
      if (u.type !== "worker") continue;
      u.state = "build";
      u.buildSite = site;
      u.target = site;
      const ap = this.approachPoint(u, site, 0);
      this.setPath(u, ap.x, ap.y);
    }
  },

  stop(units) {
    for (const u of units) {
      u.state = "idle";
      u.path = [];
      u.target = null;
      u.buildSite = null;
    }
  },

  float(x, y, text, color) {
    this.floats.push({ x, y, text, color, t: 0, life: 1.1 });
  },

  burst(x, y, color, n) {
    for (let i = 0; i < (n || 6); i++) {
      this.particles.push({
        x,
        y,
        vx: U.rand(-40, 40),
        vy: U.rand(-60, -10),
        t: 0,
        life: U.rand(0.3, 0.7),
        color,
      });
    }
  },

  damage(e, amt, src) {
    if (e.dead) return;
    const armor = (e.kind === "unit" && UNIT[e.type].armor) || 0;
    e.hp -= Math.max(1, amt - armor);
    this.burst(this.cx(e), this.cy(e) - 8, "#c44a4a", 4);
    if (e.kind === "unit" && e.state === "idle" && src && UNIT[e.type].role !== "support") {
      e.state = "attack";
      e.target = src;
    }
    if (e.hp <= 0) this.kill(e);
  },

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    SFX.death();
    this.burst(this.cx(e), this.cy(e), "#6a3030", 12);
    if (e.kind === "building") {
      World.occupy(e.tx, e.ty, BLD[e.type].size, false);
    }
    if (e.kind === "resource") {
      World.setBlocked(e.tx, e.ty, false);
    }
    if (e.kind === "building" && e.type === "hall") {
      Game.onHallDown(e.owner);
    }
  },

  nearestDrop(u) {
    const res = u.carryType || u.taskRes;
    return this.nearest(this.list, u.x, u.y, (e) => e.owner === u.owner && this.acceptsDrop(e, res));
  },

  nearestNode(u, type) {
    return this.nearest(this.list, u.x, u.y, (e) => {
      if (type === "food") {
        if (e.kind === "resource" && e.type === "food" && e.amount > 0) return true;
        return e.kind === "building" && e.type === "farm" && e.owner === u.owner && e.built && e.amount > 0;
      }
      return e.kind === "resource" && e.type === type && e.amount > 0;
    });
  },

  unstuck(u) {
    const dest = u.dest || (u.target ? { x: this.cx(u.target), y: this.cy(u.target) } : null);
    if (!World.walkableWorld(u.x, u.y)) {
      const safe = World.nearestWalkableWorld(u.x, u.y);
      u.x = safe.x;
      u.y = safe.y;
      return true;
    }
    const step = CFG.tile * 0.55;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    let best = null;
    let bestScore = -1e9;
    for (let i = 0; i < dirs.length; i++) {
      const nx = u.x + dirs[i][0] * step;
      const ny = u.y + dirs[i][1] * step;
      if (!World.walkableWorld(nx, ny)) continue;
      let score = 0;
      if (dest) score = U.dist(u.x, u.y, dest.x, dest.y) - U.dist(nx, ny, dest.x, dest.y);
      if (score > bestScore) {
        bestScore = score;
        best = { x: nx, y: ny };
      }
    }
    if (best && bestScore > 0.5) {
      u.x = best.x;
      u.y = best.y;
      return true;
    }
    return false;
  },

  followPath(u, dt, speed) {
    if (!World.walkableWorld(u.x, u.y)) {
      const safe = World.nearestWalkableWorld(u.x, u.y);
      const d = U.dist(u.x, u.y, safe.x, safe.y) || 1;
      const k = Math.min(1, (speed * dt) / d);
      u.x += (safe.x - u.x) * k;
      u.y += (safe.y - u.y) * k;
      u.facing = U.ang(u.x, u.y, safe.x, safe.y);
      return false;
    }
    if (!u.path || u.pathI >= u.path.length) return true;
    const p = u.path[u.pathI];
    const d = U.dist(u.x, u.y, p.x, p.y);
    if (d < 5) {
      u.pathI++;
      return u.pathI >= u.path.length;
    }
    const step = (u.marchSpeed || speed) * dt;
    const k = Math.min(1, step / d);
    const nx = u.x + (p.x - u.x) * k;
    const ny = u.y + (p.y - u.y) * k;
    const canX = World.walkableWorld(nx, u.y);
    const canY = World.walkableWorld(u.x, ny);
    if (canX) u.x = nx;
    if (canY) u.y = ny;
    if (!canX && !canY) {
      this.unstuck(u);
      if (u.pathI < u.path.length) u.pathI++;
    }
    u.facing = U.ang(u.x, u.y, p.x, p.y);
    return false;
  },

  separate(u, dt) {
    let ox = 0;
    let oy = 0;
    const parked = u.formDest && u.state === "idle" && U.dist(u.x, u.y, u.formDest.x, u.formDest.y) < 10;
    for (const o of this.list) {
      if (o.dead || o.kind !== "unit" || o === u) continue;
      const d2 = U.dist2(u.x, u.y, o.x, o.y);
      const min = u.r + o.r + 6;
      if (d2 > 0 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) / min;
        ox += ((u.x - o.x) / d) * push;
        oy += ((u.y - o.y) / d) * push;
      }
    }
    if (!ox && !oy) return;
    if (parked) {
      ox *= 0.25;
      oy *= 0.25;
    }
    const nx = u.x + ox * dt * 90;
    const ny = u.y + oy * dt * 90;
    if (World.walkableWorld(nx, u.y)) u.x = nx;
    if (World.walkableWorld(u.x, ny)) u.y = ny;
  },

  updateUnit(u, dt) {
    const def = UNIT[u.type];
    u.attackCd = Math.max(0, u.attackCd - dt);
    if (u.repathT > 0) u.repathT -= dt;

    if (u.target && u.target.dead) {
      u.target = null;
      if (u.state === "attack") u.state = "idle";
      if (u.state === "gather" && u.taskRes) {
        const n = this.nearestNode(u, u.taskRes);
        if (n) {
          u.target = n;
          u.homeNode = n;
        } else u.state = "idle";
      }
      if (u.state === "build" || u.state === "heal") u.state = "idle";
    }

    if (u.state === "move") {
      if (this.followPath(u, dt, def.speed)) {
        if (u.formDest && U.dist(u.x, u.y, u.formDest.x, u.formDest.y) > 12) {
          this.setPath(u, u.formDest.x, u.formDest.y);
        } else {
          if (u.formDest && World.walkableWorld(u.formDest.x, u.formDest.y)) {
            u.x = u.formDest.x;
            u.y = u.formDest.y;
          }
          u.state = "idle";
          u.marchSpeed = 0;
        }
      }
    } else if (u.state === "gather") {
      this.tickGather(u, dt, def);
    } else if (u.state === "return") {
      this.tickReturn(u, dt, def);
    } else if (u.state === "build") {
      this.tickBuild(u, dt, def);
    } else if (u.state === "heal") {
      this.tickHeal(u, dt, def);
    } else if (u.state === "attack") {
      this.tickAttack(u, dt, def);
    } else if (def.role === "support") {
      this.tickHeal(u, dt, def);
    } else if (def.role === "military") {
      const foe = this.scanFoe(u, u.aggro);
      if (foe) {
        u.state = "attack";
        u.target = foe;
      }
    }

    this.separate(u, dt);
    if (U.dist2(u.x, u.y, u.lastX, u.lastY) < 4 * dt) u.stuck += dt;
    else u.stuck = 0;
    u.lastX = u.x;
    u.lastY = u.y;
    if (u.stuck > 0.55) {
      this.unstuck(u);
      if (u.dest) this.setPath(u, u.dest.x, u.dest.y);
      u.stuck = 0;
    }
  },

  tickGather(u, dt, def) {
    let node = u.target;
    if (!node || node.dead || node.amount <= 0) {
      const n = u.taskRes ? this.nearestNode(u, u.taskRes) : null;
      if (n) {
        u.target = n;
        u.homeNode = n;
        node = n;
      } else {
        u.state = "idle";
        return;
      }
    }
    if (u.carryAmount >= def.carry) {
      u.state = "return";
      const drop = this.nearestDrop(u);
      if (drop) {
        u.target = drop;
        const ap = this.approachPoint(u, drop, 0);
        this.setPath(u, ap.x, ap.y);
      }
      return;
    }
    if (!this.inReach(u, node)) {
      const ap = this.approachPoint(u, node, 0);
      if (!u.path.length || u.pathI >= u.path.length) this.maybeRepath(u, ap.x, ap.y);
      this.followPath(u, dt, def.speed);
      return;
    }
    u.facing = U.ang(u.x, u.y, this.cx(node), this.cy(node));
    u.gatherT += dt;
    if (u.gatherT >= def.gatherInterval) {
      u.gatherT = 0;
      const res = this.gatherType(node);
      const take = node.type === "farm" ? this.farmYield(u.owner) : def.gather[res] || 1;
      const got = Math.min(take, node.amount, def.carry - u.carryAmount);
      node.amount -= got;
      u.carryAmount += got;
      u.carryType = res;
      this.burst(this.cx(node), this.cy(node), CFG.resources[res].color, 3);
      if (u.owner === 0) {
        if (res === "wood") SFX.chop();
        else if (res === "food") SFX.rustle();
        else SFX.mine();
      }
      if (node.amount <= 0 && node.kind === "resource") this.kill(node);
    }
  },

  tickReturn(u, dt, def) {
    let drop = u.target;
    const res = u.carryType || u.taskRes;
    if (!drop || drop.dead || !this.acceptsDrop(drop, res)) drop = this.nearestDrop(u);
    if (!drop) {
      u.state = "idle";
      return;
    }
    u.target = drop;
    if (!World.walkableWorld(u.x, u.y) || u.stuck > 0.28) {
      this.unstuck(u);
      const ap0 = this.approachPoint(u, drop, 0);
      this.setPath(u, ap0.x, ap0.y);
    }
    if (!this.inReach(u, drop)) {
      const ap = this.approachPoint(u, drop, 0);
      if (!u.path.length || u.pathI >= u.path.length || u.stuck > 0.28) this.setPath(u, ap.x, ap.y);
      this.followPath(u, dt, def.speed);
      return;
    }
    if (u.carryAmount > 0 && u.carryType) {
      Game.players[u.owner].res[u.carryType] += u.carryAmount;
      if (u.owner === 0) {
        this.float(u.x, u.y - 16, `+${u.carryAmount} ${u.carryType}`, CFG.resources[u.carryType].color);
        SFX.ui();
      }
      u.carryAmount = 0;
    }
    if (u.homeNode && !u.homeNode.dead && u.homeNode.amount > 0 && (u.homeNode.kind === "resource" || u.homeNode.built)) {
      u.state = "gather";
      u.target = u.homeNode;
      const ap = this.approachPoint(u, u.homeNode, 0);
      this.setPath(u, ap.x, ap.y);
    } else if (u.taskRes) {
      const n = this.nearestNode(u, u.taskRes);
      if (n) {
        u.state = "gather";
        u.target = n;
        u.homeNode = n;
        this.setPath(u, n.x, n.y);
      } else u.state = "idle";
    } else u.state = "idle";
  },

  tickBuild(u, dt, def) {
    const b = u.buildSite;
    if (!b || b.dead) {
      u.state = "idle";
      return;
    }
    const repairing = b.built && b.hp < b.maxHp;
    if (b.built && !repairing) {
      u.state = "idle";
      return;
    }
    if (!this.inReach(u, b)) {
      const ap = this.approachPoint(u, b, 0);
      if (!u.path.length || u.pathI >= u.path.length) this.maybeRepath(u, ap.x, ap.y);
      this.followPath(u, dt, def.speed);
      return;
    }
    u.facing = U.ang(u.x, u.y, this.cx(b), this.cy(b));
    const rate = def.buildRate * dt;
    if (!b.built) b.construct = Math.min(1, b.construct + rate / b.maxHp);
    b.hp = Math.min(b.maxHp, b.hp + rate);
    if (repairing && U.chance(0.08)) this.burst(this.cx(b), this.cy(b) - 8, "#c9b07a", 2);
    if ((!b.built && (b.construct >= 1 || b.hp >= b.maxHp)) || (repairing && b.hp >= b.maxHp)) {
      const wasRepair = repairing;
      b.built = true;
      b.construct = 1;
      b.hp = b.maxHp;
      if (u.owner === 0) {
        SFX.done();
        UI.toast(`${BLD[b.type].name} ${wasRepair ? "repaired" : "completed"}`);
      }
      if (!wasRepair && b.type === "farm") {
        this.seedFarm(b);
        u.state = "gather";
        u.target = b;
        u.homeNode = b;
        u.taskRes = "food";
        u.buildSite = null;
      } else u.state = "idle";
    }
  },

  tickHeal(u, dt, def) {
    let t = u.target;
    if (!t || t.dead || t.owner !== u.owner || t.kind !== "unit" || t.hp >= t.maxHp) {
      t = this.scanHurt(u, 220);
      u.target = t;
    }
    if (!t) {
      if (u.state === "heal") u.state = "idle";
      return;
    }
    u.state = "heal";
    const tx = this.cx(t);
    const ty = this.cy(t);
    const d = U.dist(u.x, u.y, tx, ty);
    if (d > def.range) {
      if (!u.path.length || u.pathI >= u.path.length) this.maybeRepath(u, tx, ty);
      this.followPath(u, dt, def.speed);
      return;
    }
    u.path = [];
    u.facing = U.ang(u.x, u.y, tx, ty);
    if (u.attackCd <= 0) {
      u.attackCd = def.cooldown;
      t.hp = Math.min(t.maxHp, t.hp + (def.heal || 6));
      this.burst(tx, ty - 10, "#7ad48a", 5);
      if (u.owner === 0) SFX.ui();
    }
  },

  tickAttack(u, dt, def) {
    const t = u.target;
    if (!t || t.dead) {
      const foe = this.scanFoe(u, u.aggro * 1.2);
      if (foe) u.target = foe;
      else {
        u.state = "idle";
        return;
      }
    }
    const tx = this.cx(u.target);
    const ty = this.cy(u.target);
    const gap = this.attackReach(u, u.target, def);
    const need = def.range;
    if (gap > need) {
      const ap = this.approachPoint(u, u.target, 0);
      if (!def.ranged && gap < 70) {
        const k = Math.min(1, (def.speed * dt) / Math.max(1, gap));
        const nx = u.x + (ap.x - u.x) * k;
        const ny = u.y + (ap.y - u.y) * k;
        if (World.walkableWorld(nx, u.y)) u.x = nx;
        if (World.walkableWorld(u.x, ny)) u.y = ny;
        u.facing = U.ang(u.x, u.y, tx, ty);
      } else {
        if (!u.path.length || u.pathI >= u.path.length || u.stuck > 0.4) this.maybeRepath(u, ap.x, ap.y);
        this.followPath(u, dt, def.speed);
      }
      return;
    }
    u.path = [];
    u.facing = U.ang(u.x, u.y, tx, ty);
    if (u.attackCd <= 0) {
      u.attackCd = def.cooldown;
      if (def.ranged) {
        this.projectiles.push({
          x: u.x,
          y: u.y - 6,
          tx,
          ty,
          target: u.target,
          dmg: def.damage,
          owner: u.owner,
          t: 0,
          splash: def.splash || 0,
          tint: u.type === "mage" ? "#b07cff" : "#f0e0a0",
        });
        if (u.owner === 0 || World.visible(0, u.x, u.y)) SFX.shoot();
      } else {
        this.damage(u.target, def.damage, u);
        if (u.owner === 0 || (u.target.owner === 0 && World.visible(0, tx, ty))) SFX.hit();
      }
    }
  },

  scanFoe(u, range) {
    const r2 = range * range;
    return this.nearest(this.list, u.x, u.y, (e) => {
      if (e.owner === u.owner || e.owner < 0) return false;
      if (e.kind === "resource") return false;
      if (e.kind === "building" && !e.built && e.hp <= 1) return false;
      return U.dist2(u.x, u.y, this.cx(e), this.cy(e)) <= r2;
    });
  },

  scanHurt(u, range) {
    const r2 = range * range;
    return this.nearest(this.list, u.x, u.y, (e) => {
      if (e.dead || e.kind !== "unit" || e.owner !== u.owner || e === u) return false;
      if (e.hp >= e.maxHp) return false;
      return U.dist2(u.x, u.y, e.x, e.y) <= r2;
    });
  },

  updateBuilding(b, dt) {
    if (!b.built) return;
    const def = BLD[b.type];
    if (b.queue.length) {
      if (b.prodNeed <= 0) {
        const item = b.queue[0];
        b.prodNeed = item === "age" ? CFG.ageUp.time : UNIT[item].time;
        b.prodT = 0;
      }
      b.prodT += dt;
      if (b.prodT >= b.prodNeed) {
        const item = b.queue.shift();
        b.prodT = 0;
        b.prodNeed = 0;
        if (item === "age") Game.finishAge(b.owner);
        else this.finishTrain(b, item);
      }
    }
    if (def.range && b.built) {
      const age = Game.players[b.owner] ? Game.players[b.owner].age : 1;
      const range = def.range + (age >= 2 ? 45 : 0);
      const dmg = def.damage + (age >= 2 ? 5 : 0);
      const cd = age >= 2 ? def.cooldown * 0.85 : def.cooldown;
      b.attackCd = Math.max(0, b.attackCd - dt);
      if (b.attackCd <= 0) {
        const foe = this.nearest(this.list, this.cx(b), this.cy(b), (e) => {
          if (e.dead || e.owner === b.owner || e.owner < 0) return false;
          if (e.kind === "resource") return false;
          return U.dist(this.cx(b), this.cy(b), this.cx(e), this.cy(e)) <= range;
        });
        if (foe) {
          b.attackCd = cd;
          this.projectiles.push({
            x: this.cx(b),
            y: b.y + 12,
            tx: this.cx(foe),
            ty: this.cy(foe),
            target: foe,
            dmg,
            owner: b.owner,
            t: 0,
          });
          if (World.visible(0, this.cx(b), this.cy(b))) SFX.shoot();
        }
      }
    }
  },

  finishTrain(b, type) {
    const def = UNIT[type];
    const pop = this.popOf(b.owner);
    if (pop.used >= pop.cap) {
      U.refund(Game.players[b.owner].res, def.cost);
      if (b.owner === 0) UI.toast("Not enough population — build houses");
      return;
    }
    const spot = this.spawnNear(b);
    const u = this.unit(type, b.owner, spot.x, spot.y);
    if (b.rally) {
      u.state = "move";
      this.setPath(u, b.rally.x, b.rally.y);
    }
    if (b.owner === 0) SFX.done();
  },

  spawnNear(b) {
    const cx = this.cx(b);
    const cy = b.y + b.h + 10;
    for (let i = 0; i < 12; i++) {
      const x = cx + U.rand(-30, 30);
      const y = cy + U.rand(0, 24);
      if (World.walkableWorld(x, y)) return { x, y };
    }
    return { x: cx, y: cy };
  },

  enqueue(b, item) {
    const p = Game.players[b.owner];
    if (item === "age") {
      if (p.age >= 2 || p.aging) return false;
      if (!U.pay(p.res, { food: CFG.ageUp.food, gold: CFG.ageUp.gold })) {
        if (b.owner === 0) UI.toast("Need more resources to advance age");
        return false;
      }
      p.aging = true;
      b.queue.push("age");
      if (b.owner === 0) SFX.ui();
      return true;
    }
    const def = UNIT[item];
    if (p.age < def.age) {
      if (b.owner === 0) UI.toast("Advance an age to train this unit");
      return false;
    }
    const pop = this.popOf(b.owner);
    if (pop.used + b.queue.filter((q) => q !== "age").length >= pop.cap) {
      if (b.owner === 0) UI.toast("Population limit reached");
      return false;
    }
    if (!U.pay(p.res, def.cost)) {
      if (b.owner === 0) UI.toast("Not enough resources");
      return false;
    }
    if (b.queue.length >= 5) {
      U.refund(p.res, def.cost);
      if (b.owner === 0) UI.toast("Queue is full");
      return false;
    }
    b.queue.push(item);
    if (b.owner === 0) SFX.ui();
    return true;
  },

  update(dt) {
    for (const e of this.list) {
      if (e.dead) continue;
      if (e.kind === "unit") this.updateUnit(e, dt);
      else if (e.kind === "building") this.updateBuilding(e, dt);
    }
    for (const p of this.projectiles) {
      p.t += dt;
      const k = Math.min(1, p.t / 0.28);
      p.x = U.lerp(p.x, p.tx, k);
      p.y = U.lerp(p.y, p.ty, k);
      if (k >= 1) {
        if (p.target && !p.target.dead) this.damage(p.target, p.dmg, null);
        if (p.splash) {
          for (const e of this.list) {
            if (e.dead || e === p.target || e.owner === p.owner || e.owner < 0) continue;
            if (e.kind === "resource") continue;
            if (U.dist(this.cx(e), this.cy(e), p.tx, p.ty) <= p.splash) this.damage(e, Math.max(1, p.dmg * 0.45), null);
          }
        }
        p.dead = true;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    for (const f of this.floats) {
      f.t += dt;
      f.y -= 18 * dt;
    }
    this.floats = this.floats.filter((f) => f.t < f.life);
    for (const q of this.particles) {
      q.t += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 80 * dt;
    }
    this.particles = this.particles.filter((q) => q.t < q.life);
    if (this.list.length > 0 && this.list.some((e) => e.dead)) {
      this.list = this.list.filter((e) => !e.dead);
    }
  },
};
