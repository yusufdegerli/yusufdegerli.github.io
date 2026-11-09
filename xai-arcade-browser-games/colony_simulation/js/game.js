/** @file Game orchestration: sim ticks, commands, selection. */

import { TILE, STARTER, CYCLE_TICKS, TICK_DT, BUILDINGS, WORLD_W, WORLD_H } from "./sim/constants.js";
import { World } from "./sim/world.js";
import { generateAsteroid } from "./sim/procgen.js";
import { stepHeat } from "./sim/heat.js";
import { stepFluids } from "./sim/fluids.js";
import { updateFallingBlocks } from "./sim/falling.js";
import { Networks } from "./sim/networks.js";
import { placeStarter, buildingAt, canPlace } from "./sim/buildings.js";
import { tickBuildings } from "./sim/buildings.js";
import { JobBoard } from "./sim/jobs.js";
import { spawnCrew, updateColonists } from "./sim/colonists.js";
import { GameLoop } from "./engine/loop.js";
import { Camera } from "./engine/camera.js";
import { Input } from "./engine/input.js";
import { Assets } from "./engine/assets.js";
import { Particles } from "./engine/particles.js";
import { Renderer } from "./engine/renderer.js";
import { HUD } from "./ui/hud.js";

export class Game {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.destroyed = false;
    this.started = false;
    this.speed = 0;
    this.simAcc = 0;
    this.tickCount = 0;
    this.cycle = 0;
    this.tool = "select";
    this.buildType = null;
    this.overlay = "none";
    this.selected = null;
    this.hover = null;
    this.drag = null;
    this.alerts = [];
    this.stats = { fps: 60, simMs: 0, drawMs: 0 };
    this.resources = { ...STARTER };
    this.crew = [];

    container.classList.add("asterhold-root");
    container.innerHTML = "";
    this.stage = document.createElement("div");
    this.stage.className = "stage";
    this.canvas = document.createElement("canvas");
    this.canvas.tabIndex = 0;
    this.stage.appendChild(this.canvas);
    container.appendChild(this.stage);

    this.world = new World();
    this.spawn = generateAsteroid(this.world, options.seed);
    this.particles = new Particles();
    this.networks = new Networks(this.world);
    this.jobs = new JobBoard(this.world, this.resources, this.particles);
    placeStarter(this.world);
    this.crew = spawnCrew(this.world);
    this.networks.rebuild();

    this.assets = new Assets();
    this.camera = new Camera();
    this.camera.focus(this.spawn.x, this.spawn.y);
    this.loop = new GameLoop();
    this.renderer = null;
    this.input = null;
    this.hud = null;

