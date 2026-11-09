/** @file Survivor agents: needs, movement, job AI. */

import { COLONIST_DEFS, TILE, GAS, BUILDINGS } from "./constants.js";
import { findPath, adjacentTo, nearestStand } from "./pathfinding.js";

let _cid = 1;

export function spawnCrew(world, defs = COLONIST_DEFS) {
  const crew = [];
  const s = world.spawn;
  const spots = [
    { x: s.x - 2, y: s.y },
    { x: s.x - 1, y: s.y },
    { x: s.x + 1, y: s.y },
    { x: s.x + 2, y: s.y },
  ];
  defs.forEach((def, i) => {
    const p = spots[i] || { x: s.x, y: s.y };
    const stand = nearestStand(world, p.x, p.y) || p;
    crew.push(makeColonist(def, stand.x, stand.y));
  });
  return crew;
}

export function makeColonist(def, x, y) {
  return {
    id: _cid++,
    defId: def.id,
    name: def.name,
    sprite: def.sprite,
    hair: def.hair,
    suit: def.suit,
    skill: { ...def.skill },
    x: x * TILE + TILE * 0.5,
    y: y * TILE + TILE,
    tx: x,
    ty: y,
    facing: 1,
    path: null,
    pathI: 0,
    job: null,
    state: "idle",
    anim: 0,
    walk: 0,
    needs: { o2: 100, cal: 80 + Math.random() * 15, sleep: 70 + Math.random() * 20, bladder: 60 + Math.random() * 30, morale: 70 },
    stress: 0,
    alive: true,
    hp: 100,
    operatorOf: null,
    thought: "Ready.",
    selected: false,
    shadow: true,
    ghostSleep: false,
  };
}

export function updateColonists(crew, world, jobs, resources, dt, particles) {
  for (const c of crew) {
    if (!c.alive) continue;
    if (c.state === "sleep" && !c.ghostSleep && !cotStillThere(c, world)) {
      c.ghostSleep = true;
      c.path = null;
      c.job = null;
      c.shadow = false;
    }
    if (c.ghostSleep) {
      c.state = "sleep";
      c.thought = "Zzz";
      c.needs.sleep = 100;
      c.anim += dt;
      continue;
    }
    updateNeeds(c, world, dt);
    if (c.hp <= 0) {
      killColonist(c, crew, jobs, particles);
      continue;
    }
    think(c, world, jobs, resources, dt);
    move(c, world, dt);
    c.anim += dt;
    if (c.state === "walk") c.walk += dt * 8;
    openNearbyDoors(c, world);
  }
}

function cotStillThere(c, world) {
  return !!(c.operatorOf && world.buildings.includes(c.operatorOf));
}

function updateNeeds(c, world, dt) {
  const i = c.ty * world.w + c.tx;
  const o2 = world.in(c.tx, c.ty) ? world.gasAt(i, GAS.O2) : 0;
  const inhale = 3.2 * dt;
  if (o2 > inhale) {
    world.addGas(i, GAS.O2, -inhale);
    world.addGas(i, GAS.CO2, inhale * 0.85);
    c.needs.o2 = Math.min(100, c.needs.o2 + dt * 18);
  } else {
    c.needs.o2 -= dt * 14;
    c.thought = "Can't breathe!";
    c.hp -= dt * 8;
    c.stress += dt * 10;
  }

  c.needs.cal -= dt * 0.55;
  c.needs.sleep -= dt * 0.42;
  c.needs.bladder -= dt * 0.28;

  const t = world.in(c.tx, c.ty) ? world.temp[i] : 280;
  if (t < 278) {
    c.stress += dt * 3;
    c.hp -= dt * 1.2;
    if (c.needs.o2 > 30) c.thought = "Freezing...";
  } else if (t > 345) {
    c.stress += dt * 3;
    c.hp -= dt * 1.4;
    if (c.needs.o2 > 30) c.thought = "Too hot!";
  } else {
    c.stress = Math.max(0, c.stress - dt * 1.2);
  }

  if (c.needs.cal < 15) {
    c.hp -= dt * 2;
    c.thought = "Starving";
  }
  if (c.needs.sleep < 8) {
    c.hp -= dt * 0.4;
    c.thought = "Exhausted";
  }
  c.needs.morale = Math.max(0, Math.min(100, 80 - c.stress + (c.needs.cal - 50) * 0.1));
}

