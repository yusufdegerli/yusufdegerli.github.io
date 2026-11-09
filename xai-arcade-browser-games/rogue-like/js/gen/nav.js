const STEP = 56;

export function buildNav(platforms, opts = {}) {
  const jumpH = opts.jumpH ?? 170;
  const jumpW = opts.jumpW ?? 250;
  const nodes = [];
  const surfaces = platforms.filter((p) => p.w >= 50 && p.h <= 64 && !(p.h <= 20 && p.w > 400));

  surfaces.forEach((p, pi) => {
    const top = p.y;
    const left = p.x + 16;
    const right = p.x + p.w - 16;
    const count = Math.max(1, Math.round((right - left) / STEP));
    for (let i = 0; i <= count; i++) {
      const t = count === 0 ? 0.5 : i / count;
      nodes.push({
        id: nodes.length,
        x: left + (right - left) * t,
        y: top,
        plat: pi,
        edge: i === 0 || i === count,
      });
    }
  });

  const edges = nodes.map(() => []);

  const link = (a, b, kind, cost) => {
    edges[a].push({ to: b, kind, cost });
  };

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const A = nodes[i];
      const B = nodes[j];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (A.plat === B.plat && adx <= STEP + 8 && ady < 8) {
        link(i, j, "walk", adx);
        link(j, i, "walk", adx);
        continue;
      }

      if (ady < 12 && adx > 20 && adx < jumpW && A.plat !== B.plat) {
        const cost = adx + 40;
        link(i, j, "jump", cost);
        link(j, i, "jump", cost);
        continue;
      }

      if (dy > 20 && dy < 1100 && adx < jumpW + 200) {
        const kind = dy > jumpH || adx < 90 ? "drop" : "jump";
        link(i, j, kind, adx + dy * 0.55 + (kind === "jump" ? 50 : 16));
      }
      if (dy < -20 && -dy < jumpH + 20 && adx < jumpW) {
        link(i, j, "jump", adx - dy + 50);
      }
    }
  }

  const floors = surfaces.filter((p) => p.h >= 40).sort((a, b) => a.x - b.x);
  for (let f = 0; f < floors.length - 1; f++) {
    const A = floors[f];
    const B = floors[f + 1];
    if (B.x - (A.x + A.w) > 320) continue;
    let ia = -1;
    let ib = -1;
    let ba = -1e9;
    let bb = 1e9;
    for (let n = 0; n < nodes.length; n++) {
      if (nodes[n].plat === surfaces.indexOf(A) && nodes[n].x > ba) {
        ba = nodes[n].x;
        ia = n;
      }
      if (nodes[n].plat === surfaces.indexOf(B) && nodes[n].x < bb) {
        bb = nodes[n].x;
        ib = n;
      }
    }
    if (ia >= 0 && ib >= 0 && !edges[ia].some((e) => e.to === ib)) {
      const dy = nodes[ib].y - nodes[ia].y;
      const kind = Math.abs(dy) < 14 ? "walk" : dy > 30 ? "drop" : "jump";
      const cost = Math.abs(nodes[ib].x - nodes[ia].x) + Math.abs(dy) + 30;
      link(ia, ib, kind, cost);
      link(ib, ia, dy > 30 ? "jump" : kind, cost + 10);
    }
  }

  return { nodes, edges };
}

function nearest(nav, x, y) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < nav.nodes.length; i++) {
    const n = nav.nodes[i];
    const d = (n.x - x) ** 2 + (n.y - y) ** 2 * 1.4;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function findPath(nav, x0, y0, x1, y1) {
  if (!nav || nav.nodes.length === 0) return [];
  const start = nearest(nav, x0, y0);
  const goal = nearest(nav, x1, y1);
  if (start === goal) return [nav.nodes[goal]];

  const dist = new Float64Array(nav.nodes.length).fill(Infinity);
  const prev = new Int32Array(nav.nodes.length).fill(-1);
  const prevKind = new Array(nav.nodes.length);
  const used = new Uint8Array(nav.nodes.length);
  dist[start] = 0;
  const open = [start];

  const heur = (i) => {
    const n = nav.nodes[i];
    return Math.abs(n.x - x1) + Math.abs(n.y - y1) * 0.8;
  };

  while (open.length) {
    let bi = 0;
    let bv = dist[open[0]] + heur(open[0]);
    for (let k = 1; k < open.length; k++) {
      const v = dist[open[k]] + heur(open[k]);
      if (v < bv) {
        bv = v;
        bi = k;
      }
    }
    const cur = open.splice(bi, 1)[0];
    if (cur === goal) break;
    if (used[cur]) continue;
    used[cur] = 1;
    const list = nav.edges[cur];
    for (let e = 0; e < list.length; e++) {
      const { to, cost, kind } = list[e];
      const nd = dist[cur] + cost;
      if (nd < dist[to]) {
        dist[to] = nd;
        prev[to] = cur;
        prevKind[to] = kind;
        open.push(to);
      }
    }
  }

  if (prev[goal] < 0 && start !== goal) return [];
  const path = [];
  for (let at = goal; at >= 0; at = prev[at]) {
    path.push({ ...nav.nodes[at], via: prevKind[at] || "walk" });
    if (at === start) break;
  }
  path.reverse();
  return path;
}
