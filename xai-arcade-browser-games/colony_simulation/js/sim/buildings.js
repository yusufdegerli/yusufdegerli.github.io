/** @file Building placement, ticking, and starter layout. */

import { BUILDINGS, MAT, GAS, LIQ, MATERIALS, idx } from "./constants.js";

export function automationAllows(b) {
  if (!b || !b.autoConnected) return true;
  return !!b.autoGreen;
}

export function canPlace(world, type, x, y) {
  const def = BUILDINGS[type];
  if (!def) return false;
  if (def.layer) {
    if (!world.in(x, y)) return false;
    const layer = world[def.layer];
    return layer[y * world.w + x] === 0;
  }
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const tx = x + dx, ty = y + dy;
      if (!world.in(tx, ty)) return false;
      const i = ty * world.w + tx;
      if (world.buildId[i]) return false;
      if (def.mat != null) {
        if (world.material[i] !== MAT.VACUUM && world.material[i] !== MAT.LADDER) return false;
      } else {
        if (world.isSolid(tx, ty) && world.material[i] !== MAT.MESH && world.material[i] !== MAT.LADDER) return false;
      }
    }
  }
  const floorY = y + def.h;
  if (def.mat == null && type !== "ladder" && type !== "mesh") {
    let supported = false;
    for (let dx = 0; dx < def.w; dx++) {
      if (world.isSolid(x + dx, floorY) || world.canStand(x + dx, y + def.h - 1)) supported = true;
    }
    if (!supported && type !== "wire" && type !== "pipe" && type !== "gaspipe") return false;
  }
  return true;
}

export function placeBuilding(world, type, x, y, instant = false) {
  const def = BUILDINGS[type];
  if (!def) return null;
  if (def.layer) {
    if (!world.in(x, y)) return null;
    world[def.layer][y * world.w + x] = 1;
    world.networkRev++;
    world.markDirty(x, y);
    return { id: 0, type, x, y, w: 1, h: 1, layer: def.layer };
  }
  if (!canPlace(world, type, x, y) && !instant) return null;

  const b = {
    id: world.nextBuildingId++,
    type,
    x,
    y,
    w: def.w,
    h: def.h,
    enabled: true,
    working: false,
    powered: false,
    open: type === "door",
    progress: 0,
    storedJ: 0,
    grow: 0,
    occupied: null,
    hp: 100,
    threshold: type === "thermosensor" ? 293.15 : 0,
    latchedOut: type === "notgate" ? 1 : 0,
  };
  world.buildings.push(b);
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const tx = x + dx, ty = y + dy;
      const i = ty * world.w + tx;
      world.buildId[i] = b.id;
      if (def.mat != null) {
        world.material[i] = def.mat;
        world.mass[i] = MATERIALS[def.mat].mass;
        world.clearCellFluids(i);
      }
      world.markDirty(tx, ty);
    }
  }
  world.networkRev++;
  return b;
}

export function removeBuilding(world, b, particles) {
  if (!b) return;
  if (b.layer) {
    world[b.layer][b.y * world.w + b.x] = 0;
    world.networkRev++;
    world.markDirty(b.x, b.y);
    return;
  }
  const def = BUILDINGS[b.type];
  for (let dy = 0; dy < b.h; dy++) {
    for (let dx = 0; dx < b.w; dx++) {
      const tx = b.x + dx, ty = b.y + dy;
      if (!world.in(tx, ty)) continue;
      const i = ty * world.w + tx;
      if (world.buildId[i] === b.id) {
        world.buildId[i] = 0;
        if (def?.mat != null) {
          world.material[i] = MAT.VACUUM;
          world.mass[i] = 0;
        }
        world.markDirty(tx, ty);
      }
    }
  }
  const ix = world.buildings.indexOf(b);
  if (ix >= 0) world.buildings.splice(ix, 1);
  world.networkRev++;
  if (particles) particles.burst(b.x * 32 + b.w * 16, b.y * 32 + b.h * 16, "dust", 10);
}