function think(c, world, jobs, resources, dt) {
  if (c.needs.o2 < 25) {
    seekOxygen(c, world);
    return;
  }
  if (c.needs.sleep < 18 && c.state !== "sleep") {
    if (seekBuilding(c, world, "cot")) return;
  }
  if (c.needs.cal < 28 && c.state !== "eat") {
    if (resources.food > 200) {
      if (seekBuilding(c, world, "table") || seekBuilding(c, world, "storage")) {
        c.state = "eat";
        return;
      }
    }
  }
  if (c.needs.bladder < 15 && c.state !== "toilet") {
    if (seekBuilding(c, world, "outhouse")) {
      c.state = "toilet";
      return;
    }
  }

  if (c.state === "sleep") {
    if (!cotStillThere(c, world)) {
      c.ghostSleep = true;
      c.thought = "Zzz";
      c.needs.sleep = 100;
      c.path = null;
      return;
    }
    c.needs.sleep = Math.min(100, c.needs.sleep + dt * 12);
    c.thought = "Zzz";
    if (c.needs.sleep > 92) {
      releaseBuilding(c, world);
      c.state = "idle";
    }
    return;
  }
  if (c.state === "eat") {
    if (arrived(c)) {
      const bite = Math.min(1600 * dt, resources.food, (100 - c.needs.cal) * 40);
      resources.food -= bite;
      c.needs.cal = Math.min(100, c.needs.cal + bite / 40);
      c.thought = "Eating";
      if (c.needs.cal > 92 || resources.food < 10) {
        releaseBuilding(c, world);
        c.state = "idle";
      }
    }
    return;
  }
  if (c.state === "toilet") {
    if (arrived(c)) {
      const b = buildingAtPos(world, c.tx, c.ty, "outhouse") || nearBuilding(world, c.tx, c.ty, "outhouse");
      if (b) {
        b.operator = c;
        c.thought = "Occupied";
        if (c.needs.bladder > 95) {
          b.operator = null;
          c.state = "idle";
        }
      }
    }
    return;
  }

  if (!c.job) jobs.claim(c);
  if (!c.job) {
    const gridHungry = world.buildings.some((b) => {
      const d = BUILDINGS[b.type];
      return d && d.power && b.enabled !== false && !b.powered;
    });
    const gen = world.buildings.find((b) => (b.type === "generator" || b.type === "coalgen") && !b.operator);
    if (gen && (gridHungry || Math.random() < dt * 0.12)) {
      goTo(c, world, gen.x, gen.y + gen.h - 1);
      c.state = "operate";
      c.job = { type: "operate", building: gen, x: gen.x, y: gen.y + gen.h - 1, assigned: c, done: false };
      gen.operator = c;
      c.thought = "Heading to power";
      return;
    }
    c.state = "idle";
    c.thought = "Idle";
    return;
  }

  const job = c.job;
  if (job.type === "operate") {
    const b = job.building;
    if (!b || !b.enabled) {
      if (b) b.operator = null;
      c.job = null;
      c.state = "idle";
      return;
    }
    if (arrived(c)) {
      b.operator = c;
      b.working = true;
      c.state = "operate";
      c.thought = b.type === "generator" ? "Generating" : "Operating";
    } else {
      goTo(c, world, job.x, job.y);
    }
    return;
  }

  const dest = adjacentTo(world, job.x, job.y, c);
  if (dest) goTo(c, world, dest.x, dest.y);
  if (nearTile(c, job.x, job.y)) {
    c.state = "work";
    c.thought = job.type === "dig" ? "Digging" : job.type === "build" ? "Building" : "Working";
    const sk = job.type === "dig" ? c.skill.dig : job.type === "build" ? c.skill.build : c.skill.operate;
    jobs.work(c, job, dt, sk);
  } else {
    c.state = "walk";
    c.thought = "On my way";
  }
}

