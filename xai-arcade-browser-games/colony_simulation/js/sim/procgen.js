/** @file Procedural subterranean asteroid cross-section. */

import { MAT, GAS, LIQ, ROOM_TEMP, SPACE_TEMP, CORE_TEMP, MATERIALS, hash2 } from "./constants.js";

function valueNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const h00 = (hash2(ix + seed, iy) & 1023) / 1023;
  const h10 = (hash2(ix + 1 + seed, iy) & 1023) / 1023;
  const h01 = (hash2(ix + seed, iy + 1) & 1023) / 1023;
  const h11 = (hash2(ix + 1 + seed, iy + 1) & 1023) / 1023;
  const a = h00 + (h10 - h00) * u;
  const b = h01 + (h11 - h01) * u;
  return a + (b - a) * v;
}

function fbm(x, y, seed, oct = 4) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += valueNoise(x * f, y * f, seed + i * 19) * a;
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
}

export function generateAsteroid(world, seed = (Math.random() * 1e9) | 0) {
  const { w, h } = world;
  const cx = w * 0.5;
  const cy = h * 0.52;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const nx = (x - cx) / (w * 0.48);
      const ny = (y - cy) / (h * 0.46);
      const r = Math.sqrt(nx * nx * 0.85 + ny * ny);
      const edge = fbm(x * 0.08, y * 0.08, seed, 3);
      const radius = 0.86 + edge * 0.12;
      const depth = y / h;
      const tBase = SPACE_TEMP + (CORE_TEMP - SPACE_TEMP) * Math.pow(Math.max(0, (depth - 0.12) / 0.88), 1.35);

      if (r > radius) {
        world.material[i] = MAT.VACUUM;
        world.mass[i] = 0;
        world.temp[i] = SPACE_TEMP;
        continue;
      }

      const cave = fbm(x * 0.11, y * 0.13, seed + 7, 4);
      const cave2 = fbm(x * 0.22 + 40, y * 0.2, seed + 21, 3);
      const vein = fbm(x * 0.18, y * 0.07, seed + 33, 3);
      const iceN = fbm(x * 0.14, y * 0.16, seed + 55, 3);
      const coalN = fbm(x * 0.2, y * 0.12, seed + 77, 3);
      const slimeN = fbm(x * 0.16 + 8, y * 0.18, seed + 99, 3);
      const sandN = fbm(x * 0.17, y * 0.14, seed + 111, 3);

      let mat = MAT.ROCK;
      if (depth > 0.72 && cave < 0.42) mat = MAT.HARDROCK;
      if (depth < 0.28 && iceN > 0.58) mat = MAT.ICE;
      else if (depth > 0.22 && depth < 0.55 && iceN > 0.72) mat = MAT.ICE;
      if (vein > 0.68 && depth > 0.18) mat = MAT.ORE;
      if (coalN > 0.7 && depth > 0.48) mat = MAT.COAL;
      if (slimeN > 0.74 && depth > 0.25 && depth < 0.6) mat = MAT.ORGANIC;
      if (cave > 0.62 && depth > 0.15 && depth < 0.85) mat = MAT.DIRT;
      if (sandN > 0.66 && depth > 0.18 && depth < 0.58) mat = MAT.SAND;

      const pocket = cave > 0.58 && cave2 > 0.55 && r < 0.72 && depth > 0.16 && depth < 0.8;
      const worm = Math.abs(fbm(x * 0.07, y * 0.19, seed + 3, 2) - 0.5) < 0.06 && r < 0.7;

      if ((pocket || worm) && mat !== MAT.HARDROCK) {
        world.material[i] = MAT.VACUUM;
        world.mass[i] = 0;
        world.temp[i] = tBase * 0.7 + 80;
        if (depth > 0.55 && cave2 > 0.7) {
          world.addLiq(i, LIQ.WATER, 200 + (hash2(x, y) % 400));
        } else if (depth < 0.4) {
          world.addGas(i, GAS.CO2, 8 + (hash2(x, y + 3) % 20));
        } else {
          world.addGas(i, GAS.CO2, 20);
          if (slimeN > 0.6) world.addGas(i, GAS.O2, 6);
        }
      } else {
        world.material[i] = mat;
        world.mass[i] = MATERIALS[mat].mass;
        world.temp[i] = tBase + (hash2(x, y) % 20) - 10;
      }

      if (depth > 0.9 && r < 0.55 && cave < 0.5) {
        world.material[i] = MAT.VACUUM;
        world.mass[i] = 0;
        world.temp[i] = 1650;
        world.addLiq(i, LIQ.MAGMA, 700 + (hash2(x, y) % 280));
      }
    }
  }

  const sx = (w * 0.5) | 0;
  const sy = (h * 0.38) | 0;
  const rw = 9, rh = 6;
  for (let y = sy; y < sy + rh; y++) {
    for (let x = sx - rw; x <= sx + rw; x++) {
      if (!world.in(x, y)) continue;
      const i = y * w + x;
      const edge = x === sx - rw || x === sx + rw || y === sy || y === sy + rh - 1;
      if (edge && y !== sy + rh - 1) {
        world.material[i] = MAT.WALL;
        world.mass[i] = MATERIALS[MAT.WALL].mass;
        world.temp[i] = ROOM_TEMP;
        world.clearCellFluids(i);
      } else if (y === sy + rh - 1) {
        world.material[i] = MAT.FLOOR;
        world.mass[i] = MATERIALS[MAT.FLOOR].mass;
        world.temp[i] = ROOM_TEMP;
        world.clearCellFluids(i);
      } else {
        world.material[i] = MAT.VACUUM;
        world.mass[i] = 0;
        world.temp[i] = ROOM_TEMP;
        world.clearCellFluids(i);
        world.addGas(i, GAS.O2, 140);
        world.addGas(i, GAS.CO2, 4);
      }
    }
  }

  for (let y = sy + rh; y < sy + rh + 5; y++) {
    const x = sx;
    if (!world.in(x, y)) continue;
    if (world.isSolid(x, y) && world.material[y * w + x] !== MAT.FLOOR) {
      world.material[y * w + x] = MAT.LADDER;
      world.mass[y * w + x] = MATERIALS[MAT.LADDER].mass;
    } else if (!world.isSolid(x, y)) {
      world.material[y * w + x] = MAT.LADDER;
      world.mass[y * w + x] = MATERIALS[MAT.LADDER].mass;
    }
    world.temp[y * w + x] = ROOM_TEMP;
  }

  for (let x = sx - 3; x <= sx + 4; x++) {
    const y = sy + rh;
    if (!world.in(x, y)) continue;
    if (world.material[y * w + x] === MAT.VACUUM) {
      world.material[y * w + x] = MAT.FLOOR;
      world.mass[y * w + x] = MATERIALS[MAT.FLOOR].mass;
      world.temp[y * w + x] = ROOM_TEMP;
    }
  }

  plantIceNear(world, sx, sy, seed);
  plantOreNear(world, sx, sy, seed);

  world.spawn = { x: sx, y: sy + rh - 2 };
  world.seed = seed;
  world.active.fill(1);
  return world.spawn;
}

function plantIceNear(world, sx, sy, seed) {
  let placed = 0;
  for (let k = 0; k < 400 && placed < 18; k++) {
    const x = sx - 18 + (hash2(k, seed) % 36);
    const y = sy - 4 + (hash2(k + 9, seed) % 16);
    if (!world.in(x, y)) continue;
    const i = y * world.w + x;
    if (world.material[i] === MAT.ROCK || world.material[i] === MAT.DIRT) {
      world.material[i] = MAT.ICE;
      world.mass[i] = MATERIALS[MAT.ICE].mass;
      world.temp[i] = 250;
      placed++;
    }
  }
}

function plantOreNear(world, sx, sy, seed) {
  let placed = 0;
  for (let k = 0; k < 400 && placed < 16; k++) {
    const x = sx - 10 + (hash2(k + 40, seed) % 28);
    const y = sy + 4 + (hash2(k + 70, seed) % 18);
    if (!world.in(x, y)) continue;
    const i = y * world.w + x;
    if (world.material[i] === MAT.ROCK || world.material[i] === MAT.HARDROCK) {
      world.material[i] = MAT.ORE;
      world.mass[i] = MATERIALS[MAT.ORE].mass;
      placed++;
    }
  }
}