export function buildingAt(world, x, y) {
  if (!world.in(x, y)) return null;
  const id = world.buildId[y * world.w + x];
  if (!id) return null;
  return world.buildings.find((b) => b.id === id) || null;
}

export function tickBuildings(world, dt, resources, networks, particles) {
  for (const b of world.buildings) {
    const def = BUILDINGS[b.type];
    if (!def) continue;
    const i = (b.y + b.h - 1) * world.w + b.x;

    if (b.type === "door") {
      b.open = !!b._wantOpen || !!b.occupied;
    }

    const autoOk = automationAllows(b);

    if (def.operated) {
      b.working = !!b.operator;
    } else if (b.type === "coalgen") {
      b.working = b.enabled !== false && autoOk;
    } else if (def.power) {
      b.working = b.powered && b.enabled !== false && autoOk;
    } else if (def.produceW) {
      b.working = !!b.operator;
    } else {
      b.working = b.enabled !== false && autoOk;
    }

    if (b.type === "oxygen" && b.working) {
      const need = (def.consume.algae || 0) * dt;
      if (resources.algae >= need) {
        resources.algae -= need;
        const out = (b.y) * world.w + b.x;
        world.addGas(out, GAS.O2, def.emit.o2 * dt);
        if (particles && Math.random() < dt * 4) {
          particles.spawn(b.x * 32 + 16, b.y * 32 + 8, (Math.random() - 0.5) * 8, -12 - Math.random() * 10, 0.7, 3, "gas", 120, 220, 255, b.id);
        }
      } else {
        b.working = false;
      }
    }

    if (b.type === "electrolyzer" && b.working) {
      const cell = (b.y + b.h - 1) * world.w + b.x;
      const water = world.liqAt(cell, LIQ.WATER) + world.liqAt(cell + 1, LIQ.WATER);
      const pkt = networks.pullPipe(b.pipeNet, 80 * dt);
      let took = 0;
      if (pkt && pkt.kind === LIQ.WATER) took += pkt.amount;
      if (took < 4 && water > 8) {
        const pull = Math.min(80 * dt, water);
        world.addLiq(cell, LIQ.WATER, -pull * 0.5);
        world.addLiq(cell + 1, LIQ.WATER, -pull * 0.5);
        took += pull;
      }
      if (took > 1) {
        world.addGas(b.y * world.w + b.x, GAS.O2, def.emit.o2 * dt);
        world.addGas(b.y * world.w + b.x + 1, GAS.H2, def.emit.h2 * dt);
      } else b.working = false;
    }

    if (b.type === "coalgen" && b.working) {
      const need = def.consume.coal * dt;
      if (resources.coal >= need && autoOk) {
        resources.coal -= need;
        b.working = true;
        world.addGas(b.y * world.w + b.x, GAS.CO2, 10 * dt);
        world.temp[i] += def.heat * dt * 0.15;
        if (particles && Math.random() < dt * 6) {
          particles.spawn(b.x * 32 + 20, b.y * 32 + 4, (Math.random() - 0.5) * 10, -20, 0.8, 3, "smoke", 50, 50, 56, b.id);
        }
      } else {
        b.working = false;
      }
    }

    if (b.type === "heater" && b.working) {
      world.temp[i] += def.heat * dt * 0.2;
    }
    if (b.type === "cooler" && b.working) {
      world.temp[i] += def.heat * dt * 0.2;
    }

    if (b.type === "liqpump" && b.working) {
      const cell = (b.y + b.h - 1) * world.w + b.x;
      const kind = world.primaryLiq(cell);
      if (kind >= 0) {
        const amt = Math.min(90 * dt, world.liqAt(cell, kind));
        if (amt > 1) {
          world.addLiq(cell, kind, -amt);
          networks.pushPipe(b.pipeNet, kind, amt);
        }
      }
    }

    if (b.type === "liqvent") {
      const pkt = networks.pullPipe(b.pipeNet, 40);
      if (pkt) {
        const cell = b.y * world.w + b.x;
        if (world.isPermeable(b.x, b.y) || !world.isSolid(b.x, b.y)) {
          world.addLiq(cell, pkt.kind ?? LIQ.WATER, pkt.amount);
        } else {
          networks.pushPipe(b.pipeNet, pkt.kind, pkt.amount);
        }
      }
    }

    if (b.type === "gaspump" && b.working) {
      const cell = b.y * world.w + b.x;
      let best = 0, amt = 0;
      for (let g = 0; g < 4; g++) {
        const v = world.gasAt(cell, g);
        if (v > amt) { amt = v; best = g; }
      }
      if (amt > 2) {
        const mv = Math.min(amt, 40 * dt);
        world.addGas(cell, best, -mv);
        networks.pushVent(b.ventNet, best, mv);
      }
    }

    if (b.type === "gasvent") {
      const pkt = networks.pullVent(b.ventNet);
      if (pkt) {
        const cell = b.y * world.w + b.x;
        if (!world.isSolid(b.x, b.y) || world.isPermeable(b.x, b.y)) {
          world.addGas(cell, pkt.gas, pkt.amount);
        } else {
          networks.pushVent(b.ventNet, pkt.gas, pkt.amount);
        }
      }
    }

    if (b.type === "farm") {
      if (b.grow < (def.growTicks || 280)) {
        b.grow += dt * 10 * (world.temp[i] > 280 && world.temp[i] < 330 ? 1 : 0.35);
      }
    }

    if (b.type === "outhouse" && b.operator) {
      b.progress += dt;
      if (b.progress > 2.4) {
        b.progress = 0;
        world.addLiq((b.y + b.h - 1) * world.w + b.x, LIQ.POLLUTED, 40);
        if (b.operator) b.operator.needs.bladder = 100;
      }
    }

    if (def.heat && b.working && b.type !== "heater" && b.type !== "cooler" && b.type !== "coalgen") {
      world.temp[i] += def.heat * dt * 0.08;
    }
  }
}

