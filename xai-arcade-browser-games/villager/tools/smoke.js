#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

class Ctx {
  constructor() {
    this.fillStyle = "";
    this.strokeStyle = "";
    this.globalAlpha = 1;
    this.lineWidth = 1;
    this.font = "";
    this.textAlign = "";
  }
  setTransform() {}
  fillRect() {}
  strokeRect() {}
  clearRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  fill() {}
  stroke() {}
  save() {}
  restore() {}
  translate() {}
  drawImage() {}
  setLineDash() {}
  fillText() {}
}

function canvas() {
  return {
    width: 64,
    height: 64,
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    getContext() {
      return new Ctx();
    },
    addEventListener() {},
    setPointerCapture() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 600 };
    },
    clientWidth: 800,
    clientHeight: 600,
  };
}

const els = {};
function el(id) {
  if (els[id]) return els[id];
  const node = {
    id,
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    innerHTML: "",
    textContent: "",
    appendChild() {},
    addEventListener() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 196, height: 196 };
    },
  };
  if (id === "world" || id === "minimap") Object.assign(node, canvas());
  els[id] = node;
  return node;
}

const sandbox = {
  console,
  Math,
  setTimeout: () => 0,
  clearTimeout: () => {},
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  AudioContext: class {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.state = "running";
      this.destination = {};
    }
    resume() {}
    createGain() {
      return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
    createOscillator() {
      return {
        type: "sine",
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
    }
    createBiquadFilter() {
      return { type: "lowpass", frequency: { value: 0, setValueAtTime() {} }, Q: { value: 1 }, connect() {} };
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(8) };
    }
    createBufferSource() {
      return { buffer: null, connect() {}, start() {}, stop() {} };
    }
  },
  document: {
    getElementById: el,
    createElement(tag) {
      if (tag === "canvas") return canvas();
      return el("el-" + Math.random());
    },
    addEventListener() {},
    body: { appendChild() {} },
  },
  window: {
    addEventListener() {},
    devicePixelRatio: 1,
    innerWidth: 800,
    innerHeight: 600,
    AudioContext: null,
  },
  location: { search: "" },
  Image: class {},
  URLSearchParams: class {
    has() {
      return false;
    }
  },
};

sandbox.window.AudioContext = sandbox.AudioContext;
sandbox.window.document = sandbox.document;
sandbox.window.performance = sandbox.performance;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const root = path.join(__dirname, "..");
const files = [
  "js/config.js",
  "js/utils.js",
  "js/audio.js",
  "js/camera.js",
  "js/input.js",
  "js/pathfinding.js",
  "js/sprites.js",
  "js/map.js",
  "js/entities.js",
  "js/ai.js",
  "js/render.js",
  "js/ui.js",
  "js/game.js",
];

const ctx = vm.createContext(sandbox);
const bundled =
  files.map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n") +
  "\n;this.__G = { Game, Ent, UNIT, BLD, U, CFG, World, AI };";
vm.runInContext(bundled, ctx, { filename: "bundle.js" });

const { Game, Ent, UNIT, BLD, U, CFG, World, AI } = ctx.__G;
Game.boot();
Game.newMatch();

const fails = [];
const ok = (cond, msg) => {
  if (!cond) fails.push(msg);
};

const workers = Ent.list.filter((e) => e.owner === 0 && e.type === "worker");
const hall = Ent.list.find((e) => e.owner === 0 && e.type === "hall");
const trees = Ent.list.filter((e) => e.kind === "resource" && e.type === "wood");
const enemyHall = Ent.list.find((e) => e.owner === 1 && e.type === "hall");

ok(workers.length === CFG.start.workers, "start workers " + workers.length);
ok(!!hall, "player hall");
ok(!!enemyHall, "enemy hall");
ok(trees.length > 5, "trees " + trees.length);
ok(Game.players[0].res.food === 200, "start food");

const tree = Ent.nearest(Ent.list, workers[0].x, workers[0].y, (e) => e.kind === "resource" && e.type === "wood");
ok(!!tree, "nearest tree");
Ent.issueGather(workers, tree);

const wood0 = Game.players[0].res.wood;
for (let i = 0; i < 900; i++) Game.tick(0.05);

const wood1 = Game.players[0].res.wood;
const gathering = workers.filter((w) => w.state === "gather" || w.state === "return" || w.carryAmount > 0);
ok(gathering.length > 0 || wood1 > wood0, "workers gather or deposit");
ok(wood1 > wood0 || workers.some((w) => w.carryAmount > 0), "wood produced or carried (wood " + wood0 + " -> " + wood1 + ", carry " + workers.map((w) => w.carryAmount) + ")");

const open = (tx, ty) => {
  for (let r = 0; r < 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        if (World.in(x, y) && !World.block[World.idx(x, y)]) return U.tileCenter(x, y);
      }
    }
  }
  return { x: hall.x + 80, y: hall.y + hall.h + 80 };
};

