/* RIMWRECK — custom 2D rigid-body physics (no engine) */
(function (global) {
  "use strict";

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function hypot(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  var _id = 1;

  function Body(o) {
    o = o || {};
    this.id = _id++;
    this.x = o.x || 0;
    this.y = o.y || 0;
    this.vx = o.vx || 0;
    this.vy = o.vy || 0;
    this.angle = o.angle || 0;
    this.av = o.av || 0;
    this.mass = o.mass != null ? o.mass : 1;
    this.inertia = o.inertia != null ? o.inertia : 200;
    this.invMass = this.mass === Infinity ? 0 : 1 / this.mass;
    this.invInertia = this.inertia === Infinity ? 0 : 1 / this.inertia;
    this.restitution = o.restitution != null ? o.restitution : 0.2;
    this.friction = o.friction != null ? o.friction : 0.45;
    this.linearDamp = o.linearDamp != null ? o.linearDamp : 0.2;
    this.angularDamp = o.angularDamp != null ? o.angularDamp : 0.8;
    this.gravityScale = o.gravityScale != null ? o.gravityScale : 1;
    this.shapes = [];
    this.alive = true;
    this.tag = o.tag || "";
    this.data = o.data || null;
    this.ignore = Object.create(null);
    this.sleeping = false;
    this.hullR = o.hullR || 0;
  }

  Body.prototype.addCircle = function (ox, oy, r, meta) {
    this.shapes.push({ type: "circle", ox: ox, oy: oy, r: r, meta: meta || null });
    return this;
  };

  Body.prototype.addBox = function (ox, oy, hw, hh, meta) {
    this.shapes.push({ type: "box", ox: ox, oy: oy, hw: hw, hh: hh, meta: meta || null });
    return this;
  };

  Body.prototype.worldPoint = function (lx, ly) {
    var c = Math.cos(this.angle);
    var s = Math.sin(this.angle);
    return { x: this.x + lx * c - ly * s, y: this.y + lx * s + ly * c };
  };

  Body.prototype.localPoint = function (wx, wy) {
    var dx = wx - this.x;
    var dy = wy - this.y;
    var c = Math.cos(-this.angle);
    var s = Math.sin(-this.angle);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  };

  Body.prototype.applyImpulse = function (jx, jy, px, py) {
    this.vx += jx * this.invMass;
    this.vy += jy * this.invMass;
    var rx = px - this.x;
    var ry = py - this.y;
    this.av += (rx * jy - ry * jx) * this.invInertia;
  };

  function World(gravity) {
    this.gravity = gravity != null ? gravity : 1600;
    this.bodies = [];
    this.statics = [];
    this.contacts = [];
  }

  World.prototype.addBody = function (b) {
    this.bodies.push(b);
    return b;
  };

  World.prototype.removeBody = function (b) {
    var i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
  };

  World.prototype.addAABB = function (x, y, w, h, meta) {
    var s = {
      type: "aabb",
      x: x,
      y: y,
      w: w,
      h: h,
      meta: meta || null
    };
    this.statics.push(s);
    return s;
  };

  World.prototype.addSegment = function (x1, y1, x2, y2, r, meta) {
    var s = {
      type: "segment",
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      r: r || 3,
      meta: meta || null
    };
    this.statics.push(s);
    return s;
  };

  World.prototype.addOBB = function (cx, cy, hw, hh, angle, meta) {
    var s = {
      type: "obb",
      x: cx,
      y: cy,
      hw: hw,
      hh: hh,
      angle: angle,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      meta: meta || null
    };
    this.statics.push(s);
    return s;
  };

  World.prototype.step = function (dt, now) {
    var g = this.gravity;
    var i, b;
    for (i = 0; i < this.bodies.length; i++) {
      b = this.bodies[i];
      if (!b.alive || !b.invMass) continue;
      b.vy += g * b.gravityScale * dt;
      b.vx *= Math.max(0, 1 - b.linearDamp * dt);
      b.vy *= Math.max(0, 1 - b.linearDamp * 0.12 * dt);
      b.av *= Math.max(0, 1 - b.angularDamp * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.av * dt;
      if (b.angle > Math.PI) b.angle -= Math.PI * 2;
      if (b.angle < -Math.PI) b.angle += Math.PI * 2;
      if (b.av > 20) b.av = 20;
      if (b.av < -20) b.av = -20;
      if (b.vx > 780) b.vx = 780;
      if (b.vx < -780) b.vx = -780;
      if (b.vy > 980) b.vy = 980;
      if (b.vy < -980) b.vy = -980;
    }

    this.contacts.length = 0;
    collectContacts(this, now, this.contacts);

    var iters = 12;
    var k;
    for (k = 0; k < iters; k++) {
      for (i = 0; i < this.contacts.length; i++) {
        solveVelocity(this.contacts[i], dt);
      }
    }

    var posList = [];
    for (k = 0; k < 8; k++) {
      posList.length = 0;
      collectContacts(this, now, posList);
      if (!posList.length) break;
      for (i = 0; i < posList.length; i++) {
        solvePosition(posList[i], k === 7);
      }
    }
    separateFromStatics(this);
    separateHulls(this);
    clampBodies(this);
  };

  function shapeWorld(body, sh) {
    var wp = body.worldPoint(sh.ox, sh.oy);
    if (sh.type === "circle") {
      return { type: "circle", x: wp.x, y: wp.y, r: sh.r };
    }
    return {
      type: "box",
      x: wp.x,
      y: wp.y,
      hw: sh.hw,
      hh: sh.hh,
      angle: body.angle,
      cos: Math.cos(body.angle),
      sin: Math.sin(body.angle)
    };
  }

  function collectContacts(world, now, contacts) {
    var bodies = world.bodies;
    var statics = world.statics;
    var i, j, bi, bj, si, sj, sh, st, hit;

    for (i = 0; i < bodies.length; i++) {
      bi = bodies[i];
      if (!bi.alive) continue;
      for (si = 0; si < bi.shapes.length; si++) {
        sh = shapeWorld(bi, bi.shapes[si]);
        for (j = 0; j < statics.length; j++) {
          st = statics[j];
          hit = collideShapeStatic(sh, st);
          if (hit) {
            hit.a = bi;
            hit.b = null;
            hit.sa = bi.shapes[si];
            hit.sb = st;
            hit.staticMeta = st.meta;
            fillImpact(hit);
            contacts.push(hit);
          }
        }
      }
    }

    for (i = 0; i < bodies.length; i++) {
      bi = bodies[i];
      if (!bi.alive) continue;
      for (j = i + 1; j < bodies.length; j++) {
        bj = bodies[j];
        if (!bj.alive) continue;
        if (bi.ignore[bj.id] && now < bi.ignore[bj.id]) continue;
        if (bj.ignore[bi.id] && now < bj.ignore[bi.id]) continue;
        for (si = 0; si < bi.shapes.length; si++) {
          for (sj = 0; sj < bj.shapes.length; sj++) {
            hit = collideShapeShape(shapeWorld(bi, bi.shapes[si]), shapeWorld(bj, bj.shapes[sj]));
            if (hit) {
              hit.a = bi;
              hit.b = bj;
              hit.sa = bi.shapes[si];
              hit.sb = bj.shapes[sj];
              hit.staticMeta = null;
              fillImpact(hit);
              contacts.push(hit);
            }
          }
        }
      }
    }
  }

  function fillImpact(c) {
    var a = c.a;
    var b = c.b;
    var rax = c.px - a.x;
    var ray = c.py - a.y;
    var vax = a.vx - a.av * ray;
    var vay = a.vy + a.av * rax;
    var vbx = 0;
    var vby = 0;
    if (b) {
      var rbx = c.px - b.x;
      var rby = c.py - b.y;
      vbx = b.vx - b.av * rby;
      vby = b.vy + b.av * rbx;
    }
    c.impactVel = (vax - vbx) * c.nx + (vay - vby) * c.ny;
    c.impulse = 0;
  }

  function collideShapeStatic(sh, st) {
    if (sh.type === "circle" && st.type === "aabb") return circleAABB(sh.x, sh.y, sh.r, st);
    if (sh.type === "circle" && st.type === "segment") return circleSegment(sh.x, sh.y, sh.r, st);
    if (sh.type === "circle" && st.type === "obb") {
      return circleOBB(sh, { x: st.x, y: st.y, hw: st.hw, hh: st.hh, cos: st.cos, sin: st.sin, angle: st.angle });
    }
    if (sh.type === "box" && st.type === "aabb") return boxAABB(sh, st);
    if (sh.type === "box" && st.type === "segment") return boxSegment(sh, st);
    if (sh.type === "box" && st.type === "obb") return boxOBB(sh, st);
    return null;
  }

  function collideShapeShape(a, b) {
    if (a.type === "circle" && b.type === "circle") return circleCircle(a, b);
    if (a.type === "circle" && b.type === "box") return circleOBB(a, b);
    if (a.type === "box" && b.type === "circle") {
      var h = circleOBB(b, a);
      if (h) {
        h.nx = -h.nx;
        h.ny = -h.ny;
      }
      return h;
    }
    if (a.type === "box" && b.type === "box") {
      return obbObb(a.x, a.y, a.hw, a.hh, a.cos, a.sin, b.x, b.y, b.hw, b.hh, b.cos, b.sin);
    }
    return null;
  }

  function circleCircle(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    var r = a.r + b.r;
    var d2 = dx * dx + dy * dy;
    if (d2 > r * r || d2 === 0) {
      if (d2 === 0) return { nx: 0, ny: -1, pen: r, px: a.x, py: a.y };
      return null;
    }
    var d = Math.sqrt(d2);
    var nx = dx / d;
    var ny = dy / d;
    return {
      nx: nx,
      ny: ny,
      pen: r - d,
      px: b.x + nx * b.r,
      py: b.y + ny * b.r
    };
  }

  function circleAABB(cx, cy, r, st) {
    var x = st.x;
    var y = st.y;
    var w = st.w;
    var h = st.h;
    var px = clamp(cx, x, x + w);
    var py = clamp(cy, y, y + h);
    var inside = cx >= x && cx <= x + w && cy >= y && cy <= y + h;
    if (inside) {
      var faces = [
        { nx: -1, ny: 0, dist: cx - x, px: x, py: cy },
        { nx: 1, ny: 0, dist: x + w - cx, px: x + w, py: cy },
        { nx: 0, ny: -1, dist: cy - y, px: cx, py: y },
        { nx: 0, ny: 1, dist: y + h - cy, px: cx, py: y + h }
      ];
      if (w < h * 0.4) {
        faces[2].dist += 2000;
        faces[3].dist += 2000;
      }
      if (h < w * 0.4) {
        faces[0].dist += 2000;
        faces[1].dist += 2000;
      }
      var bestF = faces[0];
      var fi, f, score, bestScore;
      bestScore = bestF.dist - 0.002 * (bestF.nx * (400 - cx) + bestF.ny * (225 - cy));
      for (fi = 1; fi < 4; fi++) {
        f = faces[fi];
        score = f.dist - 0.002 * (f.nx * (400 - cx) + f.ny * (225 - cy));
        if (score < bestScore) {
          bestScore = score;
          bestF = f;
        }
      }
      return { nx: bestF.nx, ny: bestF.ny, pen: r + bestF.dist, px: bestF.px, py: bestF.py };
    }
    var dx = cx - px;
    var dy = cy - py;
    var d2 = dx * dx + dy * dy;
    if (d2 > r * r) return null;
    var d = Math.sqrt(d2) || 0.0001;
    return { nx: dx / d, ny: dy / d, pen: r - d, px: px, py: py };
  }

  function circleSegment(cx, cy, r, st) {
    var dx = st.x2 - st.x1;
    var dy = st.y2 - st.y1;
    var len2 = dx * dx + dy * dy || 0.0001;
    var t = clamp(((cx - st.x1) * dx + (cy - st.y1) * dy) / len2, 0, 1);
    var px = st.x1 + dx * t;
    var py = st.y1 + dy * t;
    var ex = cx - px;
    var ey = cy - py;
    var rad = r + st.r;
    var d2 = ex * ex + ey * ey;
    if (d2 > rad * rad) return null;
    var d = Math.sqrt(d2) || 0.0001;
    return { nx: ex / d, ny: ey / d, pen: rad - d, px: px, py: py };
  }

  function closestOnOBB(px, py, cx, cy, hw, hh, cos, sin) {
    var dx = px - cx;
    var dy = py - cy;
    var lx = dx * cos + dy * sin;
    var ly = -dx * sin + dy * cos;
    var clx = clamp(lx, -hw, hw);
    var cly = clamp(ly, -hh, hh);
    return {
      x: cx + clx * cos - cly * sin,
      y: cy + clx * sin + cly * cos,
      lx: lx,
      ly: ly,
      inside: Math.abs(lx) <= hw && Math.abs(ly) <= hh
    };
  }

  function circleOBB(cir, box) {
    var c = closestOnOBB(cir.x, cir.y, box.x, box.y, box.hw, box.hh, box.cos, box.sin);
    if (c.inside) {
      var dl = c.lx + box.hw;
      var dr = box.hw - c.lx;
      var dt = c.ly + box.hh;
      var db = box.hh - c.ly;
      if (box.hw > box.hh * 1.12) {
        dl += 50;
        dr += 50;
      } else if (box.hh > box.hw * 1.12) {
        dt += 50;
        db += 50;
      }
      var m = Math.min(dl, dr, dt, db);
      var nx, ny, pen;
      if (m === dl) {
        nx = -box.cos;
        ny = -box.sin;
        pen = cir.r + dl;
      } else if (m === dr) {
        nx = box.cos;
        ny = box.sin;
        pen = cir.r + dr;
      } else if (m === dt) {
        nx = box.sin;
        ny = -box.cos;
        pen = cir.r + dt;
      } else {
        nx = -box.sin;
        ny = box.cos;
        pen = cir.r + db;
      }
      return { nx: nx, ny: ny, pen: pen, px: cir.x - nx * cir.r, py: cir.y - ny * cir.r };
    }
    var dx = cir.x - c.x;
    var dy = cir.y - c.y;
    var d2 = dx * dx + dy * dy;
    if (d2 > cir.r * cir.r) return null;
    var d = Math.sqrt(d2) || 0.0001;
    return { nx: dx / d, ny: dy / d, pen: cir.r - d, px: c.x, py: c.y };
  }

  function projectOBB(cx, cy, hw, hh, cos, sin, ax, ay) {
    var ex = hw * Math.abs(cos * ax + sin * ay) + hh * Math.abs(-sin * ax + cos * ay);
    var mid = cx * ax + cy * ay;
    return [mid - ex, mid + ex];
  }

  function supportOBB(cx, cy, hw, hh, cos, sin, dx, dy) {
    var lx = dx * cos + dy * sin;
    var ly = -dx * sin + dy * cos;
    var sx = lx >= 0 ? hw : -hw;
    var sy = ly >= 0 ? hh : -hh;
    return {
      x: cx + sx * cos - sy * sin,
      y: cy + sx * sin + sy * cos
    };
  }

  function obbObb(ax, ay, ahw, ahh, ac, as, bx, by, bhw, bhh, bc, bs) {
    var axes = [
      [ac, as],
      [-as, ac],
      [bc, bs],
      [-bs, bc]
    ];
    var minPen = Infinity;
    var nx = 0;
    var ny = 0;
    var i, amin, amax, bmin, bmax, overlap, pr;
    for (i = 0; i < 4; i++) {
      pr = projectOBB(ax, ay, ahw, ahh, ac, as, axes[i][0], axes[i][1]);
      amin = pr[0];
      amax = pr[1];
      pr = projectOBB(bx, by, bhw, bhh, bc, bs, axes[i][0], axes[i][1]);
      bmin = pr[0];
      bmax = pr[1];
      overlap = Math.min(amax, bmax) - Math.max(amin, bmin);
      if (overlap <= 0) return null;
      if (overlap < minPen) {
        minPen = overlap;
        nx = axes[i][0];
        ny = axes[i][1];
      }
    }
    if ((ax - bx) * nx + (ay - by) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    var p = supportOBB(bx, by, bhw, bhh, bc, bs, nx, ny);
    return { nx: nx, ny: ny, pen: minPen, px: p.x, py: p.y };
  }

  function boxOBB(box, st) {
    var obb = { x: st.x, y: st.y, hw: st.hw, hh: st.hh, cos: st.cos, sin: st.sin, angle: st.angle };
    var best = null;
    var sx = [1, 1, -1, -1, 0];
    var sy = [1, -1, 1, -1, 0];
    var i, lx, ly, hit;
    for (i = 0; i < 5; i++) {
      lx = sx[i] * box.hw;
      ly = sy[i] * box.hh;
      hit = circleOBB(
        {
          x: box.x + lx * box.cos - ly * box.sin,
          y: box.y + lx * box.sin + ly * box.cos,
          r: i === 4 ? Math.min(box.hw, box.hh) * 0.35 : 2.2
        },
        obb
      );
      if (hit && (!best || hit.pen > best.pen)) best = hit;
    }
    return best;
  }

  function boxAABB(box, st) {
    var best = null;
    var sx = [1, 1, -1, -1, 0];
    var sy = [1, -1, 1, -1, 0];
    var i, lx, ly, px, py, r, hit;
    for (i = 0; i < 5; i++) {
      lx = sx[i] * box.hw;
      ly = sy[i] * box.hh;
      px = box.x + lx * box.cos - ly * box.sin;
      py = box.y + lx * box.sin + ly * box.cos;
      r = i === 4 ? Math.min(box.hw, box.hh) * 0.4 : 2;
      hit = circleAABB(px, py, r, st);
      if (hit && (!best || hit.pen > best.pen)) best = hit;
    }
    return best;
  }

  function boxSegment(box, st) {
    var best = null;
    var sx = [1, 1, -1, -1];
    var sy = [1, -1, 1, -1];
    var i, lx, ly, px, py, hit;
    for (i = 0; i < 4; i++) {
      lx = sx[i] * box.hw;
      ly = sy[i] * box.hh;
      px = box.x + lx * box.cos - ly * box.sin;
      py = box.y + lx * box.sin + ly * box.cos;
      hit = circleSegment(px, py, 1.2, st);
      if (hit && (!best || hit.pen > best.pen)) best = hit;
    }
    hit = circleSegment(box.x, box.y, Math.min(box.hw, box.hh) * 0.5, st);
    if (hit && (!best || hit.pen > best.pen)) best = hit;
    return best;
  }

  function solveVelocity(c, dt) {
    var a = c.a;
    var b = c.b;
    var nx = c.nx;
    var ny = c.ny;
    var px = c.px;
    var py = c.py;

    var rax = px - a.x;
    var ray = py - a.y;
    var rbx = 0;
    var rby = 0;
    var vbx = 0;
    var vby = 0;
    if (b) {
      rbx = px - b.x;
      rby = py - b.y;
      vbx = b.vx - b.av * rby;
      vby = b.vy + b.av * rbx;
    }
    var vax = a.vx - a.av * ray;
    var vay = a.vy + a.av * rax;
    var rvx = vax - vbx;
    var rvy = vay - vby;
    var velN = rvx * nx + rvy * ny;

    var raCrossN = rax * ny - ray * nx;
    var rbCrossN = rbx * ny - rby * nx;
    var inv =
      a.invMass +
      (b ? b.invMass : 0) +
      raCrossN * raCrossN * a.invInertia +
      (b ? rbCrossN * rbCrossN * b.invInertia : 0);
    if (inv <= 1e-8) return;

    var slop = 0.08;
    var bias = (0.28 / dt) * Math.max(c.pen - slop, 0);

    var eA = a.restitution;
    var eB = b ? b.restitution : c.staticMeta && c.staticMeta.restitution != null ? c.staticMeta.restitution : 0.22;
    var e = Math.max(eA, eB);
    var isBall = a.tag === "ball" || (b && b.tag === "ball");
    if (velN > (isBall ? -22 : -70)) e = 0;

    var j = -((1 + e) * velN - bias) / inv;
    if (j < 0) j = 0;

    var jx = j * nx;
    var jy = j * ny;
    a.applyImpulse(jx, jy, px, py);
    if (b) b.applyImpulse(-jx, -jy, px, py);
    c.impulse += j;

    vax = a.vx - a.av * ray;
    vay = a.vy + a.av * rax;
    if (b) {
      vbx = b.vx - b.av * rby;
      vby = b.vy + b.av * rbx;
    } else {
      vbx = 0;
      vby = 0;
    }
    rvx = vax - vbx;
    rvy = vay - vby;
    velN = rvx * nx + rvy * ny;
    var tx = rvx - velN * nx;
    var ty = rvy - velN * ny;
    var tl = hypot(tx, ty);
    if (tl < 0.001) return;
    tx /= tl;
    ty /= tl;

    var raCrossT = rax * ty - ray * tx;
    var rbCrossT = rbx * ty - rby * tx;
    var invT =
      a.invMass +
      (b ? b.invMass : 0) +
      raCrossT * raCrossT * a.invInertia +
      (b ? rbCrossT * rbCrossT * b.invInertia : 0);
    if (invT <= 1e-8) return;

    var velT = rvx * tx + rvy * ty;
    var motor = 0;
    var powered = !b && a.driveSpeed && c.sa && c.sa.meta && c.sa.meta.part && String(c.sa.meta.part).indexOf("wheel") === 0;
    if (powered) {
      var mx = -ny;
      var my = nx;
      var hx = Math.cos(a.angle);
      var hy = Math.sin(a.angle);
      if (mx * hx + my * hy < 0) {
        mx = -mx;
        my = -my;
      }
      tx = mx;
      ty = my;
      velT = rvx * tx + rvy * ty;
      motor = a.driveSpeed;
    }
    var jt = -(velT - motor) / invT;
    var mu = Math.sqrt(a.friction * (b ? b.friction : c.staticMeta && c.staticMeta.friction != null ? c.staticMeta.friction : 0.55));
    var maxF = Math.abs(j) * mu + (powered ? 10 : 0.6);
    if (jt > maxF) jt = maxF;
    if (jt < -maxF) jt = -maxF;
    a.applyImpulse(jt * tx, jt * ty, px, py);
    if (b) b.applyImpulse(-jt * tx, -jt * ty, px, py);
  }

  function solvePosition(c, lastPass) {
    var a = c.a;
    var b = c.b;
    var slop = 0.04;
    var pen = c.pen - slop;
    if (pen <= 0) return;
    var percent = lastPass ? 1 : b ? 0.7 : 0.95;
    var corr = pen * percent;
    var sumInv = a.invMass + (b ? b.invMass : 0);
    if (sumInv <= 1e-8) return;
    var mx = c.nx * corr;
    var my = c.ny * corr;
    var ca = a.invMass / sumInv;
    a.x += mx * ca;
    a.y += my * ca;
    if (b) {
      var cb = b.invMass / sumInv;
      b.x -= mx * cb;
      b.y -= my * cb;
    }
    var vn = a.vx * c.nx + a.vy * c.ny;
    if (b) vn -= b.vx * c.nx + b.vy * c.ny;
    if (vn < 0) {
      a.vx -= vn * c.nx * (b ? 0.5 : 1);
      a.vy -= vn * c.ny * (b ? 0.5 : 1);
      if (b) {
        b.vx += vn * c.nx * 0.5;
        b.vy += vn * c.ny * 0.5;
      }
    }
  }

  function separateFromStatics(world) {
    var pass, i, si, j, body, sh, st, hit, best, vn;
    for (pass = 0; pass < 6; pass++) {
      var moved = false;
      for (i = 0; i < world.bodies.length; i++) {
        body = world.bodies[i];
        if (!body.alive || !body.invMass) continue;
        best = null;
        for (si = 0; si < body.shapes.length; si++) {
          sh = shapeWorld(body, body.shapes[si]);
          for (j = 0; j < world.statics.length; j++) {
            st = world.statics[j];
            hit = collideShapeStatic(sh, st);
            if (hit && (!best || hit.pen > best.pen)) best = hit;
          }
        }
        if (best && best.pen > 0.04) {
          body.x += best.nx * best.pen;
          body.y += best.ny * best.pen;
          vn = body.vx * best.nx + body.vy * best.ny;
          if (vn < 0) {
            body.vx -= vn * best.nx;
            body.vy -= vn * best.ny;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  function separateHulls(world) {
    var bodies = world.bodies;
    var i, j, a, b, dx, dy, d, minD, pen, nx, ny, inv, ca, cb, vn;
    for (i = 0; i < bodies.length; i++) {
      a = bodies[i];
      if (!a.alive || !a.hullR || !a.invMass) continue;
      for (j = i + 1; j < bodies.length; j++) {
        b = bodies[j];
        if (!b.alive || !b.hullR) continue;
        dx = a.x - b.x;
        dy = a.y - b.y;
        d = Math.sqrt(dx * dx + dy * dy);
        minD = a.hullR + b.hullR;
        if (d >= minD) continue;
        if (d < 0.0001) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        pen = minD - d;
        nx = dx / d;
        ny = dy / d;
        inv = a.invMass + b.invMass;
        if (inv <= 0) continue;
        ca = a.invMass / inv;
        cb = b.invMass / inv;
        a.x += nx * pen * ca;
        a.y += ny * pen * ca;
        b.x -= nx * pen * cb;
        b.y -= ny * pen * cb;
        vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vn < 0) {
          a.vx -= vn * nx * ca;
          a.vy -= vn * ny * ca;
          b.vx += vn * nx * cb;
          b.vy += vn * ny * cb;
        }
      }
    }
  }

  function clampBodies(world) {
    var i, b, m;
    for (i = 0; i < world.bodies.length; i++) {
      b = world.bodies[i];
      if (!b.alive || !b.invMass) continue;
      m = b.hullR || 18;
      if (b.x < 16 + m * 0.55) {
        b.x = 16 + m * 0.55;
        if (b.vx < 0) b.vx = 0;
      }
      if (b.x > 784 - m * 0.55) {
        b.x = 784 - m * 0.55;
        if (b.vx > 0) b.vx = 0;
      }
      if (b.y < 16 + m * 0.45) {
        b.y = 16 + m * 0.45;
        if (b.vy < 0) b.vy = 0;
      }
      if (b.y > 418) {
        b.y = 408;
        if (b.vy > 0) b.vy = 0;
      }
    }
  }

  global.RWPhysics = {
    Body: Body,
    World: World,
    clamp: clamp,
    hypot: hypot
  };
})(window);
