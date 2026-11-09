/** @file DOM overlay HUD, menus, and inspect panel. */

import { BUILDINGS, BUILD_CATS, MATERIALS, GASES, LIQUIDS } from "../sim/constants.js";
import { buildingAt } from "../sim/buildings.js";

export class HUD {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.el = document.createElement("div");
    this.el.className = "hud";
    this.el.innerHTML = template();
    root.appendChild(this.el);
    this.$ = (s) => this.el.querySelector(s);
    this.$$ = (s) => [...this.el.querySelectorAll(s)];
    this._bind();
    this._populateBuild();
    this._tickAcc = 1;
    this.update(1);
  }

  _bind() {
    this.el.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });

    this.$("#btn-pause").onclick = () => this.game.setSpeed(this.game.speed === 0 ? 1 : 0);
    this.$("#btn-s1").onclick = () => this.game.setSpeed(1);
    this.$("#btn-s2").onclick = () => this.game.setSpeed(3);
    this.$("#btn-s3").onclick = () => this.game.setSpeed(8);

    this.$("#tool-select").onclick = () => this.game.setTool("select");
    this.$("#tool-dig").onclick = () => this.game.setTool("dig");
    this.$("#tool-decon").onclick = () => this.game.setTool("decon");
    this.$("#tool-cancel").onclick = () => this.game.setTool("cancel");

    this.el.querySelectorAll("[data-overlay]").forEach((b) => {
      b.onclick = () => this.game.setOverlay(b.dataset.overlay);
    });

    this.$("#btn-help").onclick = () => this.showManual(true);
    this.$("#btn-play").onclick = () => this.game.begin();
    this.$("#btn-resume").onclick = () => this.game.setSpeed(1);
    this.$("#btn-menu").onclick = () => this.showPause(true);

    this.manualOpen = false;
    this.manualPage = 0;
    this._speedBeforeManual = 0;
    this.$("#manual-close").onclick = () => this.showManual(false);
    this.$("#manual-prev").onclick = () => this._gotoPage(this.manualPage - 1);
    this.$("#manual-next").onclick = () => {
      if (this.manualPage >= MANUAL_PAGES.length - 1) this.showManual(false);
      else this._gotoPage(this.manualPage + 1);
    };
    this.el.querySelectorAll("[data-manual-page]").forEach((b) => {
      b.onclick = () => this._gotoPage(+b.dataset.manualPage);
    });
  }

  _populateBuild() {
    const cats = this.$("#build-cats");
    const items = this.$("#build-items");
    cats.innerHTML = "";
    for (const cat of BUILD_CATS) {
      const b = document.createElement("button");
      b.className = "cat";
      b.textContent = cat.name;
      b.dataset.cat = cat.id;
      b.onclick = () => this._showCat(cat.id);
      cats.appendChild(b);
    }
    this._showCat("base");
    items.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-build]");
      if (!btn) return;
      this.game.setTool("build:" + btn.dataset.build);
    });
  }

  _showCat(id) {
    this.$$("#build-cats .cat").forEach((c) => c.classList.toggle("on", c.dataset.cat === id));
    const cat = BUILD_CATS.find((c) => c.id === id);
    const box = this.$("#build-items");
    box.innerHTML = "";
    for (const key of cat.items) {
      const def = BUILDINGS[key];
      const b = document.createElement("button");
      b.className = "build-item";
      b.dataset.build = key;
      b.innerHTML = `<span class="bi-icon" data-k="${key}"></span><span class="bi-name">${def.name}</span><span class="bi-cost">${costLabel(def.cost)}</span>`;
      b.title = def.desc;
      box.appendChild(b);
    }
  }

  beginHidden() {
    this.$("#title-screen").classList.add("open");
    this.$("#pause-screen").classList.remove("open");
  }

  hideTitle() {
    this.$("#title-screen").classList.remove("open");
  }

  showManual(open) {
    const modal = this.$("#manual-modal");
    if (!modal) return;
    this.manualOpen = !!open;
    modal.classList.toggle("open", this.manualOpen);
    if (open) {
      this._speedBeforeManual = this.game.speed;
      this.game.setSpeed(0);
      this._gotoPage(this.manualPage || 0);
    } else if (this.game.started) {
      const restore = this._speedBeforeManual > 0 ? this._speedBeforeManual : 1;
      this.game.setSpeed(restore);
    }
  }

  _gotoPage(i) {
    const max = MANUAL_PAGES.length - 1;
    this.manualPage = Math.max(0, Math.min(max, i));
    const page = MANUAL_PAGES[this.manualPage];
    const body = this.$("#manual-body");
    if (body) body.innerHTML = page.html;
    this.$$("[data-manual-page]").forEach((b) => {
      b.classList.toggle("on", +b.dataset.manualPage === this.manualPage);
    });
    const prev = this.$("#manual-prev");
    const next = this.$("#manual-next");
    const pos = this.$("#manual-pos");
    if (prev) prev.disabled = this.manualPage === 0;
    if (next) next.textContent = this.manualPage === max ? "Close and play" : "Next";
    if (pos) pos.textContent = `${this.manualPage + 1} / ${MANUAL_PAGES.length}`;
  }

  showPause(v) {
    this.$("#pause-screen").classList.toggle("open", v);
    if (v) this.game.setSpeed(0);
  }

  showGameOver(msg) {
    this.$("#go-msg").textContent = msg;
    this.$("#gameover-screen").classList.add("open");
  }

  setTool(tool) {
    this.$$(".tool").forEach((t) => t.classList.toggle("on", t.id === "tool-" + tool || (tool.startsWith("build") && t.id === "tool-build")));
    this.$$(".build-item").forEach((t) => t.classList.toggle("on", tool === "build:" + t.dataset.build));
    const hint = this.$("#tool-hint");
    if (tool === "dig") hint.textContent = "Drag to designate digging";
    else if (tool === "cancel") hint.textContent = "Drag to cancel orders";
    else if (tool === "decon") hint.textContent = "Drag to deconstruct";
    else if (tool.startsWith("build:")) {
      const def = BUILDINGS[tool.slice(6)];
      hint.textContent = def ? `Place ${def.name} — ${def.desc}` : "";
    } else hint.textContent = "Select a dupe, building, or tile";
  }

  setOverlay(name) {
    this.$$("[data-overlay]").forEach((b) => b.classList.toggle("on", b.dataset.overlay === name));
  }

  setSpeed(s) {
    this.$("#btn-pause").classList.toggle("on", s === 0);
    this.$("#btn-s1").classList.toggle("on", s === 1);
    this.$("#btn-s2").classList.toggle("on", s === 3);
    this.$("#btn-s3").classList.toggle("on", s === 8);
    this.$("#speed-label").textContent = s === 0 ? "PAUSED" : s + "×";
  }

  update(dt) {
    this._tickAcc += dt;
    if (this._tickAcc < 0.12) return;
    this._tickAcc = 0;
    const g = this.game;
    this.$("#res-metal").textContent = fmt(g.resources.metal);
    this.$("#res-algae").textContent = fmt(g.resources.algae);
    this.$("#res-coal").textContent = fmt(g.resources.coal);
    this.$("#res-dirt").textContent = fmt(g.resources.dirt);
    this.$("#res-food").textContent = fmt(g.resources.food);
    this.$("#res-ice").textContent = fmt(g.resources.ice);
    this.$("#cycle-num").textContent = String(g.cycle + 1);
    this.$("#fps-num").textContent = g.stats.fps.toFixed(0);
    const live = g.crew.filter((c) => c.alive).length;
    this.$("#pop-num").textContent = String(live);

    const watts = g.networks.circuits.reduce((s, c) => s + (c.powerW || 0), 0);
    const demand = g.networks.circuits.reduce((s, c) => s + (c.demandW || 0), 0);
    const stored = g.networks.circuits.reduce((s, c) => s + (c.storedJ || 0), 0);
    this.$("#res-power").textContent = `${watts | 0}/${demand | 0}W · ${fmt(stored)}J`;

    this._renderCrew();
    this._renderInspect();
    this._renderAlerts();
  }

  _renderCrew() {
    const box = this.$("#crew-bar");
    const html = this.game.crew.map((c) => {
      if (!c.alive) {
        return `<button class="dupe dead" data-id="${c.id}"><span class="dupe-name">${c.name}</span><span class="dupe-state">Fallen</span></button>`;
      }
      const warn = !c.ghostSleep && (c.needs.o2 < 30 || c.needs.cal < 22 || c.needs.sleep < 16);
      return `<button class="dupe ${c.selected ? "on" : ""} ${warn ? "warn" : ""} ${c.ghostSleep ? "ghost" : ""}" data-id="${c.id}">
        <span class="dupe-swatch" style="background:${c.suit}"></span>
        <span class="dupe-name">${c.name}</span>
        <span class="dupe-state">${c.ghostSleep ? "Zzz" : c.thought}</span>
        <span class="need"><i style="width:${clamp(c.needs.o2)}%;background:#5ec8ff"></i></span>
        <span class="need"><i style="width:${clamp(c.needs.cal)}%;background:#f0a050"></i></span>
        <span class="need"><i style="width:${clamp(c.needs.sleep)}%;background:#a08cff"></i></span>
      </button>`;
    }).join("");
    if (box._html !== html) {
      box._html = html;
      box.innerHTML = html;
      box.querySelectorAll(".dupe").forEach((b) => {
        b.onclick = () => {
          const c = this.game.crew.find((d) => d.id === +b.dataset.id);
          if (c) this.game.selectColonist(c);
        };
      });
    }
  }

  _renderInspect() {
    const box = this.$("#inspect");
    const g = this.game;
    const sel = g.selected;
    if (!(sel && sel.kind === "building" && sel.obj?.type === "thermosensor")) {
      delete box.dataset.bid;
    }
    if (!sel) {
      if (g.hover && g.world.in(g.hover.x, g.hover.y)) {
        box.innerHTML = tileCard(g.world, g.hover.x, g.hover.y);
      } else {
        box.innerHTML = `<div class="card muted"><h3>Inspect</h3><p>Hover a tile or select a survivor.</p></div>`;
      }
      return;
    }
    if (sel.kind === "colonist") {
      const c = sel.obj;
      box.innerHTML = `<div class="card">
        <h3>${c.name}</h3>
        <p class="thought">“${c.ghostSleep ? "Zzz" : c.thought}”</p>
        ${c.ghostSleep ? `<p class="meta">Sleeping with no cot. They will not wake.</p>` : ""}
        ${needRow("Oxygen", c.needs.o2, "#5ec8ff")}
        ${needRow("Calories", c.needs.cal, "#f0a050")}
        ${needRow("Rest", c.needs.sleep, "#a08cff")}
        ${needRow("Bladder", c.needs.bladder, "#d0c070")}
        ${needRow("Morale", c.needs.morale, "#7dce8a")}
        <p class="meta">Health ${c.hp | 0} · ${c.state}</p>
        <p class="skills">Dig ${c.skill.dig.toFixed(2)} · Build ${c.skill.build.toFixed(2)} · Ops ${c.skill.operate.toFixed(2)}</p>
      </div>`;
      return;
    }
    if (sel.kind === "building") {
      const b = sel.obj;
      const def = BUILDINGS[b.type];
      if (b.type === "thermosensor") {
        this._renderThermoInspect(box, b, def);
        return;
      }
      const autoLine = (b.type === "coalgen" || b.type === "liqpump")
        ? `<p class="meta">${b.autoConnected ? (b.autoGreen ? "Automation: Green" : "Automation: Red — held") : "Automation: no wire (always on)"}</p>`
        : (b.type === "notgate" ? `<p class="meta">Output ${b.latchedOut ? "Green" : "Red"} (1-tick delay)</p>` : "");
      box.innerHTML = `<div class="card">
        <h3>${def?.name || b.type}</h3>
        <p>${def?.desc || ""}</p>
        <p class="meta">${b.working ? "Working" : "Idle"} · ${b.powered ? "Powered" : "No power"}</p>
        ${autoLine}
        ${b.type === "battery" ? `<p>Stored ${b.storedJ | 0} J</p>` : ""}
        ${b.type === "farm" ? `<p>Growth ${(Math.min(100, (b.grow / 280) * 100)) | 0}%</p>` : ""}
        <button id="tog-en" class="mini">${b.enabled === false ? "Enable" : "Disable"}</button>
      </div>`;
      const t = box.querySelector("#tog-en");
      if (t) t.onclick = () => { b.enabled = b.enabled === false; };
      return;
    }
  }

  _renderThermoInspect(box, b, def) {
    const liveC = (this.game.world.temp[b.y * this.game.world.w + b.x] - 273.15);
    const threshC = (b.threshold || 293.15) - 273.15;
    const focused = box.querySelector("#th-c") === document.activeElement;
    if (focused && box.dataset.bid === String(b.id)) {
      const live = box.querySelector("#th-live");
      const sig = box.querySelector("#th-sig");
      if (live) live.textContent = `${liveC.toFixed(1)} °C`;
      if (sig) {
        sig.textContent = b.autoGreen ? "Green" : "Red";
        sig.className = b.autoGreen ? "sig-on" : "sig-off";
      }
      return;
    }
    box.dataset.bid = String(b.id);
    box.innerHTML = `<div class="card">
      <h3>${def?.name || "Thermo Sensor"}</h3>
      <p>${def?.desc || ""}</p>
      <p class="meta">Tile <span id="th-live">${liveC.toFixed(1)} °C</span> · Signal <span id="th-sig" class="${b.autoGreen ? "sig-on" : "sig-off"}">${b.autoGreen ? "Green" : "Red"}</span></p>
      <label class="th-label" for="th-c">Green when hotter than</label>
      <div class="th-row">
        <input id="th-c" type="number" step="1" value="${threshC.toFixed(1)}" />
        <span>°C</span>
      </div>
    </div>`;
    const input = box.querySelector("#th-c");
    if (input) {
      const apply = () => {
        const c = parseFloat(input.value);
        if (Number.isFinite(c)) b.threshold = c + 273.15;
      };
      input.addEventListener("input", apply);
      input.addEventListener("change", apply);
    }
  }

  _renderAlerts() {
    const box = this.$("#alerts");
    const items = this.game.alerts.slice(-4);
    box.innerHTML = items.map((a) => `<div class="alert ${a.lvl}">${a.msg}</div>`).join("");
  }

  destroy() {
    this.el.remove();
    this.el = null;
    this.game = null;
  }
}

