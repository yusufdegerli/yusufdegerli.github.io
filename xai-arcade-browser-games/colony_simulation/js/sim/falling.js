/** @file Gravity for loose solids. Sand falls one tile per tick. */

import { MAT, GAS_COUNT, LIQ_COUNT } from "./constants.js";

export function updateFallingBlocks(world, crew) {
  const { w, h, material } = world;
  for (let y = h - 2; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (material[i] !== MAT.SAND) continue;
      const ny = y + 1;
      const j = ny * w + x;
      if (material[j] !== MAT.VACUUM) continue;
      swapCells(world, i, j);
      world.markDirty(x, y);
      world.markDirty(x, ny);
      crushCrew(crew, x, ny);
    }
  }
}

function swapCells(world, a, b) {
  const mat = world.material[a];
  world.material[a] = world.material[b];
  world.material[b] = mat;

  const mass = world.mass[a];
  world.mass[a] = world.mass[b];
  world.mass[b] = mass;

  const temp = world.temp[a];
  world.temp[a] = world.temp[b];
  world.temp[b] = temp;

  const n = world.n;
  for (let g = 0; g < GAS_COUNT; g++) {
    const ia = g * n + a;
    const ib = g * n + b;
    const t = world.gas[ia];
    world.gas[ia] = world.gas[ib];
    world.gas[ib] = t;
  }
  for (let l = 0; l < LIQ_COUNT; l++) {
    const ia = l * n + a;
    const ib = l * n + b;
    const t = world.liq[ia];
    world.liq[ia] = world.liq[ib];
    world.liq[ib] = t;
  }
}

function crushCrew(crew, x, y) {
  if (!crew) return;
  for (const c of crew) {
    if (!c.alive) continue;
    if (c.tx === x && c.ty === y) {
      c.hp -= 15;
      c.thought = "Ouch! Falling rock!";
    }
  }
}
