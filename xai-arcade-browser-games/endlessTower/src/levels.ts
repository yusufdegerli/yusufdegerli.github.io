import {
  PLATFORM_MAX_WIDTH,
  PLATFORM_MIN_WIDTH,
  SCROLL_ACCEL,
  SCROLL_MAX_SPEED,
  SCROLL_START_SPEED,
} from './constants.js';

export interface LevelTuning {
  level: number;
  /** Feet Y that clears this level. The tower itself is not rebuilt between levels. */
  targetHeight: number;
  scrollStart: number;
  scrollAccel: number;
  scrollMax: number;
  minWidth: number;
  maxWidth: number;
}

/**
 * Level 1 is a short lesson. Later goals pull away: 1500, 3000, 5000,
 * then each added stretch grows by 1.45.
 */
export function targetHeightFor(level: number): number {
  const safe = Math.max(1, level);
  let height = 1500;
  for (let index = 2; index <= safe; index += 1) {
    if (index === 2) height += 1500;
    else if (index === 3) height += 2000;
    else height += Math.round(2000 * 1.45 ** (index - 3));
  }
  return height;
}

/** Later levels ask for more height, narrower platforms, and a faster rising floor. */
export function levelTuning(level: number): LevelTuning {
  const step = Math.max(0, level - 1);
  return {
    level,
    targetHeight: targetHeightFor(level),
    scrollStart: SCROLL_START_SPEED + step * 12,
    scrollAccel: SCROLL_ACCEL + step * 0.65,
    scrollMax: Math.min(420, SCROLL_MAX_SPEED + step * 22),
    minWidth: Math.max(62, PLATFORM_MIN_WIDTH + 20 - step * 8),
    maxWidth: Math.max(108, PLATFORM_MAX_WIDTH - step * 14),
  };
}
