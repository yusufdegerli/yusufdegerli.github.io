const Game = {
  running: false,
  fogOn: true,
  time: 0,
  speed: 1,
  selected: [],
  placing: null,
  attackMove: false,
  players: [],
  hints: 0,
  winner: null,

  isNeutral(id) {
    return !!(CFG.players[id] && CFG.players[id].kind === "neutral");
  },

  isAi(id) {
    return !!(CFG.players[id] && CFG.players[id].kind === "ai");
  },

  isHostile(a, b) {
    if (a === b || a < 0 || b < 0) return false;
    if (this.isNeutral(a)) return false;
    return true;
  },

  setSpeed(n) {
    this.speed = n;
    const bar = document.getElementById("speed-bar");
    if (!bar || !bar.querySelectorAll) return;
    const btns = bar.querySelectorAll("button");
    for (let i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("on", +btns[i].dataset.speed === n);
    }
  },

  boot() {
    Spr.init();
    Path.init();
    UI.bind();
    World.reset(0x51a77e);
    World.fogSeen[0].fill(1);
    World.fogVis[0].fill(1);
    Cam.z = 0.85;
    Cam.centerOn((CFG.mapW * CFG.tile) / 2, (CFG.mapH * CFG.tile) / 2);
  },

  newMatch() {
    this.running = true;
    this.time = 0;
    this.selected = [];
    this.placing = null;
    this.attackMove = false;
    this.winner = null;
    this.hints = 0;
    this.setSpeed(this.speed || 1);
    this.players = CFG.players.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      res: { wood: CFG.start.wood, food: CFG.start.food, gold: CFG.start.gold, stone: CFG.start.stone },
      age: 1,
      aging: false,
      alive: true,
    }));
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].kind !== "ai") continue;
      this.players[i].res.wood = 150;
      this.players[i].res.food = 170;
      this.players[i].res.gold = 60;
      this.players[i].res.stone = 25;
    }

    Ent.reset();
    AI.reset();
    World.reset((Math.random() * 1e9) | 0);
    this.seedWorld();

    const hall = Ent.list.find((e) => e.owner === 0 && e.type === "hall");
    Cam.z = 1;
    Cam.centerOn(Ent.cx(hall), Ent.cy(hall));
    UI.showHud(true);
    UI.hint("Select your villagers, then right-click trees, bushes, gold or stone to gather.", 8);
    document.getElementById("title-screen").classList.add("hidden");
    document.getElementById("end-screen").classList.add("hidden");
  },

  seedWorld() {
    const rnd = U.seeded(World.seed ^ 0x9e3779b9);
    const yard = (hx, hy) => {
      for (let y = hy - 1; y < hy + BLD.hall.size + 3; y++) {
        for (let x = hx - 1; x < hx + BLD.hall.size + 2; x++) {
          if (World.in(x, y) && World.tiles[World.idx(x, y)] !== 2) World.tiles[World.idx(x, y)] = 1;
        }
      }
    };
    const spawnWorkers = (owner, hx, hy, n) => {
      const footY = hy + BLD.hall.size + 2;
      let spawned = 0;
      for (let row = 0; spawned < n && row < 8; row++) {
        for (let col = 0; spawned < n && col < 8; col++) {
          const tx = hx + col;
          const ty = footY + row;
          if (!World.in(tx, ty) || World.block[World.idx(tx, ty)]) continue;
          const c = U.tileCenter(tx, ty);
          Ent.unit("worker", owner, c.x, c.y);
          spawned++;
        }
      }
    };
    const localRes = (hx, hy) => {
      const packs = [
        { kind: "wood", dx: 8, dy: -2, n: 12, s: 5 },
        { kind: "wood", dx: -2, dy: 7, n: 8, s: 4 },
        { kind: "food", dx: 7, dy: 7, n: 7, s: 3 },
        { kind: "gold", dx: 9, dy: 2, n: 4, s: 2 },
        { kind: "stone", dx: -3, dy: 2, n: 4, s: 2 },
      ];
      for (let i = 0; i < packs.length; i++) {
        const p = packs[i];
        const spawned = World.spawnCluster(p.kind, hx + p.dx, hy + p.dy, p.n, p.s, rnd);
        for (let j = 0; j < spawned.length; j++) {
          const n = spawned[j];
          Ent.resource(n.kind, n.tx, n.ty, n.x, n.y);
        }
      }
    };
    const starts = [
      { owner: 0, tx: 8, ty: CFG.mapH - 14, workers: CFG.start.workers },
      { owner: 1, tx: CFG.mapW - 14, ty: 8, workers: 4 },
      { owner: 2, tx: 8, ty: 8, workers: 4 },
      { owner: 3, tx: CFG.mapW - 14, ty: CFG.mapH - 14, workers: 4 },
    ];
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i];
      Ent.building("hall", s.owner, s.tx, s.ty, true);
      yard(s.tx, s.ty);
      spawnWorkers(s.owner, s.tx, s.ty, s.workers);
      localRes(s.tx, s.ty);
    }
    const neutrals = [
      { tx: (CFG.mapW / 2 - 2) | 0, ty: (CFG.mapH / 2 - 2) | 0 },
      { tx: (CFG.mapW / 2 - 2) | 0, ty: 20 },
      { tx: 24, ty: (CFG.mapH / 2 - 2) | 0 },
    ];
    const houseOff = [
      [-3, 1],
      [5, 1],
    ];
    for (let i = 0; i < neutrals.length; i++) {
      const n = neutrals[i];
      const hall = Ent.building("hall", 4, n.tx, n.ty, true);
      hall.raidBy = null;
      hall.raidT = 0;
      yard(n.tx, n.ty);
      for (let h = 0; h < houseOff.length; h++) {
        const tx = n.tx + houseOff[h][0];
        const ty = n.ty + houseOff[h][1];
        if (World.canPlace(tx, ty, BLD.house.size)) Ent.building("house", 4, tx, ty, true);
      }
      spawnWorkers(4, n.tx, n.ty, 2);
      World.spawnCluster("food", n.tx + 6, n.ty + 5, 5, 3, rnd).forEach((r) => {
        Ent.resource(r.kind, r.tx, r.ty, r.x, r.y);
      });
    }
    const mid = [
      { kind: "wood", cx: 48, cy: 48, n: 16, s: 7 },
      { kind: "gold", cx: 60, cy: 36, n: 6, s: 2 },
      { kind: "stone", cx: 36, cy: 60, n: 6, s: 2 },
      { kind: "food", cx: 52, cy: 70, n: 7, s: 3 },
    ];
    for (let i = 0; i < mid.length; i++) {
      const c = mid[i];
      const spawned = World.spawnCluster(c.kind, c.cx, c.cy, c.n, c.s, rnd);
      for (let j = 0; j < spawned.length; j++) {
        const n = spawned[j];
        Ent.resource(n.kind, n.tx, n.ty, n.x, n.y);
      }
    }
  },

  finishAge(owner) {
    const p = this.players[owner];
    p.age = 2;
    p.aging = false;
    if (owner === 0) {
      SFX.ageFanfare();
      UI.toast("Your people enter the Iron Age");
      UI.hint("Iron Age: farms yield more, archers unlock at the barracks, and towers hit harder.", 8);
    }
    Ent.burst(400, 400, "#d4a84b", 20);
    for (const e of Ent.list) {
      if (!e.dead && e.kind === "building" && e.owner === owner && e.built) {
        Ent.burst(Ent.cx(e), Ent.cy(e), "#d4a84b", 10);
      }
    }
  },

  onHallDown(owner) {
    if (this.winner) return;
    if (this.isNeutral(owner)) return;
    const still = Ent.list.some((e) => !e.dead && e.owner === owner && e.type === "hall");
    if (still) return;
    if (this.players[owner]) this.players[owner].alive = false;
    if (owner === 0) {
      this.end(false);
      return;
    }
    const aiLeft = this.players.some((p) => p.kind === "ai" && p.alive);
    if (!aiLeft) this.end(true);
    else if (this.isAi(owner)) UI.toast(CFG.players[owner].name + " has fallen");
  },

  end(win) {
    this.winner = win ? 0 : 1;
    this.running = false;
    const scr = document.getElementById("end-screen");
    document.getElementById("end-title").textContent = win ? "Victory" : "Defeat";
    document.getElementById("end-text").textContent = win
      ? "Every rival hall is ash. The vale is yours."
      : "Your village hall has fallen. The vale is lost.";
    scr.classList.remove("hidden");
    UI.showHud(false);
  },

  command(cmd) {
    SFX.unlock();
    if (cmd === "stop") {
      const units = this.selected.filter((e) => e.kind === "unit" && e.owner === 0);
      Ent.stop(units);
      for (const b of this.selected.filter((e) => e.kind === "building" && e.owner === 0)) {
        while (b.queue.length) {
          const item = b.queue.pop();
          if (item === "age") {
            U.refund(this.players[0].res, { food: CFG.ageUp.food, gold: CFG.ageUp.gold });
            this.players[0].aging = false;
          } else U.refund(this.players[0].res, UNIT[item].cost);
        }
        b.prodT = 0;
        b.prodNeed = 0;
      }
      return;
    }
    if (cmd.startsWith("build:")) {
      this.placing = cmd.split(":")[1];
      this.attackMove = false;
      document.getElementById("world").classList.add("placing");
      return;
    }
    if (cmd.startsWith("train:")) {
      const type = cmd.split(":")[1];
      const halls = this.selected.filter((e) => e.kind === "building" && e.owner === 0 && BLD[e.type].trains);
      for (const b of halls) Ent.enqueue(b, type);
      return;
    }
    if (cmd === "age") {
      const hall = this.selected.find((e) => e.type === "hall" && e.owner === 0);
      if (hall) Ent.enqueue(hall, "age");
      return;
    }
    if (cmd === "repair") {
      const workers = this.selected.filter((e) => e.type === "worker" && e.owner === 0);
      const site = this.damagedBuilding(0);
      if (!workers.length) return;
      if (!site) {
        UI.toast("Nothing needs repair");
        return;
      }
      Ent.issueRepair(workers, site);
      SFX.voice("villager");
      return;
    }
    if (cmd === "replant") {
      const farm = this.selected.find((e) => e.type === "farm" && e.owner === 0);
      if (farm && Ent.reseedFarm(farm, 0)) {
        const workers = this.selected.filter((e) => e.type === "worker" && e.owner === 0);
        if (workers.length) Ent.issueGather(workers, farm);
      }
    }
  },

  damagedBuilding(owner) {
    const damaged = Ent.list.filter(
      (e) => !e.dead && e.kind === "building" && e.owner === owner && e.built && e.hp < e.maxHp
    );
    damaged.sort((a, b) => {
      if (a.type === "hall" && b.type !== "hall") return -1;
      if (b.type === "hall" && a.type !== "hall") return 1;
      return a.hp / a.maxHp - b.hp / b.maxHp;
    });
    return damaged[0] || null;
  },

  pickClickSound(e) {
    if (!e) return;
    if (e.kind === "resource") SFX.clickWorld(e.type);
    else if (e.kind === "unit") SFX.clickWorld(null, e.voice || e.job);
    else if (e.kind === "building") SFX.place();
  },

  handleInput() {
    const { clicks, wheel } = Input.consume();
    if (wheel) Cam.zoomAt(Input.sx, Input.sy, wheel);
    const canvas = document.getElementById("world");
    canvas.classList.toggle("placing", !!this.placing);
    canvas.classList.toggle("attack-cursor", this.attackMove);

    if (Input.down("Escape")) {
      this.placing = null;
      this.attackMove = false;
    }
    if (Input.down("KeyH")) {
      const hall = Ent.list.find((e) => e.owner === 0 && e.type === "hall" && !e.dead);
      if (hall) Cam.centerOn(Ent.cx(hall), Ent.cy(hall));
      Input.keys.KeyH = false;
    }
    if (Input.down("KeyI")) {
      const idle = Ent.list.find((e) => !e.dead && e.owner === 0 && e.type === "worker" && e.state === "idle");
      if (idle) {
        this.selected = [idle];
        Cam.centerOn(idle.x, idle.y);
        SFX.voice(idle.voice);
      }
      Input.keys.KeyI = false;
    }
    if (Input.down("KeyB")) {
      const w = this.selected.find((e) => e.type === "worker" && e.owner === 0);
      if (w) this.placing = "house";
      Input.keys.KeyB = false;
    }
    if (Input.down("KeyL")) {
      const w = this.selected.find((e) => e.type === "worker" && e.owner === 0);
      if (w) this.placing = "lumber";
      Input.keys.KeyL = false;
    }
    if (Input.down("KeyM")) {
      const w = this.selected.find((e) => e.type === "worker" && e.owner === 0);
      if (w) this.placing = "mining";
      Input.keys.KeyM = false;
    }
    if (Input.down("KeyN")) {
      const w = this.selected.find((e) => e.type === "worker" && e.owner === 0);
      if (w) this.placing = "mill";
      Input.keys.KeyN = false;
    }
    if (Input.down("KeyF")) {
      const w = this.selected.find((e) => e.type === "worker" && e.owner === 0);
      if (w) this.placing = "farm";
      Input.keys.KeyF = false;
    }
    if (Input.down("Digit1")) {
      this.setSpeed(1);
      Input.keys.Digit1 = false;
    }
    if (Input.down("Digit2")) {
      this.setSpeed(2);
      Input.keys.Digit2 = false;
    }
    if (Input.down("Digit5")) {
      this.setSpeed(5);
      Input.keys.Digit5 = false;
    }

    for (const c of clicks) {
      if (c.type === "left") this.left(c);
      else this.right(c);
    }
  },

  left(c) {
    if (this.placing) {
      if (c.box) {
        this.placing = null;
        return;
      }
      const def = BLD[this.placing];
      const tx = Math.floor(c.wx / CFG.tile);
      const ty = Math.floor(c.wy / CFG.tile);
      if (!World.canPlace(tx, ty, def.size)) {
        UI.toast("Cannot build there");
        return;
      }
      if (!U.pay(this.players[0].res, def.cost)) {
        UI.toast("Not enough resources");
        return;
      }
      const b = Ent.building(this.placing, 0, tx, ty, false);
      const workers = this.selected.filter((e) => e.type === "worker" && e.owner === 0);
      Ent.issueBuild(workers.length ? workers : Ent.list.filter((e) => e.type === "worker" && e.owner === 0 && e.state === "idle").slice(0, 1), b);
      SFX.place();
      if (!c.shift) this.placing = null;
      return;
    }
    if (c.box) {
      const a = Cam.toWorld(c.box.x0, c.box.y0);
      const b = Cam.toWorld(c.box.x1, c.box.y1);
      const units = Ent.inBox(a.x, a.y, b.x, b.y, (e) => e.kind === "unit" && e.owner === 0);
      if (!c.shift) this.selected = units;
      else this.selected = this.merge(this.selected, units);
      if (units[0]) SFX.voice(units[0].voice);
      return;
    }
    const hit = Ent.atPoint(c.wx, c.wy, 0);
    if (c.dbl && hit && hit.kind === "unit" && hit.owner === 0) {
      const vis = Ent.list.filter((e) => !e.dead && e.owner === 0 && e.type === hit.type && World.visible(0, e.x, e.y));
      this.selected = vis;
      SFX.voice(hit.voice);
      return;
    }
    if (hit) {
      if (c.shift && hit.owner === 0) this.selected = this.merge(this.selected, [hit]);
      else this.selected = [hit];
      this.pickClickSound(hit);
    } else if (!c.shift) {
      this.selected = [];
    }
  },

  right(c) {
    if (this.placing) {
      this.placing = null;
      return;
    }
    const ownUnits = this.selected.filter((e) => e.kind === "unit" && e.owner === 0);
    const ownBlds = this.selected.filter((e) => e.kind === "building" && e.owner === 0 && e.built);
    const hit = Ent.atPoint(c.wx, c.wy, 0);

    if (ownBlds.length && !ownUnits.length) {
      for (const b of ownBlds) b.rally = { x: c.wx, y: c.wy };
      SFX.ui();
      return;
    }
    if (!ownUnits.length) return;

    if (hit && hit.kind === "resource" && hit.amount > 0) {
      const workers = ownUnits.filter((u) => u.type === "worker");
      if (workers.length) {
        Ent.issueGather(workers, hit);
        SFX.clickWorld(hit.type);
        SFX.voice("villager");
      }
      const rest = ownUnits.filter((u) => u.type !== "worker");
      if (rest.length) Ent.issueMove(rest, c.wx, c.wy);
      return;
    }
    if (hit && this.isHostile(0, hit.owner)) {
      const fighters = ownUnits.filter((u) => UNIT[u.type].role !== "support");
      if (fighters.length) {
        Ent.issueAttack(fighters, hit);
        SFX.voice(fighters[0].voice);
      }
      const rest = ownUnits.filter((u) => UNIT[u.type].role === "support");
      if (rest.length) Ent.issueMove(rest, c.wx, c.wy);
      return;
    }
    if (hit && hit.owner === 0 && hit.kind === "unit") {
      const priests = ownUnits.filter((u) => UNIT[u.type].role === "support");
      if (priests.length) {
        Ent.issueHeal(priests, hit);
        SFX.voice("priest");
      }
      const rest = ownUnits.filter((u) => UNIT[u.type].role !== "support");
      if (rest.length) Ent.issueMove(rest, c.wx, c.wy);
      return;
    }
    if (hit && hit.kind === "building" && hit.owner === 0 && !hit.built) {
      Ent.issueBuild(ownUnits.filter((u) => u.type === "worker"), hit);
      SFX.voice("villager");
      return;
    }
    if (hit && hit.type === "farm" && hit.owner === 0 && hit.built) {
      const workers = ownUnits.filter((u) => u.type === "worker");
      if (workers.length) {
        if (hit.amount <= 0) Ent.reseedFarm(hit, 0);
        if (hit.amount > 0) {
          Ent.issueGather(workers, hit);
          SFX.rustle();
          SFX.voice("villager");
          return;
        }
      }
    }
    if (hit && hit.kind === "building" && hit.owner === 0 && hit.built && hit.hp < hit.maxHp) {
      const workers = ownUnits.filter((u) => u.type === "worker");
      if (workers.length) {
        Ent.issueRepair(workers, hit);
        SFX.voice("villager");
        return;
      }
    }
    Ent.issueMove(ownUnits, c.wx, c.wy);
    SFX.voice(ownUnits[0].voice);
  },

  merge(a, b) {
    const s = new Set(a);
    for (const e of b) s.add(e);
    return [...s];
  },

  updateFog() {
    for (let i = 0; i < CFG.players.length; i++) World.clearVis(i);
    for (const e of Ent.list) {
      if (e.dead || e.owner < 0) continue;
      if (e.kind === "building" && !e.built) continue;
      const los = e.kind === "unit" ? UNIT[e.type].los : BLD[e.type].los;
      World.reveal(e.owner, Ent.cx(e), Ent.cy(e), los);
    }
    World.snapshotFog();
  },

  tick(dt) {
    if (!this.running) return;
    this.time += dt;
    this.handleInput();
    Cam.update(dt, Input);
    Ent.update(dt);
    AI.update(dt);
    this.tickRaids(dt);
    this.updateFog();
    this.selected = this.selected.filter((e) => !e.dead);
    UI.update(dt);
    if (this.time > 8 && this.hints === 0) {
      this.hints = 1;
      UI.hint("Build houses to raise population, then a barracks to train soldiers.", 7);
    }
    if (this.time > 28 && this.hints === 1) {
      this.hints = 2;
      UI.hint("Berries will not last. Build a mill and farms, then right-click a field to work it.", 8);
    }
    if (this.time > 55 && this.hints === 2) {
      this.hints = 3;
      UI.hint("Pale villages will pay tribute if your soldiers stand near their hall.", 8);
    }
  },

  tickRaids(dt) {
    const range = CFG.raid.range;
    const every = CFG.raid.interval;
    const tribute = CFG.raid.tribute;
    for (let i = 0; i < Ent.list.length; i++) {
      const hall = Ent.list[i];
      if (hall.dead || hall.kind !== "building" || hall.type !== "hall") continue;
      if (!this.isNeutral(hall.owner)) continue;
      const counts = {};
      for (let j = 0; j < Ent.list.length; j++) {
        const u = Ent.list[j];
        if (u.dead || u.kind !== "unit") continue;
        if (!UNIT[u.type] || UNIT[u.type].role !== "military") continue;
        if (this.isNeutral(u.owner)) continue;
        if (U.dist(u.x, u.y, Ent.cx(hall), Ent.cy(hall)) > range) continue;
        counts[u.owner] = (counts[u.owner] || 0) + 1;
      }
      let best = null;
      let bestN = 0;
      const keys = Object.keys(counts);
      for (let k = 0; k < keys.length; k++) {
        const id = +keys[k];
        if (counts[id] > bestN) {
          bestN = counts[id];
          best = id;
        }
      }
      if (best != null && hall.raidBy !== best) {
        hall.raidBy = best;
        hall.raidT = 0;
        if (best === 0) UI.toast("A pale village has been raided. They will send tribute.");
      }
      if (hall.raidBy == null) continue;
      if (!this.players[hall.raidBy] || !this.players[hall.raidBy].alive) continue;
      if (!counts[hall.raidBy]) continue;
      hall.raidT = (hall.raidT || 0) + dt;
      if (hall.raidT < every) continue;
      hall.raidT = 0;
      const stock = this.players[hall.raidBy].res;
      stock.food += tribute.food;
      stock.wood += tribute.wood;
      stock.gold += tribute.gold;
      if (hall.raidBy === 0) {
        UI.toast("Tribute: +" + tribute.food + " food, +" + tribute.wood + " wood, +" + tribute.gold + " gold");
        SFX.done();
      }
    }
  },
};
