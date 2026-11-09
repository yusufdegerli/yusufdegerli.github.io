// Falling-liquid cellular automaton.
// Each tick scans bottom-up (alternating horizontal direction to avoid bias):
// water falls, then slides diagonally, then disperses sideways up to N cells,
// keeping a per-cell flow direction so sheets of water travel instead of jitter.

import { createRunner, readPalette, mix } from './runner.js';

const W = 160;
const H = 120;
const EMPTY = 0;
const WALL = 1;
const WATER = 2;
const DISPERSION = 4;
const CAPACITY = 2600;
const MODES = ['water', 'wall', 'erase'];

export function mount(root, t) {
  const canvas = root.querySelector('canvas');
  const stat = root.querySelector('[data-stat]');
  const modeButton = root.querySelector('[data-action="mode"]');
  const resetButton = root.querySelector('[data-action="reset"]');

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);

  const cells = new Uint8Array(W * H);
  const flow = new Int8Array(W * H);
  const stamp = new Uint32Array(W * H);
  let tick = 0;
  let water = 0;

  // ---- scene ---------------------------------------------------------------
  function paintLine(x0, y0, x1, y1, thickness, value) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i += 1) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      for (let dy = 0; dy < thickness; dy += 1) setCell(x, y + dy, value);
    }
  }

  function setCell(x, y, value) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const k = y * W + x;
    if (cells[k] === WATER) water -= 1;
    if (value === WATER) water += 1;
    cells[k] = value;
    flow[k] = value === WATER ? (Math.random() < 0.5 ? -1 : 1) : 0;
  }

  function buildScene() {
    cells.fill(EMPTY);
    flow.fill(0);
    water = 0;

    for (let x = 0; x < W; x += 1) {
      let ground = Math.round(H - (14 + 7 * Math.sin(x * 0.045 + 0.6) + 4 * Math.sin(x * 0.12 + 2)));
      if (x > W - 12) ground = H - 3; // low lip on the right: overflow drains off-screen
      for (let y = ground; y < H; y += 1) cells[y * W + x] = WALL;
    }

    paintLine(12, 36, 88, 54, 2, WALL); // sloped ledge: pours into the basin
    paintLine(78, 58, 78, 79, 2, WALL); // basin
    paintLine(78, 79, 112, 79, 2, WALL);
    paintLine(112, 64, 112, 79, 2, WALL);
    paintLine(120, 42, 150, 34, 2, WALL); // upper shelf for visitors to pour onto
  }

  // ---- simulation ----------------------------------------------------------
  function move(from, to) {
    cells[to] = WATER;
    flow[to] = flow[from];
    stamp[to] = tick;
    cells[from] = EMPTY;
    flow[from] = 0;
  }

  function drain(k) {
    cells[k] = EMPTY;
    flow[k] = 0;
    water -= 1;
  }

  function updateCell(x, y) {
    const k = y * W + x;
    if (y === H - 1) return drain(k);

    const below = k + W;
    if (cells[below] === EMPTY) return move(k, below);

    const d = flow[k] || (Math.random() < 0.5 ? -1 : 1);

    for (const s of [d, -d]) {
      const nx = x + s;
      if (nx < 0 || nx >= W) return drain(k);
      if (cells[k + s] === EMPTY && cells[below + s] === EMPTY) {
        flow[k] = s;
        return move(k, below + s);
      }
    }

    for (const s of [d, -d]) {
      let target = x;
      for (let n = 1; n <= DISPERSION; n += 1) {
        const nx = x + s * n;
        if (nx < 0 || nx >= W) return drain(k);
        if (cells[y * W + nx] !== EMPTY) break;
        target = nx;
        if (cells[(y + 1) * W + nx] === EMPTY) break; // found an edge to fall from
      }
      if (target !== x) {
        flow[k] = s;
        return move(k, y * W + target);
      }
    }
    flow[k] = -d; // blocked both ways: try the other side next tick
  }

  // ---- input ---------------------------------------------------------------
  let mode = 'water';
  let pointer = null; // { x, y, tool }

  function toCell(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * W),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * H),
    };
  }

  function applyBrush() {
    if (!pointer) return;
    const { x, y, tool } = pointer;
    const r = tool === 'water' ? 3 : 2;
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx * dx + dy * dy > r * r) continue;
        const cx = x + dx;
        const cy = y + dy;
        if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
        const current = cells[cy * W + cx];
        if (tool === 'water') {
          if (current === EMPTY && water < CAPACITY * 1.6 && Math.random() < 0.45) setCell(cx, cy, WATER);
        } else if (tool === 'wall') {
          setCell(cx, cy, WALL);
        } else if (current !== EMPTY) {
          setCell(cx, cy, EMPTY);
        }
      }
    }
  }

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    const tool = event.button === 2 || event.shiftKey ? 'wall' : event.altKey ? 'erase' : mode;
    pointer = { ...toCell(event), tool };
    runner.wake();
    applyBrush();
    root.querySelector('.demo-hint')?.style.setProperty('opacity', '0');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointer) return;
    Object.assign(pointer, toCell(event));
    if (pointer.tool !== 'water') applyBrush();
  });
  const release = () => {
    pointer = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const modeLabel = () => t(`js.liquid.mode_${mode}`, { water: 'Water', wall: 'Wall', erase: 'Erase' }[mode]);
  modeButton?.addEventListener('click', () => {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    modeButton.textContent = modeLabel();
  });
  resetButton?.addEventListener('click', () => {
    buildScene();
    runner.renderOnce();
  });
  document.addEventListener('langchange', () => {
    if (modeButton) modeButton.textContent = modeLabel();
  });
  if (modeButton) modeButton.textContent = modeLabel();

  // ---- rendering -----------------------------------------------------------
  let colors;
  function updateColors() {
    const p = readPalette(['surface-2', 'faint', 'muted', 'accent', 'text', 'bg']);
    colors = {
      empty: p['surface-2'],
      wall: mix(p['surface-2'], p.faint, 0.55),
      wallTop: mix(p['surface-2'], p.muted, 0.95),
      foam: mix(p.accent, p.text, 0.45),
      water: p.accent,
      deep: mix(p.accent, p.bg, 0.55),
    };
  }
  updateColors();
  document.addEventListener('themechange', () => {
    updateColors();
    runner.renderOnce();
  });

  function render() {
    const data = image.data;
    for (let x = 0; x < W; x += 1) {
      let depth = 0;
      for (let y = 0; y < H; y += 1) {
        const k = y * W + x;
        const cell = cells[k];
        let c;
        if (cell === WATER) {
          c = depth < 1 ? colors.foam : mix(colors.water, colors.deep, Math.min(depth / 26, 1));
          depth += 1;
        } else {
          depth = 0;
          c = cell === WALL ? (y > 0 && cells[k - W] !== WALL ? colors.wallTop : colors.wall) : colors.empty;
        }
        const o = k * 4;
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function step() {
    tick += 1;
    applyBrushIfPouring();

    if (water < CAPACITY) {
      for (let x = 24; x <= 28; x += 2) if (cells[2 * W + x] === EMPTY) setCell(x, 2, WATER);
    }

    const leftToRight = (tick & 1) === 0;
    for (let y = H - 1; y >= 0; y -= 1) {
      for (let i = 0; i < W; i += 1) {
        const x = leftToRight ? i : W - 1 - i;
        const k = y * W + x;
        if (cells[k] === WATER && stamp[k] !== tick) updateCell(x, y);
      }
    }
  }

  function applyBrushIfPouring() {
    if (pointer?.tool === 'water') applyBrush();
  }

  buildScene();
  for (let i = 0; i < 420; i += 1) step(); // warm start so the first frame isn't empty

  const runner = createRunner({
    root,
    step,
    render,
    hz: 60,
    t,
    onStats: (tps) => {
      if (stat) stat.textContent = `${water.toLocaleString('en-US')} cells · ${tps} t/s`;
    },
  });
  render();
  if (stat) stat.textContent = `${water.toLocaleString('en-US')} cells`;
}
