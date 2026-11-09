const UI = {
  hintEl: null,
  resEl: null,
  ageEl: null,
  infoEl: null,
  cmdEl: null,
  msgsEl: null,
  hintT: 0,
  lastSelKey: "",
  lastResKey: "",

  bind() {
    this.hintEl = document.getElementById("hint");
    this.resEl = document.getElementById("resources");
    this.ageEl = document.getElementById("age-chip");
    this.infoEl = document.getElementById("sel-info");
    this.cmdEl = document.getElementById("commands");
    this.msgsEl = document.getElementById("float-msgs");
    this.cmdEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".cmd");
      if (!btn || btn.disabled) return;
      Game.command(btn.dataset.cmd);
    });
    const speeds = document.getElementById("speed-bar");
    if (speeds) {
      speeds.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        Game.setSpeed(+btn.dataset.speed);
      });
    }
    document.getElementById("minimap").addEventListener("pointerdown", (e) => this.miniNav(e));
    document.getElementById("minimap").addEventListener("pointermove", (e) => {
      if (e.buttons) this.miniNav(e);
    });
  },

  miniNav(e) {
    const c = document.getElementById("minimap");
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * Cam.worldW();
    const y = ((e.clientY - r.top) / r.height) * Cam.worldH();
    Cam.centerOn(x, y);
  },

  hint(text, seconds) {
    this.hintEl.textContent = text;
    this.hintEl.classList.remove("hidden");
    this.hintT = seconds || 6;
  },

  toast(text) {
    const el = document.createElement("div");
    el.className = "msg";
    el.textContent = text;
    this.msgsEl.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  },

  update(dt) {
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) this.hintEl.classList.add("hidden");
    }
    this.resources();
    this.selection();
  },

  resources() {
    const p = Game.players[0];
    const pop = Ent.popOf(0);
    const key = `${p.res.wood}|${p.res.food}|${p.res.gold}|${p.res.stone}|${pop.used}|${pop.cap}|${p.age}`;
    if (key === this.lastResKey) return;
    this.lastResKey = key;
    this.resEl.innerHTML =
      ["wood", "food", "gold", "stone"]
        .map((k) => {
          const spec = CFG.resources[k];
          return `<div class="res ${k}" title="${spec.name}">
            <span class="ico" aria-hidden="true">${spec.emoji}</span>
            <span class="amt">${p.res[k] | 0}</span>
            <span class="tip">${spec.name}</span>
          </div>`;
        })
        .join("") +
      `<div class="res pop" title="Population">
        <span class="ico" aria-hidden="true">👥</span>
        <span class="amt">${pop.used}/${pop.cap}</span>
        <span class="tip">Population</span>
      </div>`;
    this.ageEl.textContent = CFG.ages[p.age - 1].name;
  },

  selection() {
    const sel = Game.selected.filter((e) => !e.dead);
    const key = sel.map((e) => e.id + ":" + (e.queue ? e.queue.join(",") : e.state) + (e.hp | 0) + ":" + (e.amount | 0)).join("|") + Game.placing;
    if (key === this.lastSelKey) return;
    this.lastSelKey = key;
    if (!sel.length) {
      this.infoEl.innerHTML = `<h3>No selection</h3><div class="meta">Left click a villager, soldier or building. Drag a box to select many.</div>`;
      this.cmdEl.innerHTML = "";
      return;
    }
    if (sel.length === 1) this.one(sel[0]);
    else this.many(sel);
  },

  one(e) {
    if (e.kind === "resource") {
      const spec = CFG.resources[e.type];
      this.infoEl.innerHTML = `<h3>${spec.name}</h3><div class="meta">${e.amount | 0} remaining. Right-click with villagers to gather.</div>
        <div class="hp-track"><div class="hp-fill" style="width:${(e.amount / e.max) * 100}%"></div></div>`;
      this.cmdEl.innerHTML = "";
      return;
    }
    if (e.kind === "unit") {
      const def = UNIT[e.type];
      const owner = e.owner === 0 ? "Yours" : CFG.players[e.owner] ? CFG.players[e.owner].name : "Unknown";
      this.infoEl.innerHTML = `<h3>${def.name}</h3><div class="meta">${owner} · ${def.job} · ${e.state}${e.carryAmount ? ` · carrying ${e.carryAmount} ${e.carryType}` : ""}</div>
        <div class="hp-track"><div class="hp-fill" style="width:${(e.hp / e.maxHp) * 100}%"></div></div>`;
      this.cmdEl.innerHTML = e.owner === 0 ? this.unitCmds(e) : "";
      return;
    }
    const def = BLD[e.type];
    const p = Game.players[e.owner];
    const q = e.queue
      .map((item) => `<span>${item === "age" ? "Age up" : UNIT[item].name}</span>`)
      .join("");
    const prog = e.queue.length && e.prodNeed ? ` · ${Math.min(99, ((e.prodT / e.prodNeed) * 100) | 0)}%` : "";
    const drops = def.drops && def.drops.length
      ? ` · drop-off ${def.drops.map((k) => CFG.resources[k].name.toLowerCase()).join(", ")}`
      : "";
    const crop =
      e.type === "farm" && e.built
        ? e.amount > 0
          ? ` · ${e.amount | 0} food left`
          : " · fallow — replant"
        : "";
    this.infoEl.innerHTML = `<h3>${def.name}</h3>
      <div class="meta">${e.built ? "Standing" : "Building…"} · ${CFG.ages[(p ? p.age : 1) - 1].name}${drops}${crop}${prog}</div>
      <div class="hp-track"><div class="hp-fill" style="width:${(e.hp / e.maxHp) * 100}%"></div></div>
      ${q ? `<div class="queue-pips">${q}</div>` : ""}`;
    this.cmdEl.innerHTML = e.owner === 0 && e.built ? this.bldCmds(e) : "";
  },

  many(sel) {
    const units = sel.filter((e) => e.kind === "unit");
    const names = {};
    for (const u of units) names[UNIT[u.type].name] = (names[UNIT[u.type].name] || 0) + 1;
    const summary = Object.keys(names).map((k) => `${names[k]} ${k}`).join(", ");
    this.infoEl.innerHTML = `<h3>${sel.length} selected</h3><div class="meta">${summary || "Mixed selection"}</div>`;
    const worker = units.find((u) => u.type === "worker" && u.owner === 0);
    this.cmdEl.innerHTML = worker ? this.unitCmds(worker) : units.some((u) => u.owner === 0) ? this.cmdBtn("stop", "Stop", "Halt") : "";
  },

  unitCmds(e) {
    let html = this.cmdBtn("stop", "Stop", "Halt orders");
    if (e.type === "worker") {
      html += this.cmdBtn("build:house", "House", U.formatCost(BLD.house.cost), BLD.house.cost);
      html += this.cmdBtn("build:barracks", "Barracks", U.formatCost(BLD.barracks.cost), BLD.barracks.cost);
      html += this.cmdBtn("build:tower", "Tower", U.formatCost(BLD.tower.cost), BLD.tower.cost);
      html += this.cmdBtn("build:lumber", "Lumber", U.formatCost(BLD.lumber.cost), BLD.lumber.cost);
      html += this.cmdBtn("build:mining", "Mining", U.formatCost(BLD.mining.cost), BLD.mining.cost);
      html += this.cmdBtn("build:mill", "Mill", U.formatCost(BLD.mill.cost), BLD.mill.cost);
      html += this.cmdBtn("build:farm", "Farm", U.formatCost(BLD.farm.cost), BLD.farm.cost);
      html += this.cmdBtn("repair", "Repair", "Hall first");
    }
    return html;
  },

  bldCmds(e) {
    let html = "";
    const def = BLD[e.type];
    const p = Game.players[0];
    if (def.trains) {
      for (const id of def.trains) {
        const u = UNIT[id];
        const locked = p.age < u.age;
        html += this.cmdBtn("train:" + id, u.name, locked ? `Age ${u.age}` : U.formatCost(u.cost), u.cost, locked);
      }
    }
    if (e.type === "farm" && e.built && e.amount <= 0) {
      html += this.cmdBtn("replant", "Replant", U.formatCost(CFG.farm.replant), CFG.farm.replant);
    }
    if (def.canAge) {
      const busy = p.age >= 2 || p.aging;
      html += this.cmdBtn(
        "age",
        p.age >= 2 ? "Iron Age" : "Advance Age",
        p.age >= 2 ? "Done" : U.formatCost({ food: CFG.ageUp.food, gold: CFG.ageUp.gold }),
        { food: CFG.ageUp.food, gold: CFG.ageUp.gold },
        busy
      );
    }
    html += this.cmdBtn("stop", "Stop", "Cancel queue");
    return html;
  },

  cmdBtn(cmd, label, cost, costObj, locked) {
    const p = Game.players[0];
    const poor = costObj && !U.canPay(p.res, costObj);
    const dis = locked || poor ? "disabled" : "";
    const color = cmd.includes("house")
      ? "#c9b07a"
      : cmd.includes("barracks")
        ? "#6a4e2c"
        : cmd.includes("tower")
          ? "#7a7874"
          : cmd.includes("lumber")
            ? "#7a4a22"
            : cmd.includes("mining")
              ? "#8a8e96"
              : cmd.includes("mill")
                ? "#c9b07a"
                : cmd.includes("farm") || cmd === "replant"
                  ? "#4a7a32"
                  : cmd.includes("archer")
                    ? "#5a7a32"
                    : cmd.includes("mage")
                      ? "#8a58c8"
                      : cmd.includes("spearman")
                        ? "#8a6a3c"
                        : cmd.includes("knight")
                          ? "#8a9098"
                    : cmd.includes("worker")
                ? "#2f8f86"
                : cmd.includes("militia") || cmd.includes("swordsman")
                  ? "#8a3030"
                  : cmd.includes("scout")
                    ? "#c9a84a"
                    : cmd.includes("priest")
                      ? "#efe6c8"
                      : cmd === "repair"
                        ? "#6ec07a"
                        : cmd === "age"
                    ? "#d4a84b"
                    : "#5a5040";
    return `<button class="cmd" data-cmd="${cmd}" ${dis}>
      <span class="icon" style="background:${color}"></span>
      <span class="label">${label}</span>
      <span class="cost">${cost || ""}</span>
    </button>`;
  },

  showHud(on) {
    document.getElementById("hud").classList.toggle("hidden", !on);
    document.getElementById("minimap").style.display = on ? "block" : "none";
  },
};
