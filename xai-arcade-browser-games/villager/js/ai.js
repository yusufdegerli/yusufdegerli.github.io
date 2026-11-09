const AI = {
  brains: [],

  reset() {
    this.brains = [];
    for (let i = 0; i < CFG.players.length; i++) {
      if (CFG.players[i].kind !== "ai") continue;
      this.brains.push({
        id: CFG.players[i].id,
        t: 0,
        wave: 0,
        nextWave: CFG.aiGrace + 40 + CFG.players[i].id * 18,
      });
    }
  },

  inGrace(b) {
    return b.t < CFG.aiGrace;
  },

  count(owner, pred) {
    let n = 0;
    for (const e of Ent.list) {
      if (e.dead || e.owner !== owner) continue;
      if (pred(e)) n++;
    }
    return n;
  },

  first(owner, pred) {
    for (const e of Ent.list) {
      if (!e.dead && e.owner === owner && pred(e)) return e;
    }
    return null;
  },

  idleWorkers(owner) {
    return Ent.list.filter((e) => !e.dead && e.owner === owner && e.type === "worker" && (e.state === "idle" || e.state === "move"));
  },

  workersOn(owner, res) {
    return Ent.list.filter((e) => !e.dead && e.owner === owner && e.type === "worker" && e.taskRes === res && (e.state === "gather" || e.state === "return"));
  },

  tryBuild(owner, type) {
    const def = BLD[type];
    const p = Game.players[owner];
    if (!U.canPay(p.res, def.cost)) return false;
    const hall = this.first(owner, (e) => e.type === "hall");
    if (!hall) return false;
    const workers = Ent.list.filter((e) => !e.dead && e.owner === owner && e.type === "worker");
    if (!workers.length) return false;
    for (let i = 0; i < 30; i++) {
      const tx = hall.tx + U.irand(-8, 10);
      const ty = hall.ty + U.irand(-8, 10);
      if (!World.canPlace(tx, ty, def.size)) continue;
      if (!U.pay(p.res, def.cost)) return false;
      const b = Ent.building(type, owner, tx, ty, false);
      Ent.issueBuild(workers.slice(0, 2), b);
      return true;
    }
    return false;
  },

  assignGather(owner) {
    const need = [
      ["food", 2],
      ["wood", 2],
      ["gold", 1],
    ];
    for (let i = 0; i < need.length; i++) {
      const res = need[i][0];
      const n = need[i][1];
      const have = this.workersOn(owner, res).length;
      if (have >= n) continue;
      const idle = Ent.list.filter(
        (e) => !e.dead && e.owner === owner && e.type === "worker" && e.state === "idle"
      );
      if (!idle.length) continue;
      const hall = this.first(owner, (e) => e.type === "hall");
      if (!hall) continue;
      const node =
        res === "food"
          ? Ent.nearestNode(idle[0], "food")
          : Ent.nearest(Ent.list, Ent.cx(hall), Ent.cy(hall), (e) => e.kind === "resource" && e.type === res && e.amount > 0);
      if (node) Ent.issueGather(idle.slice(0, n - have), node);
    }
  },

  update(dt) {
    for (let i = 0; i < this.brains.length; i++) this.updateOne(this.brains[i], dt);
  },

  updateOne(b, dt) {
    b.t += dt;
    const owner = b.id;
    const p = Game.players[owner];
    if (!p || !p.alive) return;

    const pop = Ent.popOf(owner);
    const halls = this.count(owner, (e) => e.type === "hall");
    if (!halls) return;
    const houses = this.count(owner, (e) => e.type === "house");
    const barracks = this.count(owner, (e) => e.type === "barracks");
    const towers = this.count(owner, (e) => e.type === "tower");
    const lumber = this.count(owner, (e) => e.type === "lumber");
    const mining = this.count(owner, (e) => e.type === "mining");
    const mills = this.count(owner, (e) => e.type === "mill");
    const farms = this.count(owner, (e) => e.type === "farm");
    const workers = this.count(owner, (e) => e.type === "worker");
    const army = this.count(owner, (e) => e.kind === "unit" && UNIT[e.type] && UNIT[e.type].role === "military");
    const hall = this.first(owner, (e) => e.type === "hall" && e.built);

    this.assignGather(owner);

    if (houses < 4 && pop.cap < 30) this.tryBuild(owner, "house");
    if (hall && workers < 10 && this.idleSlot(hall)) Ent.enqueue(hall, "worker");
    if (lumber < 1 && p.res.wood >= BLD.lumber.cost.wood) this.tryBuild(owner, "lumber");
    if (mills < 1 && b.t > 28 && p.res.wood >= BLD.mill.cost.wood) this.tryBuild(owner, "mill");
    if (farms < 4 && b.t > 36 && p.res.wood >= BLD.farm.cost.wood) this.tryBuild(owner, "farm");
    if (mining < 1 && b.t > 50 && p.res.wood >= BLD.mining.cost.wood) this.tryBuild(owner, "mining");

    if (!this.inGrace(b)) {
      if (barracks < 1 && workers >= 8 && p.res.wood >= BLD.barracks.cost.wood) this.tryBuild(owner, "barracks");
      if (towers < 1 && b.t > CFG.aiGrace + 20) this.tryBuild(owner, "tower");

      const bar = this.first(owner, (e) => e.type === "barracks" && e.built);
      if (bar && this.idleSlot(bar) && workers >= 8) {
        const kind = p.age >= 2 ? (U.chance(0.45) ? "archer" : "swordsman") : "militia";
        Ent.enqueue(bar, kind);
      }

      if (p.age === 1 && !p.aging && hall && U.canPay(p.res, { food: CFG.ageUp.food, gold: CFG.ageUp.gold }) && army >= 3) {
        Ent.enqueue(hall, "age");
      }

      if (b.t >= b.nextWave && army >= 4) {
        this.sendWave(b);
        b.wave++;
        b.nextWave = b.t + 70 + b.wave * 10;
      }
    }

    const underAttack = Ent.list.some(
      (e) => !e.dead && e.owner === owner && e.kind === "building" && e.hp < e.maxHp * 0.85
    );
    if (underAttack) this.defend(owner);
  },

  idleSlot(b) {
    return b.queue.length < 2;
  },

  sendWave(b) {
    if (this.inGrace(b)) return;
    const owner = b.id;
    const hall = this.first(owner, (e) => e.type === "hall");
    const target = Ent.nearest(Ent.list, hall ? Ent.cx(hall) : 0, hall ? Ent.cy(hall) : 0, (e) => {
      if (e.dead || e.kind !== "building" || e.type !== "hall") return false;
      return Game.isHostile(owner, e.owner);
    });
    if (!target) return;
    const soldiers = Ent.list.filter(
      (e) => !e.dead && e.owner === owner && e.kind === "unit" && UNIT[e.type] && UNIT[e.type].role === "military"
    );
    if (soldiers.length < 4) return;
    Ent.issueAttack(soldiers, target);
    if (target.owner === 0 && World.visible(0, Ent.cx(target), Ent.cy(target))) {
      UI.toast(CFG.players[owner].name + " is advancing");
    }
  },

  defend(owner) {
    const hall = this.first(owner, (e) => e.type === "hall");
    if (!hall) return;
    const foe = Ent.nearest(Ent.list, Ent.cx(hall), Ent.cy(hall), (e) => e.kind === "unit" && Game.isHostile(owner, e.owner));
    const soldiers = Ent.list.filter(
      (e) =>
        !e.dead &&
        e.owner === owner &&
        e.kind === "unit" &&
        UNIT[e.type] &&
        UNIT[e.type].role === "military" &&
        e.state !== "attack"
    );
    if (foe && soldiers.length) Ent.issueAttack(soldiers, foe);
  },
};