function template() {
  return `
  <header class="topbar">
    <div class="brand">ASTERHOLD</div>
    <div class="cycle">Cycle <strong id="cycle-num">1</strong></div>
    <div class="res">
      <span title="Metal">⚙ <b id="res-metal">0</b></span>
      <span title="Algae">✦ <b id="res-algae">0</b></span>
      <span title="Coal">● <b id="res-coal">0</b></span>
      <span title="Dirt">▤ <b id="res-dirt">0</b></span>
      <span title="Ice">❄ <b id="res-ice">0</b></span>
      <span title="kcal">🍽 <b id="res-food">0</b></span>
      <span title="Power">⚡ <b id="res-power">0 W</b></span>
    </div>
    <div class="pop">Crew <b id="pop-num">4</b></div>
    <div class="speeds">
      <button id="btn-pause" class="tool">❚❚</button>
      <button id="btn-s1" class="tool on">▶</button>
      <button id="btn-s2" class="tool">▶▶</button>
      <button id="btn-s3" class="tool">▶▶▶</button>
      <em id="speed-label">1×</em>
    </div>
    <div class="fps">FPS <b id="fps-num">60</b></div>
    <button id="btn-help" class="tool" title="Survival Manual">Manual</button>
    <button id="btn-menu" class="tool">☰</button>
  </header>

  <aside class="left">
    <div class="tools">
      <button id="tool-select" class="tool on" title="Select (Esc)">Sel</button>
      <button id="tool-dig" class="tool" title="Dig (G)">Dig</button>
      <button id="tool-decon" class="tool" title="Deconstruct (X)">Salv</button>
      <button id="tool-cancel" class="tool" title="Cancel (C)">Clr</button>
    </div>
    <div class="build">
      <div id="build-cats" class="cats"></div>
      <div id="build-items" class="items"></div>
    </div>
    <div id="tool-hint" class="hint">Select a dupe, building, or tile</div>
  </aside>

  <aside class="right">
    <div class="overlays">
      <button data-overlay="none" class="chip on">None</button>
      <button data-overlay="temp" class="chip">Heat</button>
      <button data-overlay="o2" class="chip">O₂</button>
      <button data-overlay="power" class="chip">Power</button>
      <button data-overlay="plumb" class="chip">Pipes</button>
      <button data-overlay="vent" class="chip">Gas</button>
      <button data-overlay="mat" class="chip">Mats</button>
      <button data-overlay="automation" class="chip">Auto</button>
    </div>
    <div id="inspect"></div>
    <div id="alerts"></div>
  </aside>

  <footer class="crew" id="crew-bar"></footer>

  <div id="title-screen" class="modal open">
    <div class="panel hero">
      <h1>ASTERHOLD</h1>
      <p class="tag">Four survivors. One hollow rock. Keep the air moving.</p>
      <ul class="how">
        <li><b>G</b> dig &nbsp; <b>C</b> cancel &nbsp; <b>WASD</b> pan &nbsp; <b>wheel</b> zoom</li>
        <li>Seal rooms. Wire power. Grow food. Don't freeze.</li>
        <li>Gases stratify by density. Heat conducts through stone.</li>
      </ul>
      <button id="btn-play" class="cta">Drop into the rock</button>
    </div>
  </div>
  <div id="pause-screen" class="modal">
    <div class="panel">
      <h2>Paused</h2>
      <button id="btn-resume" class="cta">Resume</button>
    </div>
  </div>
  <div id="gameover-screen" class="modal">
    <div class="panel">
      <h2>Colony lost</h2>
      <p id="go-msg"></p>
    </div>
  </div>
  <div id="manual-modal" class="modal">
    <div class="panel manual" role="dialog" aria-labelledby="manual-title">
      <header class="manual-head">
        <div>
          <p class="manual-kicker">Field issue · Cycle 1</p>
          <h2 id="manual-title">Survival Manual</h2>
        </div>
        <button id="manual-close" class="tool" title="Close">✕</button>
      </header>
      <nav class="manual-tabs" aria-label="Manual sections">
        <button data-manual-page="0" class="chip on">First 10 min</button>
        <button data-manual-page="1" class="chip">Power &amp; air</button>
        <button data-manual-page="2" class="chip">Wires &amp; pipes</button>
        <button data-manual-page="3" class="chip">Heat &amp; fluids</button>
      </nav>
      <div id="manual-body" class="manual-body"></div>
      <footer class="manual-foot">
        <button id="manual-prev" class="mini">Back</button>
        <span id="manual-pos">1 / 4</span>
        <button id="manual-next" class="cta">Next</button>
      </footer>
    </div>
  </div>
  `;
}