    this._onResize = this._resize.bind(this);
    window.addEventListener("resize", this._onResize);
  }

  async boot() {
    this.hud = new HUD(this.container, this);
    this.hud.beginHidden();
    try {
      await this.assets.loadAll();
    } catch (err) {
      console.warn("Asset load issue", err);
    }
    this.renderer = new Renderer(this.canvas, this.assets);
    this.input = new Input(this.canvas, this.camera);
    this._bindInput();
    this._resize();
    this.loop.onUpdate = (dt) => this.update(dt);
    this.loop.onRender = (dt) => this.render(dt);
    this.loop.start();
    this.hud.setSpeed(0);
    this.pushAlert("info", "Crew sealed in. The rock is listening.");
    return this;
  }

  begin() {
    this.started = true;
    this.hud.hideTitle();
    this.hud.showManual(true);
    this.canvas.focus();
  }

  _resize() {
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.camera.resize(r.width, r.height);
    if (this.renderer) this.renderer.resize(r.width, r.height, dpr);
    if (this.spawn && !this._framed) {
      this.camera.focus(this.spawn.x, this.spawn.y - 1);
      this._framed = true;
    }
  }

  _bindInput() {
    this.input.on("move", ({ tile, drag }) => {
      this.hover = tile;
      if (drag && !drag.pan) this.drag = drag;
    });
    this.input.on("down", (e) => {
      if (e.button === 2) {
        this.setTool("select");
        return;
      }
      if (e.button === 0 && !e.pan) {
        this.drag = e;
        if (this.tool === "select") this._clickSelect(e.x0, e.y0);
        if (this.tool.startsWith("build:")) {
          this.jobs.queueBuild(this.buildType, e.x0, e.y0);
          this.jobs.syncFromDesignations();
        }
      }
    });
    this.input.on("up", (e) => {
      if (e.pan || e.button === 1) { this.drag = null; return; }
      if (e.button === 0) {
        if (this.tool === "dig") this.jobs.paintDig(e.x0, e.y0, e.x1, e.y1);
        if (this.tool === "decon") this.jobs.paintDecon(e.x0, e.y0, e.x1, e.y1);
        if (this.tool === "cancel") this.jobs.cancelRect(e.x0, e.y0, e.x1, e.y1);
      }
      this.drag = null;
    });
    this.input.on("key", ({ key, down }) => {
      if (!down) return;
      const k = key.toLowerCase();
      if (k === "escape") {
        if (this.hud?.manualOpen) {
          this.hud.showManual(false);
          return;
        }
        this.setTool("select");
        return;
      }
      if (this.hud?.manualOpen) return;
      if (k === " ") { this.setSpeed(this.speed === 0 ? 1 : 0); }
      if (k === "1") this.setSpeed(1);
      if (k === "2") this.setSpeed(3);
      if (k === "3") this.setSpeed(8);
      if (k === "g") this.setTool("dig");
      if (k === "c") this.setTool("cancel");
      if (k === "x") this.setTool("decon");
      if (k === "f1") this.setOverlay("temp");
      if (k === "f2") this.setOverlay("o2");
      if (k === "f3") this.setOverlay("power");
      if (k === "f4") this.setOverlay("plumb");
      if (k === "f5") this.setOverlay("vent");
      if (k === "f6") this.setOverlay("mat");
      if (k === "f7") this.setOverlay("automation");
    });
  }

  _clickSelect(x, y) {
    const dupe = this.crew.find((c) => c.alive && Math.abs(c.tx - x) <= 0 && Math.abs(c.ty - y) <= 1);
    const near = this.crew.find((c) => c.alive && Math.hypot(c.x / TILE - x - 0.5, c.y / TILE - y - 1) < 0.8);
    const pick = dupe || near;
    if (pick) {
      this.selectColonist(pick);
      return;
    }
    const b = buildingAt(this.world, x, y);
    if (b) {
      this.selected = { kind: "building", obj: b };
      this.crew.forEach((c) => { c.selected = false; });
      return;
    }
    this.selected = { kind: "tile", x, y };
    this.crew.forEach((c) => { c.selected = false; });
  }

  selectColonist(c) {
    this.crew.forEach((d) => { d.selected = d === c; });
    this.selected = { kind: "colonist", obj: c };
    this.camera.focus(c.tx, c.ty);
  }

  setTool(tool) {
    this.tool = tool;
    this.buildType = tool.startsWith("build:") ? tool.slice(6) : null;
    if (this.hud) this.hud.setTool(tool);
  }

  setOverlay(name) {
    this.overlay = this.overlay === name && name !== "none" ? "none" : name;
    if (this.hud) this.hud.setOverlay(this.overlay);
  }

  setSpeed(s) {
    this.speed = s;
    if (this.hud) {
      this.hud.setSpeed(s);
      this.hud.showPause(false);
    }
  }

  update(dt) {
    if (this.destroyed) return;
    const cam = this.camera;
    const spd = 420 * dt;
    if (this.input) {
      if (this.input.held("w") || this.input.held("arrowup")) cam.pan(0, -spd);
      if (this.input.held("s") || this.input.held("arrowdown")) cam.pan(0, spd);
      if (this.input.held("a") || this.input.held("arrowleft")) cam.pan(-spd, 0);
      if (this.input.held("d") || this.input.held("arrowright")) cam.pan(spd, 0);
    }
    cam.update(dt);

    if (this.speed <= 0 || !this.started) {
      this.particles.update(dt * 0.3);
      if (this.hud) this.hud.update(dt);
      return;
    }

    const simDt = dt * this.speed;
    this.simAcc += simDt;
    const t0 = performance.now();
    let guard = 0;
    while (this.simAcc >= TICK_DT && guard++ < 8) {
      this.simTick(TICK_DT);
      this.simAcc -= TICK_DT;
    }
    this.stats.simMs = performance.now() - t0;
    this.particles.update(simDt);
    if (this.hud) this.hud.update(dt);
  }

  simTick(dt) {
    this.tickCount++;
    if (this.tickCount % CYCLE_TICKS === 0) {
      this.cycle++;
      this.pushAlert("info", `Cycle ${this.cycle + 1} begins.`);
    }
    stepFluids(this.world, dt);
    stepHeat(this.world, dt);
    this.networks.step(dt, this.resources);
    tickBuildings(this.world, dt, this.resources, this.networks, this.particles);
    this.jobs.syncFromDesignations();
    this.jobs.harvestJobs();
    updateColonists(this.crew, this.world, this.jobs, this.resources, dt, this.particles);
    updateFallingBlocks(this.world, this.crew);
    this._scanAlerts(dt);

    const live = this.crew.filter((c) => c.alive);
    if (this.started && live.length === 0) {
      this.setSpeed(0);
      this.hud?.showGameOver("The last survivor is gone. The asteroid keeps its silence.");
    }
  }

  _scanAlerts(dt) {
    if (this.tickCount % 20 !== 0) return;
    const live = this.crew.filter((c) => c.alive);
    if (live.some((c) => c.needs.o2 < 25)) this.pushAlert("bad", "Someone is suffocating.");
    if (live.some((c) => c.needs.cal < 18)) this.pushAlert("bad", "The larder is failing.");
    const demand = this.networks.circuits.reduce((s, c) => s + (c.demandW || 0), 0);
    const power = this.networks.circuits.reduce((s, c) => s + (c.powerW || 0) + ((c.storedJ || 0) > 10 ? 1 : 0), 0);
    if (demand > 0 && power < demand * 0.4) this.pushAlert("warn", "The grid is starving.");
    if (this.resources.algae < 8) this.pushAlert("warn", "Algae reserves are nearly gone.");
  }

  pushAlert(lvl, msg) {
    const last = this.alerts[this.alerts.length - 1];
    if (last && last.msg === msg && this.tickCount - last.t < 80) return;
    this.alerts.push({ lvl, msg, t: this.tickCount });
    if (this.alerts.length > 12) this.alerts.shift();
  }

  render(dt) {
    if (this.destroyed || !this.renderer) return;
    const t0 = performance.now();
    this.stats.fps = this.loop.fps;
    this.renderer.render({
      world: this.world,
      camera: this.camera,
      crew: this.crew,
      particles: this.particles,
      tool: this.tool,
      buildType: this.buildType,
      hover: this.hover,
      drag: this.drag,
      overlay: this.overlay,
      selected: this.selected,
    }, dt);
    this.stats.drawMs = performance.now() - t0;
  }

  getApi() {
    return {
      unmount: () => this.destroy(),
      pause: () => this.setSpeed(0),
      resume: () => this.setSpeed(1),
      setSpeed: (s) => this.setSpeed(s),
      getState: () => ({
        cycle: this.cycle,
        resources: { ...this.resources },
        population: this.crew.filter((c) => c.alive).length,
        seed: this.world.seed,
      }),
      game: this,
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loop.stop();
    window.removeEventListener("resize", this._onResize);
    this.input?.detach();
    this.particles?.destroy();
    this.renderer?.destroy();
    this.assets?.destroy();
    this.hud?.destroy();
    this.crew.length = 0;
    this.world.buildings.length = 0;
    this.jobs.jobs.length = 0;
    this.alerts.length = 0;
    this.container.replaceChildren();
    this.container.classList.remove("asterhold-root");
    this.world = null;
    this.renderer = null;
    this.input = null;
    this.hud = null;
  }
}
