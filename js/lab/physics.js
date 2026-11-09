// Position-based Verlet physics: circles, a pinned chain, and relaxation of
// collision + distance constraints. Velocity is implicit (pos − prev), which
// makes dragging-and-throwing fall out of the integrator for free.

import { createRunner, readPalette, rgb } from './runner.js';

const GRAVITY = 1400; // px/s²
const DAMPING = 0.996;
const ITERATIONS = 5;
const MAX_BODIES = 70;
const LINKS = 16;

export function mount(root, t) {
  const canvas = root.querySelector('canvas');
  const stat = root.querySelector('[data-stat]');
  const hint = root.querySelector('.demo-hint');
  const resetButton = root.querySelector('[data-action="reset"]');
  const ctx = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let dpr = 1;
  let colors;
  let bodies = [];
  let links = [];
  let grabbed = null;
  let pointer = null;

  const body = (x, y, r, opts = {}) => ({ x, y, px: x, py: y, r, pinned: false, accent: false, rope: false, ...opts });

  function build() {
    bodies = [];
    links = [];
    const anchorX = width * 0.72;
    let prev = null;
    for (let i = 0; i < LINKS; i += 1) {
      const node = body(anchorX + i * 12, 14 + i * 2, i === LINKS - 1 ? 16 : 4, {
        pinned: i === 0,
        rope: true,
        accent: i === LINKS - 1,
      });
      bodies.push(node);
      if (prev) links.push({ a: prev, b: node, length: 14 });
      prev = node;
    }
    for (let i = 0; i < 26; i += 1) spawn(width * (0.08 + Math.random() * 0.5), height * Math.random() * 0.5);
  }

  function spawn(x, y) {
    const free = bodies.filter((b) => !b.rope);
    if (free.length >= MAX_BODIES) bodies.splice(bodies.indexOf(free[0]), 1);
    const r = 7 + Math.random() * 15;
    const b = body(x, y, r, { accent: Math.random() < 0.18 });
    b.px = x - (Math.random() - 0.5) * 4;
    bodies.push(b);
  }

  // ---- sizing --------------------------------------------------------------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const first = width === 0;
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (first) build();
    else bodies.filter((b) => b.pinned).forEach((b) => {
      b.x = b.px = width * 0.72;
    });
    runner?.renderOnce();
  }

  function updateColors() {
    const p = readPalette(['surface-2', 'text', 'muted', 'faint', 'accent', 'line-strong', 'bg']);
    colors = p;
  }
  updateColors();
  document.addEventListener('themechange', () => {
    updateColors();
    runner.renderOnce();
  });

  // ---- input ---------------------------------------------------------------
  const local = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointer = local(event);
    grabbed = null;
    let best = Infinity;
    for (const b of bodies) {
      const d = Math.hypot(b.x - pointer.x, b.y - pointer.y);
      if (d < b.r + 10 && d < best && !b.pinned) {
        best = d;
        grabbed = b;
      }
    }
    if (!grabbed) spawn(pointer.x, pointer.y);
    runner.wake();
    if (hint) hint.style.opacity = '0';
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointer) pointer = local(event);
  });
  const release = () => {
    pointer = null;
    grabbed = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  resetButton?.addEventListener('click', () => {
    build();
    runner.renderOnce();
  });

  // ---- simulation ----------------------------------------------------------
  function step(dt) {
    const g = GRAVITY * dt * dt;
    for (const b of bodies) {
      if (b.pinned) continue;
      const vx = (b.x - b.px) * DAMPING;
      const vy = (b.y - b.py) * DAMPING;
      b.px = b.x;
      b.py = b.y;
      b.x += vx;
      b.y += vy + g;
    }

    if (grabbed && pointer) {
      // Ease toward the pointer; prev keeps last position so release throws.
      grabbed.x += (pointer.x - grabbed.x) * 0.5;
      grabbed.y += (pointer.y - grabbed.y) * 0.5;
    }

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      for (const link of links) solveLink(link);
      solveCollisions();
      for (const b of bodies) solveBounds(b);
    }
  }

  function solveLink({ a, b, length }) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const diff = (d - length) / d;
    const wa = a.pinned ? 0 : 0.5;
    const wb = b.pinned ? 0 : 0.5;
    const total = wa + wb || 1;
    a.x += dx * diff * (wa / total);
    a.y += dy * diff * (wa / total);
    b.x -= dx * diff * (wb / total);
    b.y -= dy * diff * (wb / total);
  }

  function solveCollisions() {
    for (let i = 0; i < bodies.length; i += 1) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j += 1) {
        const b = bodies[j];
        if (a.rope && b.rope) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        const ma = a.pinned ? 0 : a.r * a.r;
        const mb = b.pinned ? 0 : b.r * b.r;
        const total = ma + mb || 1;
        // Heavier bodies move less.
        a.x -= dx * push * (mb / total);
        a.y -= dy * push * (mb / total);
        b.x += dx * push * (ma / total);
        b.y += dy * push * (ma / total);
      }
    }
  }

  function solveBounds(b) {
    if (b.pinned) return;
    const friction = 0.9;
    if (b.y > height - b.r) {
      b.y = height - b.r;
      b.px = b.x - (b.x - b.px) * friction;
    }
    if (b.y < b.r) b.y = b.r;
    if (b.x < b.r) b.x = b.r;
    if (b.x > width - b.r) b.x = width - b.r;
  }

  // ---- rendering -----------------------------------------------------------
  function render() {
    if (!width) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = rgb(colors['surface-2']);
    ctx.fillRect(0, 0, width, height);

    // Baseline grid, like graph paper.
    ctx.strokeStyle = rgb(colors['line-strong'], 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 24; x < width; x += 24) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = 24; y < height; y += 24) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();

    // Chain
    ctx.strokeStyle = rgb(colors.muted);
    ctx.lineWidth = 2;
    ctx.beginPath();
    links.forEach(({ a, b }, i) => {
      if (i === 0) ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    });
    ctx.stroke();

    for (const b of bodies) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      if (b.rope && !b.accent) {
        ctx.fillStyle = rgb(colors.muted);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = b.accent ? rgb(colors.accent) : rgb(colors.bg);
      ctx.fill();
      ctx.lineWidth = b === grabbed ? 2 : 1.25;
      ctx.strokeStyle = b === grabbed || b.accent ? rgb(colors.accent) : rgb(colors.faint);
      ctx.stroke();

      // Velocity tick: a short line showing (pos − prev), i.e. the Verlet velocity.
      const vx = b.x - b.px;
      const vy = b.y - b.py;
      if (Math.abs(vx) + Math.abs(vy) > 0.6) {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + vx * 4, b.y + vy * 4);
        ctx.strokeStyle = rgb(b.accent ? colors.bg : colors.text, 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    const anchor = bodies.find((b) => b.pinned);
    if (anchor) {
      ctx.fillStyle = rgb(colors.text);
      ctx.fillRect(anchor.x - 7, anchor.y - 3, 14, 3);
    }
  }

  const runner = createRunner({
    root,
    step,
    render,
    hz: 120,
    t,
    onStats: (tps) => {
      if (stat) stat.textContent = `${bodies.length} bodies · ${tps} Hz`;
    },
  });
  new ResizeObserver(resize).observe(canvas);
  resize();
}
