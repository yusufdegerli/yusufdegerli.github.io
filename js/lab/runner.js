// Shared loop for the canvas demos.
//  - fixed simulation timestep, decoupled from the display's refresh rate
//  - pauses when scrolled off-screen or when the tab is hidden
//  - honours prefers-reduced-motion (starts paused, renders a still frame)
//  - wires the panel's play/pause button

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function createRunner({ root, step, render, hz = 60, t, onStats }) {
  const toggle = root.querySelector('[data-action="toggle"]');
  const dt = 1 / hz;
  const maxStepsPerFrame = 6;

  let wantsToRun = !reducedMotion.matches; // the visitor's choice
  let inView = false;
  let pageVisible = document.visibilityState === 'visible';
  let covered = false; // the arcade player is open on top of the page
  let rafId = 0;
  let last = 0;
  let accumulator = 0;
  let ticks = 0;
  let statsClock = 0;

  const active = () => wantsToRun && inView && pageVisible && !covered;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, 0.25);
    last = now;
    accumulator += elapsed;

    let steps = 0;
    while (accumulator >= dt && steps < maxStepsPerFrame) {
      step(dt);
      accumulator -= dt;
      steps += 1;
    }
    if (steps === maxStepsPerFrame) accumulator = 0; // drop backlog rather than spiral
    ticks += steps;

    render(accumulator / dt);

    statsClock += elapsed;
    if (onStats && statsClock >= 0.5) {
      onStats(Math.round(ticks / statsClock));
      ticks = 0;
      statsClock = 0;
    }
  }

  function sync() {
    if (active() && !rafId) {
      last = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    } else if (!active() && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (toggle) {
      toggle.textContent = wantsToRun ? t('js.demo.pause', 'Pause') : t('js.demo.play', 'Play');
      toggle.setAttribute('aria-pressed', String(!wantsToRun));
    }
  }

  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  });
  observer.observe(root);

  document.addEventListener('visibilitychange', () => {
    pageVisible = document.visibilityState === 'visible';
    sync();
  });

  toggle?.addEventListener('click', () => {
    wantsToRun = !wantsToRun;
    sync();
  });

  document.addEventListener('langchange', sync);

  // Leave the CPU/GPU to the game while the arcade player is open.
  document.addEventListener('arcadeplayer', (event) => {
    covered = event.detail.open;
    sync();
  });

  return {
    /** Resume after user interaction even if reduced motion paused the demo. */
    wake() {
      if (!wantsToRun) {
        wantsToRun = true;
        sync();
      }
    },
    renderOnce: () => render(0),
    get running() {
      return Boolean(rafId);
    },
  };
}

/** Read theme colours from CSS custom properties as [r, g, b, a] (0–255). */
export function readPalette(names) {
  const style = getComputedStyle(document.documentElement);
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const palette = {};
  for (const name of names) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = style.getPropertyValue(`--${name}`).trim() || '#000';
    probe.fillRect(0, 0, 1, 1);
    palette[name] = [...probe.getImageData(0, 0, 1, 1).data];
  }
  return palette;
}

export const rgb = ([r, g, b], a = 1) => `rgba(${r}, ${g}, ${b}, ${a})`;

export const mix = (a, b, k) => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];
