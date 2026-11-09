/** @file A* pathfinding over standable tiles and ladders. */

export function findPath(world, x0, y0, x1, y1, limit = 1400) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  if (!world.canStand(x1, y1) && !world.canClimb(x1, y1)) {
    const n = nearestStand(world, x1, y1);
    if (!n) return null;
    x1 = n.x; y1 = n.y;
  }
  if (x0 === x1 && y0 === y1) return [{ x: x0, y: y0 }];

  const w = world.w, h = world.h;
  const key = (x, y) => y * w + x;
  const open = [];
  const came = new Int32Array(w * h);
  const gScore = new Float32Array(w * h);
  const closed = new Uint8Array(w * h);
  came.fill(-1);
  gScore.fill(1e9);

  const start = key(x0, y0);
  gScore[start] = 0;
  open.push(start);
  const fScore = new Float32Array(w * h);
  fScore[start] = Math.abs(x1 - x0) + Math.abs(y1 - y0);

  let steps = 0;
  while (open.length && steps++ < limit) {
    let bestI = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bestI]]) bestI = i;
    const cur = open[bestI];
    open[bestI] = open[open.length - 1];
    open.pop();
    const cx = cur % w;
    const cy = (cur / w) | 0;
    if (cx === x1 && cy === y1) return reconstruct(came, cur, w);
    if (closed[cur]) continue;
    closed[cur] = 1;

    const neighbors = neighborsOf(world, cx, cy);
    for (let n = 0; n < neighbors.length; n++) {
      const nx = neighbors[n].x, ny = neighbors[n].y, cost = neighbors[n].c;
      const nk = key(nx, ny);
      if (closed[nk]) continue;
      const tentative = gScore[cur] + cost;
      if (tentative < gScore[nk]) {
        came[nk] = cur;
        gScore[nk] = tentative;
        fScore[nk] = tentative + Math.abs(x1 - nx) + Math.abs(y1 - ny);
        open.push(nk);
      }
    }
  }
  return null;
}

function neighborsOf(world, x, y) {
  const out = [];
  if (world.canStand(x + 1, y) || walkDoor(world, x + 1, y)) out.push({ x: x + 1, y, c: 1 });
  if (world.canStand(x - 1, y) || walkDoor(world, x - 1, y)) out.push({ x: x - 1, y, c: 1 });

  if (world.canClimb(x, y) || world.canClimb(x, y - 1)) {
    if (passable(world, x, y - 1)) out.push({ x, y: y - 1, c: 1.2 });
  }
  if (world.canClimb(x, y) || world.canClimb(x, y + 1)) {
    if (passable(world, x, y + 1)) out.push({ x, y: y + 1, c: 1.1 });
  }
  if (!world.isSolid(x, y + 1) && world.canStand(x, y + 1)) {
    out.push({ x, y: y + 1, c: 1.05 });
  }
  return out;
}

function passable(world, x, y) {
  if (!world.in(x, y)) return false;
  if (!world.isSolid(x, y)) return true;
  return walkDoor(world, x, y) || world.material[y * world.w + x] === 14;
}

function walkDoor(world, x, y) {
  if (!world.in(x, y)) return false;
  const id = world.buildId[y * world.w + x];
  if (!id) return false;
  const b = world.buildings.find((k) => k.id === id);
  return !!(b && b.type === "door");
}

function reconstruct(came, cur, w) {
  const path = [];
  while (cur >= 0) {
    path.push({ x: cur % w, y: (cur / w) | 0 });
    cur = came[cur];
  }
  path.reverse();
  return path;
}

export function nearestStand(world, x, y, r = 6) {
  if (world.canStand(x, y)) return { x, y };
  let best = null, bd = 1e9;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!world.canStand(nx, ny)) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = { x: nx, y: ny }; }
    }
  }
  return best;
}

export function adjacentTo(world, tx, ty, colonist) {
  const opts = [
    { x: tx - 1, y: ty },
    { x: tx + 1, y: ty },
    { x: tx, y: ty },
    { x: tx, y: ty - 1 },
    { x: tx, y: ty + 1 },
  ];
  let best = null, bd = 1e9;
  for (const o of opts) {
    if (!world.canStand(o.x, o.y) && !world.canClimb(o.x, o.y)) continue;
    const d = Math.abs(o.x - colonist.tx) + Math.abs(o.y - colonist.ty);
    if (d < bd) { bd = d; best = o; }
  }
  return best || nearestStand(world, tx, ty);
}
