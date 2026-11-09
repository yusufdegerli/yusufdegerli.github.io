// Grid raycaster (DDA) — the same algorithm as my C engine (cub3D), re-written
// for the browser. One ray per screen column; perpendicular distance avoids the
// fisheye effect; wall height = screenHeight / distance.

import { createRunner, readPalette, rgb, mix } from './runner.js';

const MAP = [
  '1111111111111111',
  '1000000000100001',
  '1011100000100001',
  '1010000220000001',
  '1010000220001111',
  '1000000000000001',
  '1000111000000001',
  '1000100000110001',
  '1000100000110001',
  '1000000000000001',
  '1022000100000221',
  '1000000100000001',
  '1000000111100001',
  '1000000000000001',
  '1000010000000001',
  '1111111111111111',
].map((row) => [...row].map(Number));

const FOV = 0.66; // camera plane length → ~66° field of view
const MOVE_SPEED = 2.6; // cells per second
const TURN_SPEED = 2.2; // radians per second
const RADIUS = 0.22;
const IDLE_AFTER = 4; // seconds without input before autopilot resumes

const isWall = (x, y) => MAP[Math.floor(y)]?.[Math.floor(x)] !== 0;

export function mount(root, t) {
  const canvas = root.querySelector('canvas');
  const stat = root.querySelector('[data-stat]');
  const hint = root.querySelector('.demo-hint');
  const ctx = canvas.getContext('2d', { alpha: false });

  const player = { x: 3.5, y: 9.5, angle: -0.6 };
  const keys = new Set();
  let idle = IDLE_AFTER;
  let drag = null;
  let width = 0;
  let height = 0;
  let colors;

  // ---- sizing --------------------------------------------------------------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.75; // slightly under native: crisp enough, cheap
    const ratio = Math.min(1, 960 / (rect.width * scale)); // cap at 960 rays per frame
    width = Math.max(240, Math.round(rect.width * scale * ratio));
    height = Math.max(120, Math.round(rect.height * scale * ratio));
    canvas.width = width;
    canvas.height = height;
    runner?.renderOnce();
  }
  new ResizeObserver(resize).observe(canvas);

  function updateColors() {
    const p = readPalette(['bg', 'surface-2', 'text', 'muted', 'faint', 'accent', 'line-strong']);
    colors = {
      sky: p['surface-2'],
      floor: p.bg,
      wall: mix(p.text, p['surface-2'], 0.28),
      accent: p.accent,
      fog: p['surface-2'],
      faint: p.faint,
      muted: p.muted,
    };
  }
  updateColors();
  document.addEventListener('themechange', () => {
    updateColors();
    runner.renderOnce();
  });

  // ---- input ---------------------------------------------------------------
  const CONTROL_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e']);

  canvas.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (!CONTROL_KEYS.has(key)) return;
    event.preventDefault();
    keys.add(key);
    interact();
  });
  canvas.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  canvas.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    drag = { x: event.clientX };
    interact();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    player.angle += (event.clientX - drag.x) * 0.006;
    drag.x = event.clientX;
    interact();
  });
  const endDrag = () => {
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function interact() {
    idle = 0;
    runner.wake();
    if (hint) hint.style.opacity = '0';
  }

  // ---- simulation ----------------------------------------------------------
  function tryMove(dx, dy) {
    const nx = player.x + dx;
    const ny = player.y + dy;
    const sx = Math.sign(dx) * RADIUS;
    const sy = Math.sign(dy) * RADIUS;
    if (!isWall(nx + sx, player.y)) player.x = nx;
    if (!isWall(player.x, ny + sy)) player.y = ny;
  }

  function castDistance(angle) {
    return castRay(Math.cos(angle), Math.sin(angle)).distance;
  }

  function step(dt) {
    idle += dt;
    let forward = 0;
    let strafe = 0;
    let turn = 0;

    if (idle < IDLE_AFTER) {
      if (keys.has('w') || keys.has('arrowup')) forward += 1;
      if (keys.has('s') || keys.has('arrowdown')) forward -= 1;
      if (keys.has('a')) strafe -= 1;
      if (keys.has('d')) strafe += 1;
      if (keys.has('arrowleft') || keys.has('q')) turn -= 1;
      if (keys.has('arrowright') || keys.has('e')) turn += 1;
      if (keys.size) idle = 0;
    } else {
      // Autopilot: walk forward, steer toward whichever side is more open.
      const ahead = castDistance(player.angle);
      const left = castDistance(player.angle - 0.5);
      const right = castDistance(player.angle + 0.5);
      forward = ahead > 1.4 ? 0.55 : 0;
      turn = ahead > 2.2 ? (right - left) * 0.08 : right >= left ? 0.9 : -0.9;
    }

    player.angle += turn * TURN_SPEED * dt;
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    tryMove((cos * forward - sin * strafe) * MOVE_SPEED * dt, (sin * forward + cos * strafe) * MOVE_SPEED * dt);
  }

  // ---- DDA -----------------------------------------------------------------
  function castRay(rayX, rayY) {
    let mapX = Math.floor(player.x);
    let mapY = Math.floor(player.y);
    const deltaX = rayX === 0 ? 1e30 : Math.abs(1 / rayX);
    const deltaY = rayY === 0 ? 1e30 : Math.abs(1 / rayY);
    const stepX = rayX < 0 ? -1 : 1;
    const stepY = rayY < 0 ? -1 : 1;
    let sideX = rayX < 0 ? (player.x - mapX) * deltaX : (mapX + 1 - player.x) * deltaX;
    let sideY = rayY < 0 ? (player.y - mapY) * deltaY : (mapY + 1 - player.y) * deltaY;
    let side = 0;

    for (let i = 0; i < 64; i += 1) {
      if (sideX < sideY) {
        sideX += deltaX;
        mapX += stepX;
        side = 0;
      } else {
        sideY += deltaY;
        mapY += stepY;
        side = 1;
      }
      if (MAP[mapY]?.[mapX] !== 0) break;
    }

    const distance = side === 0 ? sideX - deltaX : sideY - deltaY;
    const hit = side === 0 ? player.y + distance * rayY : player.x + distance * rayX;
    return { distance, side, tile: MAP[mapY]?.[mapX] ?? 1, u: hit - Math.floor(hit) };
  }

  // ---- rendering -----------------------------------------------------------
  function render() {
    if (!width) return;
    const half = height / 2;

    const sky = ctx.createLinearGradient(0, 0, 0, half);
    sky.addColorStop(0, rgb(colors.sky));
    sky.addColorStop(1, rgb(mix(colors.sky, colors.fog, 0.5)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, half);

    const floor = ctx.createLinearGradient(0, half, 0, height);
    floor.addColorStop(0, rgb(mix(colors.floor, colors.fog, 0.85)));
    floor.addColorStop(1, rgb(colors.floor));
    ctx.fillStyle = floor;
    ctx.fillRect(0, half, width, half);

    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    const planeX = -dirY * FOV;
    const planeY = dirX * FOV;
    const aspect = width / height;
    const scaleH = height * Math.min(1, aspect / 1.6) * 1.1;

    for (let x = 0; x < width; x += 1) {
      const cameraX = (2 * x) / width - 1;
      const { distance, side, tile, u } = castRay(dirX + planeX * cameraX, dirY + planeY * cameraX);
      const lineH = scaleH / Math.max(distance, 0.0001);
      const top = half - lineH / 2;

      const base = tile === 2 ? colors.accent : colors.wall;
      let shade = side === 1 ? 0.72 : 1;
      if (u < 0.035 || u > 0.965) shade *= 0.55; // tile seams give depth cues
      const fog = Math.min(distance / 11, 1);
      const lit = mix(base, colors.fog, 1 - shade * 0.82);
      ctx.fillStyle = rgb(mix(lit, colors.fog, fog));
      ctx.fillRect(x, top, 1, lineH);
    }

    drawMiniMap(dirX, dirY, planeX, planeY);
  }

  function drawMiniMap(dirX, dirY, planeX, planeY) {
    const cell = Math.max(4, Math.round(height / 42));
    const pad = Math.round(cell * 1.5);
    ctx.save();
    ctx.translate(pad, pad);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = rgb(colors.floor, 0.78);
    ctx.fillRect(-2, -2, MAP[0].length * cell + 4, MAP.length * cell + 4);
    for (let y = 0; y < MAP.length; y += 1) {
      for (let x = 0; x < MAP[y].length; x += 1) {
        if (!MAP[y][x]) continue;
        ctx.fillStyle = rgb(MAP[y][x] === 2 ? colors.accent : colors.muted, MAP[y][x] === 2 ? 0.9 : 0.55);
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    // A fan of actual rays, so the minimap shows what the renderer is doing.
    ctx.strokeStyle = rgb(colors.accent, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 12; i += 1) {
      const cameraX = (2 * i) / 12 - 1;
      const rx = dirX + planeX * cameraX;
      const ry = dirY + planeY * cameraX;
      const { distance } = castRay(rx, ry);
      ctx.moveTo(player.x * cell, player.y * cell);
      ctx.lineTo((player.x + rx * distance) * cell, (player.y + ry * distance) * cell);
    }
    ctx.stroke();

    ctx.fillStyle = rgb(colors.accent);
    ctx.beginPath();
    ctx.arc(player.x * cell, player.y * cell, cell * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const runner = createRunner({
    root,
    step,
    render,
    hz: 60,
    t,
    onStats: () => {
      if (stat) stat.textContent = `${width} rays/frame · ${idle >= IDLE_AFTER ? 'autopilot' : 'manual'}`;
    },
  });
  resize();
}