let ltx = null;
let lty = null;
for (let oy = 0; oy < 12 && ltx == null; oy++) {
  for (let ox = 0; ox < 12 && ltx == null; ox++) {
    const tx = hall.tx + ox;
    const ty = hall.ty + BLD.hall.size + 1 + oy;
    if (World.canPlace(tx, ty, BLD.lumber.size)) {
      ltx = tx;
      lty = ty;
    }
  }
}
ok(ltx != null, "found lumber site");
if (ltx != null) {
  const camp = Ent.building("lumber", 0, ltx, lty, true);
  ok(Ent.acceptsDrop(camp, "wood"), "lumber camp takes wood");
  ok(!Ent.acceptsDrop(camp, "gold"), "lumber camp rejects gold");
  let mtx = null;
  let mty = null;
  for (let oy = 0; oy < 12 && mtx == null; oy++) {
    for (let ox = 0; ox < 12 && mtx == null; ox++) {
      const tx = hall.tx + ox;
      const ty = lty + BLD.lumber.size + 1 + oy;
      if (World.canPlace(tx, ty, BLD.mining.size)) {
        mtx = tx;
        mty = ty;
      }
    }
  }
  if (mtx != null) {
    const miner = Ent.building("mining", 0, mtx, mty, true);
    ok(Ent.acceptsDrop(miner, "gold"), "mining camp takes gold");
    ok(!Ent.acceptsDrop(miner, "wood"), "mining camp rejects wood");
  }
  const carrier = Ent.unit("worker", 0, camp.x + camp.w + 16, camp.y + camp.h + 8);
  carrier.carryType = "wood";
  carrier.carryAmount = 10;
  const drop = Ent.nearestDrop(carrier);
  ok(drop && drop.type === "lumber", "wood hauler prefers lumber camp, got " + (drop && drop.type));
}

const a = open(hall.tx, hall.ty + BLD.hall.size + 3);
const dummy = Ent.unit("militia", 1, a.x, a.y);
const soldier = Ent.unit("militia", 0, a.x + 16, a.y);
Ent.issueAttack([soldier], dummy);
const hp0 = dummy.hp;
for (let i = 0; i < 160; i++) Game.tick(0.05);
ok(dummy.hp < hp0 || dummy.dead, "soldier damages enemy (" + hp0 + " -> " + dummy.hp + ")");

const near = U.tileAt(workers[0].x + CFG.tile * 2, workers[0].y + CFG.tile * 2);
let placed = null;
for (let oy = 0; oy < 8 && !placed; oy++) {
  for (let ox = 0; ox < 8 && !placed; ox++) {
    const tx = near.tx + ox;
    const ty = near.ty + oy;
    if (World.canPlace(tx, ty, BLD.house.size)) {
      Game.players[0].res.wood += 100;
      placed = Ent.building("house", 0, tx, ty, false);
      const stand = Ent.approachPoint({ x: placed.x + placed.w + 8, y: placed.y + placed.h + 8, r: 10 }, placed, 0);
      const builder = Ent.unit("worker", 0, stand.x, stand.y);
      Ent.issueBuild([builder], placed);
    }
  }
}
ok(!!placed, "placed a house");
if (placed) {
  for (let i = 0; i < 500; i++) Game.tick(0.05);
  ok(placed.construct > 0.05 || placed.built, "house construction progresses " + placed.construct);
}

ok(CFG.mapW >= 90 && CFG.mapH >= 90, "map is larger");
ok(Game.isHostile(0, 1) && Game.isHostile(1, 2) && Game.isHostile(1, 0), "factions are hostile");
ok(!Game.isHostile(4, 0) && Game.isHostile(0, 4), "neutrals do not attack, others can raid");
ok(Ent.list.filter((e) => e.owner === 4 && e.type === "hall").length >= 3, "neutral villages spawned");
ok(Game.players.filter((p) => p.kind === "ai").length >= 3, "three AI factions");
ok(UNIT.archer.age === 2, "archer is Iron Age");
{
  const far = { x: hall.x - 80, y: hall.y + hall.h * 0.5, r: 11 };
  const near = { x: hall.x - 8, y: hall.y + hall.h * 0.5, r: 11 };
  const gapFar = Ent.rectClearance(far.x, far.y, hall.x, hall.y, hall.w, hall.h);
  const gapNear = Ent.rectClearance(near.x, near.y, hall.x, hall.y, hall.w, hall.h);
  ok(gapFar > 20, "far unit is outside melee vs hall (" + gapFar + ")");
  ok(gapNear <= 20, "near unit is in melee vs hall (" + gapNear + ")");
}
ok(!!UNIT.mage && !!UNIT.spearman && !!UNIT.knight, "new roster exists");