const MANUAL_PAGES = [
  {
    html: `
      <p class="lede">You have four survivors in a sealed pocket of rock. This page is the first ten minutes. The colony is paused until you close the manual.</p>
      <ol class="steps">
        <li>
          <h3>Read the room, don't dig yet</h3>
          <p>The grey box is your habitat. Walls and floor tiles hold the air in. The cyan tiles nearby are ice. Gold-flecked rock is copper ore. Teal slime is algae. The yellow ladder is your only way down.</p>
        </li>
        <li>
          <h3>Watch the top bar and the four crew cards</h3>
          <p>Metal, algae, coal, dirt, ice, kcal, and power live up top. Each dupe card has three bars: <b>cyan oxygen</b>, <b>amber calories</b>, <b>violet rest</b>. If a card glows red, that person is about to die.</p>
        </li>
        <li>
          <h3>Keep the wheel turning</h3>
          <p>The wooden hamster wheel is the Manual Generator. A dupe will walk to it when the grid is hungry. The teal Algae Diffuser needs a constant <b>120 W</b> and a stock of algae. The battery on the left wall only covers short gaps — it is not a power plant.</p>
        </li>
        <li>
          <h3>Do not breach the habitat</h3>
          <p>Press <b>G</b> and drag to designate digging, but leave the room walls intact until you have a <b>Pneumatic Door</b> ready. An open hole dumps every kilogram of oxygen into vacuum.</p>
        </li>
        <li>
          <h3>Minutes 2–5 — mine what you can reach</h3>
          <p>Dig ice (water later), copper ore (metal), slime (algae), and coal (backup generator). Place <b>Ladders</b> as you go down. Use <b>Clr</b> / <b>C</b> if you painted the wrong tiles.</p>
        </li>
        <li>
          <h3>Minutes 5–8 — expand with a door, not a hole</h3>
          <p>Build a <b>Pneumatic Door</b> in a wall, then dig beyond it. Rebuild <b>Habitat Wall</b> and <b>Floor Tile</b> so every new room is sealed. Dupes walk through doors; gases do not, unless the door is open.</p>
        </li>
        <li>
          <h3>Minutes 8–10 — food and a second air plan</h3>
          <p>The two farm plots grow night-cap mushrooms on their own; a dupe harvests when the crop is ready. Starter food is 28,000 kcal, not infinite. When algae drops, start the water loop on the next page. Stay on 1× until the grid is stable.</p>
        </li>
      </ol>
      <p class="keys">Dig <b>G</b> · Cancel <b>C</b> · Salvage <b>X</b> · Pan <b>WASD</b> · Zoom wheel · Pause <b>Space</b> · Speeds <b>1 2 3</b> · Overlays on the right.</p>
    `,
  },
  {
    html: `
      <p class="lede">Starter kit already in the room: Manual Generator, Smart Battery (~9,000 J), Algae Diffuser, and a wire run that already touches all three. Your job is to keep that loop alive, then copy it when you expand.</p>
      <div class="recipe">
        <h3>First power loop — already built</h3>
        <ol>
          <li>Open the <b>Power</b> overlay (amber lines). You should see wire on the floor connecting the wheel, the battery, and the diffuser.</li>
          <li>A dupe must <b>stand in the wheel</b>. Idle crew walk there when any machine is unpowered. Thought text will say “Generating”.</li>
          <li>The wheel makes <b>400 W</b> while operated. The diffuser draws <b>120 W</b> and spends <b>0.035 algae / s</b> to emit <b>18 kg O₂ / s</b> into its own tile.</li>
          <li>Read the top bar as <b>generation / demand W · stored J</b>. Healthy early game looks like <b>400/120W</b> with joules climbing, not falling.</li>
          <li>If stored joules hit 0 and nobody is on the wheel, the diffuser stops and the room starts suffocating. Four people inhale about <b>12.8 kg O₂ / s</b>.</li>
        </ol>
      </div>
      <div class="recipe">
        <h3>If you have to rebuild it</h3>
        <ol>
          <li>Left menu → <b>Power</b> → <b>Manual Generator</b> (120 metal, 2×2). Place it on a floor inside a sealed room.</li>
          <li>Place a <b>Smart Battery</b> (100 metal, 1×2) on the same floor, one or two tiles away.</li>
          <li>Left menu → <b>Oxygen</b> → <b>Algae Diffuser</b> (80 metal, 1×2). Place it in the same sealed room. It dumps oxygen into the tile it occupies — not into pipes.</li>
          <li>Left menu → <b>Power</b> → <b>Conductive Wire</b> (8 metal each). Click every tile in a continuous orthogonal line so the wire <b>touches all three buildings</b>. Diagonals do not connect.</li>
          <li>Confirm with the <b>Power</b> overlay. One amber network = one circuit. Buildings not on that network will show “No power” in the inspect panel.</li>
        </ol>
      </div>
      <div class="recipe">
        <h3>When algae runs out — water to oxygen</h3>
        <ol>
          <li>Dig a pocket of <b>ice</b> and let it melt, or find standing water (blue fill in a cave).</li>
          <li>Place a <b>Liquid Pump</b> so its bottom tiles sit in that water. Wire the pump (120 W).</li>
          <li>Run <b>Liquid Pipe</b> from the pump to an <b>Electrolyzer</b> (or to a <b>Liquid Vent</b> under the electrolyzer).</li>
          <li>The electrolyzer spends water and emits <b>O₂ plus hydrogen</b>. Hydrogen rises. Catch it with a <b>Gas Pump</b> at the ceiling or it will dilute the room.</li>
        </ol>
      </div>
    `,
  },
  {
    html: `
      <p class="lede">There are three independent grids. They never substitute for each other. A pipe will not carry power. A wire will not move water.</p>
      <div class="grid3">
        <article>
          <h3>⚡ Wire</h3>
          <p><b>Power → Conductive Wire</b></p>
          <p>Carries watts. Connects generators, batteries, and any machine with a watt cost (diffuser, pumps, heater, electrolyzer, coal gen).</p>
        </article>
        <article>
          <h3>💧 Liquid pipe</h3>
          <p><b>Plumbing → Liquid Pipe</b></p>
          <p>Carries water packets. <b>Liquid Pump</b> injects from a wet tile. <b>Liquid Vent</b> dumps onto the tile.</p>
        </article>
        <article>
          <h3>💨 Gas pipe</h3>
          <p><b>Oxygen → Gas Pipe</b></p>
          <p>Carries gas packets. <b>Gas Pump</b> sucks the local tile. <b>Gas Vent</b> releases into a room.</p>
        </article>
      </div>
      <div class="recipe">
        <h3>Exact wire rules in this build</h3>
        <ol>
          <li>Click tiles one at a time (or keep placing). Each piece costs 8 metal.</li>
          <li>Two wires join only if they share an edge — north, south, east, or west.</li>
          <li>The building is on the circuit if <b>any of its tiles</b> sits on a wire, or the tile under its origin / opposite corner is wired.</li>
          <li>Use <b>Power</b> overlay to paint the amber conduit. Use <b>Salv</b> / <b>X</b> on a wire tile to rip it up.</li>
          <li>A coal generator is 600 W but dumps <b>CO₂ and heat</b> into its tile. Do not put it in the bedroom.</li>
        </ol>
      </div>
      <div class="recipe">
        <h3>Exact pipe / vent loop</h3>
        <ol>
          <li>Plumbing → <b>Liquid Pump</b> on water. Wire it.</li>
          <li>Plumbing → <b>Liquid Pipe</b> in a continuous path. Check with the <b>Pipes</b> overlay (blue).</li>
          <li>Plumbing → <b>Liquid Vent</b> where the water should pour out. The vent tile must not be solid rock.</li>
          <li>Same three steps for gas: <b>Gas Pump → Gas Pipe → Gas Vent</b>. Overlay is <b>Gas</b> (green).</li>
          <li>Pumps do nothing until they are powered and sitting on the matching pipe/vent layer.</li>
        </ol>
      </div>
    `,
  },
  {
    html: `
      <p class="lede">This is not flavor text. The sim really runs heat and density on typed tile arrays. Plan rooms around these numbers or the crew will freeze, cook, or drown in their own exhaust.</p>
      <div class="recipe">
        <h3>Gases — they stratify</h3>
        <p>Every open tile holds kilograms of each gas. Pressure equalizes into neighbors that are vacuum, ladder, airflow tile, or an <b>open door</b>. Solid rock, walls, floors, and <b>closed doors</b> are airtight.</p>
        <table class="phys">
          <thead><tr><th>Gas</th><th>Density</th><th>What it does here</th></tr></thead>
          <tbody>
            <tr><td>Hydrogen</td><td>0.09</td><td>Rises. Electrolyzer byproduct. Pool it at the ceiling.</td></tr>
            <tr><td>Steam</td><td>0.60</td><td>Rises above oxygen. Condenses back to water below 99 °C.</td></tr>
            <tr><td>Oxygen</td><td>1.43</td><td>The only breathable gas. Dupes drink it from their current tile.</td></tr>
            <tr><td>Carbon dioxide</td><td>1.84</td><td>Sinks. Dupes and the coal generator exhale it onto the floor.</td></tr>
          </tbody>
        </table>
        <p>Build bedrooms up, outhouses and coal plants down. A tall room will naturally put O₂ at head height and CO₂ at the feet — until you overfill it.</p>
      </div>
      <div class="recipe">
        <h3>Liquids — they fall first</h3>
        <p>Water, polluted water, and magma drop into the tile below if there is space, then spill left/right. A tile holds at most <b>1,000 kg</b>. Polluted water comes out of the outhouse. Magma sits at the asteroid core.</p>
      </div>
      <div class="recipe">
        <h3>Heat — neighbors exchange, vacuum does not</h3>
        <p>Each tile has a temperature in kelvin. Heat flows to the four neighbors using the weaker conductivity of the pair. <b>Vacuum with no gas or liquid does not conduct</b>. That is why a sealed air pocket stays warm and a breach flash-freezes.</p>
        <table class="phys">
          <thead><tr><th>Material</th><th>Conducts</th><th>Use</th></tr></thead>
          <tbody>
            <tr><td>Refined metal / wire-like tiles</td><td>Very high</td><td>Heats the whole row. Don't run metal through a cold biome into the bedroom.</td></tr>
            <tr><td>Rock, ore, ice</td><td>Medium</td><td>The asteroid itself is a heat battery. Ice sits near 0 °C.</td></tr>
            <tr><td>Habitat wall / floor</td><td>Low–medium</td><td>Fine for the starter box.</td></tr>
            <tr><td>Insulated Tile</td><td>~0.02</td><td>The only reliable thermal break. Wrap ice boxes and magma.</td></tr>
          </tbody>
        </table>
        <p>Ice melts above <b>0 °C</b> into water. Water freezes back if it gets cold enough and deep enough. Water boils above <b>100 °C</b> into steam. Magma below about <b>1,100 °C</b> freezes into igneous bedrock.</p>
        <p>Open the <b>Heat</b> overlay (blue = cold, green = comfortable, orange/white = deadly) and the <b>O₂</b> overlay before you punch a new shaft. Comfortable living is roughly <b>5–57 °C</b>. Outside that, dupes take damage.</p>
      </div>
    `,
  },
];

