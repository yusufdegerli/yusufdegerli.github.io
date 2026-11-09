/** @file Density-driven gas and liquid flow on typed arrays. */

import { GAS, LIQ, GAS_COUNT, LIQ_COUNT, GASES, MAX_LIQ, MAX_GAS, MAT } from "./constants.js";

export function stepFluids(world, dt) {
  stepLiquids(world, dt);
  stepGases(world, dt);
  buoyancy(world);
}

function canFlow(world, i) {
  const id = world.material[i];
  if (id === MAT.VACUUM || id === MAT.LADDER || id === MAT.MESH) return true;
  const bid = world.buildId[i];
  if (bid) {
    const b = world.buildings.find((k) => k.id === bid);
    if (b && b.type === "door" && b.open) return true;
  }
  return false;
}

function stepLiquids(world, dt) {
  const { w, h, n } = world;
  const fall = Math.min(1, dt * 8);
  const spread = Math.min(1, dt * 4);

  for (let l = 0; l < LIQ_COUNT; l++) {
    const arr = l;
    for (let y = h - 2; y >= 0; y--) {
      const yOff = y * w;
      const yBelow = (y + 1) * w;
      const ltr = ((world._liqSweep || 0) + y) & 1;
      for (let c = 0; c < w; c++) {
        const x = ltr ? c : w - 1 - c;
        const i = yOff + x;
        const mass = world.liqAt(i, arr);
        if (mass < 0.8) continue;
        if (!canFlow(world, i)) continue;

        const below = yBelow + x;
        if (canFlow(world, below)) {
          const room = MAX_LIQ - world.liqAt(below, arr);
          if (room > 0.5) {
            const mv = Math.min(mass, room, mass * fall + 40);
            world.addLiq(i, arr, -mv);
            world.addLiq(below, arr, mv);
            world.active[i] = 1;
            world.active[below] = 1;
            continue;
          }
        }

        if (mass < 12) continue;
        const dirs = ltr ? [-1, 1] : [1, -1];
        for (const dx of dirs) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const j = yOff + nx;
          if (!canFlow(world, j)) continue;
          const nm = world.liqAt(j, arr);
          const diff = mass - nm;
          if (diff > 8) {
            const mv = Math.min(diff * 0.25 * spread, mass * 0.4);
            world.addLiq(i, arr, -mv);
            world.addLiq(j, arr, mv);
            world.active[i] = 1;
            world.active[j] = 1;
          }
        }
      }
    }
  }
  world._liqSweep = (world._liqSweep || 0) ^ 1;
}

function stepGases(world, dt) {
  const { w, h, n } = world;
  const k = Math.min(0.45, dt * 3.2);
  const phase = world._gasPhase ^ 1;
  world._gasPhase = phase;

  for (let y = 1; y < h - 1; y++) {
    const yOff = y * w;
    for (let x = 1; x < w - 1; x++) {
      if (((x + y) & 1) !== phase) continue;
      const i = yOff + x;
      if (!canFlow(world, i)) continue;
      const pA = world.totalGas(i);
      if (pA < 0.05) continue;

      const neigh = [i + 1, i - 1, i + w, i - w];
      for (let ni = 0; ni < 4; ni++) {
        const j = neigh[ni];
        if (!canFlow(world, j)) continue;
        const pB = world.totalGas(j);
        const dp = pA - pB;
        if (dp < 0.4) continue;
        if (pB > MAX_GAS && dp < 8) continue;
        const flow = dp * k;
        const denom = pA + 1e-4;
        for (let g = 0; g < GAS_COUNT; g++) {
          const share = world.gasAt(i, g) / denom;
          const mv = flow * share;
          if (mv < 0.002) continue;
          world.addGas(i, g, -mv);
          world.addGas(j, g, mv);
        }
        world.active[i] = 1;
        world.active[j] = 1;
      }
    }
  }
}

function buoyancy(world) {
  const { w, h, n } = world;
  for (let y = 1; y < h - 1; y++) {
    const yOff = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = yOff + x;
      const above = i - w;
      if (!canFlow(world, i) || !canFlow(world, above)) continue;

      const h2Below = world.gasAt(i, GAS.H2);
      const h2Above = world.gasAt(above, GAS.H2);
      if (h2Below > 0.4 && h2Below > h2Above + 0.3) {
        const mv = Math.min(h2Below * 0.35, 18);
        world.addGas(i, GAS.H2, -mv);
        world.addGas(above, GAS.H2, mv);
        const heavy = world.gasAt(above, GAS.CO2) + world.gasAt(above, GAS.O2);
        if (heavy > 0.4) {
          const back = Math.min(mv * 0.8, world.gasAt(above, GAS.CO2));
          world.addGas(above, GAS.CO2, -back);
          world.addGas(i, GAS.CO2, back);
        }
      }

      const co2Above = world.gasAt(above, GAS.CO2);
      const co2Below = world.gasAt(i, GAS.CO2);
      if (co2Above > 0.5 && co2Above > co2Below + 0.4) {
        const mv = Math.min(co2Above * 0.3, 16);
        world.addGas(above, GAS.CO2, -mv);
        world.addGas(i, GAS.CO2, mv);
        const o2 = world.gasAt(i, GAS.O2);
        if (o2 > 0.4) {
          const back = Math.min(mv * 0.7, o2);
          world.addGas(i, GAS.O2, -back);
          world.addGas(above, GAS.O2, back);
        }
      }
    }
  }
}

export { GAS, LIQ, GASES };