{
  const squad = [];
  for (let i = 0; i < 6; i++) squad.push(Ent.unit("militia", 0, hall.x + 30 + i * 3, hall.y + hall.h + 40));
  Ent.issueMove(squad, hall.x + 220, hall.y + hall.h + 90);
  const keys = new Set(squad.map((u) => ((u.formDest.x / 18) | 0) + ":" + ((u.formDest.y / 18) | 0)));
  ok(keys.size === 6, "formation slots unique (" + keys.size + ")");
}

{
  let ttx = null;
  let tty = null;
  for (let oy = 0; oy < 12 && ttx == null; oy++) {
    for (let ox = 0; ox < 12 && ttx == null; ox++) {
      const tx = hall.tx + 8 + ox;
      const ty = hall.ty + oy;
      if (World.canPlace(tx, ty, BLD.tower.size)) {
        ttx = tx;
        tty = ty;
      }
    }
  }
  if (ttx != null) {
    const spy = Ent.building("tower", 1, ttx, tty, true);
    World.reveal(0, Ent.cx(spy), Ent.cy(spy), 3);
    World.snapshotFog();
    ok(World.memory.has(spy.id), "enemy building snapshotted");
    World.clearVis(0);
    Ent.kill(spy);
    World.snapshotFog();
    ok(World.memory.has(spy.id), "memory remains after unseen destroy");
  }
}
ok(BLD.mill.drops.indexOf("food") !== -1, "mill takes food");

let farm = null;
for (let oy = 0; oy < 10 && !farm; oy++) {
  for (let ox = 0; ox < 10 && !farm; ox++) {
    const tx = hall.tx + ox;
    const ty = hall.ty + BLD.hall.size + 3 + oy;
    if (World.canPlace(tx, ty, BLD.farm.size)) farm = Ent.building("farm", 0, tx, ty, true);
  }
}
ok(!!farm && farm.amount === CFG.farm.stock, "instant farm is seeded");
if (farm) {
  const miller = Ent.unit("worker", 0, farm.x + farm.w + 14, farm.y + farm.h + 8);
  Game.players[0].res.food = 0;
  Ent.issueGather([miller], farm);
  for (let i = 0; i < 250; i++) Game.tick(0.05);
  ok(miller.carryType === "food" || Game.players[0].res.food > 0, "farm produces food");
  farm.amount = 0;
  Game.players[0].res.wood += 40;
  ok(Ent.reseedFarm(farm, 0) && farm.amount === CFG.farm.stock, "replant restocks farm");
}

ok(AI.brains.length >= 3 && AI.inGrace(AI.brains[0]), "AI starts in grace");
ok(!Ent.list.some((e) => e.owner === 1 && e.type === "militia"), "enemy starts with no militia");

const wounded = Ent.unit("militia", 0, hall.x + 80, hall.y + hall.h + 40);
wounded.hp = 20;
const priest = Ent.unit("priest", 0, wounded.x + 20, wounded.y);
Ent.issueHeal([priest], wounded);
for (let i = 0; i < 80; i++) Game.tick(0.05);
ok(wounded.hp > 20, "priest heals (" + wounded.hp + ")");

hall.hp = hall.maxHp * 0.5;
const fixer = Ent.unit("worker", 0, hall.x + hall.w + 16, hall.y + hall.h + 8);
Ent.issueRepair([fixer], hall);
for (let i = 0; i < 80; i++) Game.tick(0.05);
ok(hall.hp > hall.maxHp * 0.5, "worker repairs hall (" + hall.hp + ")");
ok(Game.damagedBuilding(0) === hall || hall.hp < hall.maxHp, "repair targets hall first");

{
  const pinchTx = U.clamp(hall.tx + 10, 2, CFG.mapW - 6);
  const pinchTy = U.clamp(hall.ty + 4, 2, CFG.mapH - 6);
  World.setBlocked(pinchTx, pinchTy, true);
  World.setBlocked(pinchTx + 1, pinchTy + 1, true);
  const startX = (pinchTx + 1) * CFG.tile + 4;
  const startY = (pinchTy + 1) * CFG.tile + 4;
  const trapped = Ent.unit("worker", 0, startX, startY);
  const goal = U.tileCenter(pinchTx + 4, pinchTy);
  Ent.issueMove([trapped], goal.x, goal.y);
  for (let i = 0; i < 160; i++) Game.tick(0.05);
  ok(World.walkableWorld(trapped.x, trapped.y), "worker left blocked pinch");
  ok(U.dist(trapped.x, trapped.y, startX, startY) > 12, "worker moved out of stone gap");
}

console.log(
  JSON.stringify(
    {
      wood0,
      wood1,
      states: workers.map((w) => w.state),
      carry: workers.map((w) => w.carryAmount),
      ents: Ent.list.length,
      hallHp: enemyHall.hp,
      fails,
    },
    null,
    2
  )
);

if (fails.length) {
  console.error("SMOKE FAIL");
  process.exit(1);
}
console.log("SMOKE OK");
