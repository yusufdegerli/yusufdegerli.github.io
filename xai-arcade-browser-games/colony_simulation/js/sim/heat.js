/** @file Density-aware heat transfer on typed arrays. */

import { MAT, GAS, LIQ, MATERIALS, GASES, LIQUIDS, GAS_COUNT, LIQ_COUNT } from "./constants.js";

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function stepHeat(world, dt) {
  const { w, h, n, material, temp } = world;
  const scratch = world._heatScratch || (world._heatScratch = new Float32Array(n));
  scratch.set(temp);

  const phase = world._heatPhase ^ 1;
  world._heatPhase = phase;

  for (let y = 1; y < h - 1; y++) {
    const yOff = y * w;
    for (let x = 1; x < w - 1; x++) {
      if (((x + y) & 1) !== phase) continue;
      const i = yOff + x;
      const condA = world.conductivity(i);
      if (condA <= 0) continue;
      const capA = world.heatCapacity(i);
      let t = scratch[i];

      for (let k = 0; k < 4; k++) {
        const j = (y + N4[k][1]) * w + (x + N4[k][0]);
        const condB = world.conductivity(j);
        if (condB <= 0) continue;
        const kEff = (2 * condA * condB) / (condA + condB + 1e-6);
        const q = kEff * (scratch[j] - t) * dt * 0.55;
        const capB = world.heatCapacity(j);
        t += q / capA;
        scratch[j] -= q / capB;
      }
      scratch[i] = t;
    }
  }

  temp.set(scratch);
  stepPhase(world);
}

function stepPhase(world) {
  const { w, h, n, material, temp } = world;
  for (let i = 0; i < n; i++) {
    const mat = material[i];
    const t = temp[i];

    if (mat === MAT.ICE && t > 273.4) {
      const x = i % w, y = (i / w) | 0;
      material[i] = MAT.VACUUM;
      world.mass[i] = 0;
      world.addLiq(i, LIQ.WATER, 700);
      temp[i] = 273.15;
      world.markDirty(x, y);
      continue;
    }

    const water = world.liqAt(i, LIQ.WATER);
    if (water > 8 && t > 373.6) {
      const boil = Math.min(water, 90);
      world.addLiq(i, LIQ.WATER, -boil);
      world.addGas(i, GAS.STEAM, boil * 0.45);
      temp[i] -= 4;
      world.active[i] = 1;
    } else if (water > 8 && t < 272.6) {
      const x = i % w, y = (i / w) | 0;
      if (material[i] === MAT.VACUUM && world.totalLiq(i) > 400) {
        material[i] = MAT.ICE;
        world.mass[i] = MATERIALS[MAT.ICE].mass;
        world.addLiq(i, LIQ.WATER, -world.liqAt(i, LIQ.WATER));
        temp[i] = 272.5;
        world.markDirty(x, y);
      }
    }

    const steam = world.gasAt(i, GAS.STEAM);
    if (steam > 4 && t < 372.4) {
      const cond = Math.min(steam, 40);
      world.addGas(i, GAS.STEAM, -cond);
      world.addLiq(i, LIQ.WATER, cond * 1.6);
      temp[i] += 1.2;
    }

    const magma = world.liqAt(i, LIQ.MAGMA);
    if (magma > 80 && t < 1380 && material[i] === MAT.VACUUM) {
      const x = i % w, y = (i / w) | 0;
      material[i] = MAT.HARDROCK;
      world.mass[i] = MATERIALS[MAT.HARDROCK].mass;
      world.addLiq(i, LIQ.MAGMA, -magma);
      temp[i] = 900;
      world.markDirty(x, y);
    }
  }
}

export function sampleTempColor(k) {
  if (k < 200) return [60, 90, 200];
  if (k < 273) {
    const u = (k - 200) / 73;
    return lerp3([60, 90, 200], [120, 190, 230], u);
  }
  if (k < 295) {
    const u = (k - 273) / 22;
    return lerp3([140, 200, 170], [90, 200, 110], u);
  }
  if (k < 330) {
    const u = (k - 295) / 35;
    return lerp3([90, 200, 110], [230, 190, 70], u);
  }
  if (k < 400) {
    const u = (k - 330) / 70;
    return lerp3([230, 190, 70], [230, 90, 40], u);
  }
  const u = Math.min(1, (k - 400) / 400);
  return lerp3([230, 90, 40], [255, 240, 220], u);
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export { GASES, LIQUIDS };
