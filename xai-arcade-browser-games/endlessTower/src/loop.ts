const MAX_FRAME_SECONDS = 0.1;
const FIXED_STEP = 1 / 120;

/**
 * requestAnimationFrame loop. Update runs on a fixed step; draw runs once per frame.
 */
export function startLoop(update: (dt: number) => void, draw: () => void): void {
  let last = performance.now();
  let accumulator = 0;

  const frame = (now: number): void => {
    let frameDt = (now - last) / 1000;
    last = now;
    if (frameDt > MAX_FRAME_SECONDS) frameDt = MAX_FRAME_SECONDS;
    accumulator += frameDt;

    while (accumulator >= FIXED_STEP) {
      update(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }

    draw();
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