export function placeStarter(world, resources) {
  const s = world.spawn;
  const floorY = s.y + 1;
  const roomTop = s.y - 4;

  placeBuilding(world, "floor", s.x - 8, floorY, true);
  for (let x = s.x - 8; x <= s.x + 8; x++) {
    if (world.material[floorY * world.w + x] === MAT.VACUUM) {
      world.setMat(x, floorY, MAT.FLOOR, 295);
    }
  }

  placeBuilding(world, "cot", s.x - 7, floorY - 1, true);
  placeBuilding(world, "cot", s.x - 5, floorY - 1, true);
  placeBuilding(world, "cot", s.x + 4, floorY - 1, true);
  placeBuilding(world, "cot", s.x + 6, floorY - 1, true);
  placeBuilding(world, "outhouse", s.x + 8, floorY - 2, true);
  placeBuilding(world, "table", s.x - 1, floorY - 1, true);
  placeBuilding(world, "storage", s.x + 1, floorY - 1, true);
  placeBuilding(world, "oxygen", s.x - 3, floorY - 2, true);
  placeBuilding(world, "generator", s.x + 2, floorY - 2, true);
  const battery = placeBuilding(world, "battery", s.x - 8, floorY - 2, true);
  if (battery) battery.storedJ = 9000;
  placeBuilding(world, "farm", s.x - 2, floorY - 1, true);
  placeBuilding(world, "farm", s.x, floorY - 1, true);

  for (let x = s.x - 8; x <= s.x + 2; x++) {
    world.wire[ (floorY - 1) * world.w + x ] = 1;
  }
  world.wire[(floorY - 2) * world.w + (s.x - 8)] = 1;
  world.wire[(floorY - 2) * world.w + (s.x - 3)] = 1;
  world.wire[(floorY - 2) * world.w + (s.x + 2)] = 1;
  world.wire[(floorY - 1) * world.w + (s.x + 2)] = 1;
  world.networkRev++;

  for (let y = floorY + 1; y < floorY + 6; y++) {
    if (world.in(s.x, y)) {
      const i = y * world.w + s.x;
      if (world.material[i] === MAT.VACUUM || MATERIALS[world.material[i]]?.diggable) {
        world.setMat(s.x, y, MAT.LADDER, world.temp[i]);
      }
    }
  }
}