function costLabel(cost) {
  if (!cost) return "";
  return Object.entries(cost).map(([k, v]) => `${v} ${k}`).join(" · ");
}

function fmt(n) {
  n = n || 0;
  if (n >= 10000) return (n / 1000).toFixed(1) + "k";
  return n < 10 ? n.toFixed(1) : String(Math.round(n));
}

function clamp(v) { return Math.max(0, Math.min(100, v)); }

function needRow(name, v, col) {
  return `<div class="needrow"><span>${name}</span><span class="bar"><i style="width:${clamp(v)}%;background:${col}"></i></span><em>${v | 0}</em></div>`;
}

function tileCard(world, x, y) {
  const i = y * world.w + x;
  const mat = MATERIALS[world.material[i]];
  const t = world.temp[i];
  const b = buildingAt(world, x, y);
  const gases = GASES.map((g) => ({ n: g.name, v: world.gasAt(i, g.id) })).filter((g) => g.v > 0.4);
  const liqs = LIQUIDS.map((l) => ({ n: l.name, v: world.liqAt(i, l.id) })).filter((l) => l.v > 0.4);
  return `<div class="card">
    <h3>${b ? (BUILDINGS[b.type]?.name || b.type) : mat.name}</h3>
    <p class="meta">${x}, ${y} · ${(t - 273.15).toFixed(1)} °C</p>
    ${gases.map((g) => `<p>${g.n} ${g.v.toFixed(1)} kg</p>`).join("")}
    ${liqs.map((l) => `<p>${l.n} ${l.v.toFixed(0)} kg</p>`).join("")}
    ${world.wire[i] ? "<p>Wire</p>" : ""}
    ${world.pipe[i] ? "<p>Liquid pipe</p>" : ""}
    ${world.vent[i] ? "<p>Gas pipe</p>" : ""}
    ${world.automationWire[i] ? `<p>Automation ${world.autoSignal[i] ? "Green" : "Red"}</p>` : ""}
  </div>`;
}
