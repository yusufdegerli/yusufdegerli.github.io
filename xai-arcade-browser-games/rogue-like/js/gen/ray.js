export function raycastBoxes(ox, oy, dx, dy, maxDist, boxes) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let best = maxDist;
  let hit = null;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const t = rayAabb(ox, oy, ux, uy, b.left, b.top, b.right, b.bottom);
    if (t != null && t > 6 && t < best) {
      best = t;
      hit = {
        x: ox + ux * t,
        y: oy + uy * t,
        t,
        box: b,
      };
    }
  }
  return hit;
}

function rayAabb(ox, oy, ux, uy, l, t, r, b) {
  const invX = ux !== 0 ? 1 / ux : 1e12;
  const invY = uy !== 0 ? 1 / uy : 1e12;
  let t1 = (l - ox) * invX;
  let t2 = (r - ox) * invX;
  let t3 = (t - oy) * invY;
  let t4 = (b - oy) * invY;
  const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
  const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));
  if (tmax < 0 || tmin > tmax) return null;
  const hit = tmin >= 0 ? tmin : tmax;
  return hit >= 0 ? hit : null;
}