function seekOxygen(c, world) {
  let best = null, ba = 0;
  const x0 = Math.max(0, c.tx - 14), x1 = Math.min(world.w - 1, c.tx + 14);
  const y0 = Math.max(0, c.ty - 10), y1 = Math.min(world.h - 1, c.ty + 10);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!world.canStand(x, y)) continue;
      const o = world.gasAt(y * world.w + x, GAS.O2);
      if (o > ba) { ba = o; best = { x, y }; }
    }
  }
  if (best) {
    goTo(c, world, best.x, best.y);
    c.state = "walk";
    c.thought = "Seeking air";
  }
}

function seekBuilding(c, world, type) {
  const b = world.buildings.find((k) => k.type === type && !k.occupied);
  if (!b) return false;
  b.occupied = c.id;
  c.operatorOf = b;
  goTo(c, world, b.x, b.y + b.h - 1);
  if (type === "cot") c.state = "sleep";
  return true;
}

function releaseBuilding(c, world) {
  if (c.operatorOf) {
    if (c.operatorOf.occupied === c.id) c.operatorOf.occupied = null;
    if (c.operatorOf.operator === c) c.operatorOf.operator = null;
    c.operatorOf = null;
  }
  for (const b of world.buildings) {
    if (b.occupied === c.id) b.occupied = null;
    if (b.operator === c) b.operator = null;
  }
}

function buildingAtPos(world, x, y, type) {
  return world.buildings.find((b) => b.type === type && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}

function nearBuilding(world, x, y, type) {
  return world.buildings.find((b) => b.type === type && Math.abs(b.x - x) <= 1 && Math.abs(b.y + b.h - 1 - y) <= 1);
}

function goTo(c, world, x, y) {
  if (c.path && c.path.length && c._gx === x && c._gy === y) return;
  c._gx = x; c._gy = y;
  const path = findPath(world, c.tx, c.ty, x, y);
  c.path = path;
  c.pathI = 1;
  if (path && path.length > 1) c.state = "walk";
}

function arrived(c) {
  return !c.path || c.pathI >= (c.path?.length || 0);
}

function nearTile(c, x, y) {
  return Math.abs(c.tx - x) + Math.abs(c.ty - y) <= 1;
}

function move(c, world, dt) {
  if (c.ghostSleep || c.state === "sleep") return;
  if (!c.path || c.pathI >= c.path.length) {
    c.tx = Math.round((c.x - TILE * 0.5) / TILE);
    c.ty = Math.round((c.y - TILE) / TILE);
    return;
  }
  const node = c.path[c.pathI];
  const tx = node.x * TILE + TILE * 0.5;
  const ty = node.y * TILE + TILE;
  const dx = tx - c.x;
  const dy = ty - c.y;
  const dist = Math.hypot(dx, dy);
  const spd = 62 * dt * (c.needs.sleep < 20 ? 0.7 : 1);
  if (dist < 2 || dist <= spd) {
    c.x = tx; c.y = ty;
    c.tx = node.x; c.ty = node.y;
    c.pathI++;
  } else {
    c.x += (dx / dist) * spd;
    c.y += (dy / dist) * spd;
    if (dx > 0.4) c.facing = 1;
    if (dx < -0.4) c.facing = -1;
    c.state = "walk";
  }
}

function openNearbyDoors(c, world) {
  for (const b of world.buildings) {
    if (b.type !== "door") continue;
    const near = Math.abs(c.tx - b.x) <= 1 && Math.abs(c.ty - (b.y + 1)) <= 1;
    if (near) {
      b._wantOpen = true;
      b.occupied = c.id;
    } else if (b.occupied === c.id) {
      b._wantOpen = false;
      b.occupied = null;
    }
  }
}

export function killColonist(c, crew, jobs, particles) {
  c.alive = false;
  c.state = "dead";
  c.thought = "Died";
  if (c.job) {
    c.job.assigned = null;
    c.job = null;
  }
  if (particles) {
    particles.killOwner(c.id);
    particles.burst(c.x, c.y - 20, "dust", 16);
  }
}

export function removeColonist(c, crew, particles) {
  killColonist(c, crew, null, particles);
  const i = crew.indexOf(c);
  if (i >= 0) crew.splice(i, 1);
  c.shadow = false;
  c.sprite = null;
}


