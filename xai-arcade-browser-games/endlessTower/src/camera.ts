import { FOLLOW_ANCHOR, FOLLOW_SHARPNESS, GROUND_HEIGHT, SCROLL_DELAY } from './constants.js';
import type { LevelTuning } from './levels.js';

export class Camera {
  /** World Y at the bottom edge of the view. Increases as the view climbs. */
  bottomY = -GROUND_HEIGHT;
  scrollSpeed = 0;
  scrolling = false;

  /** Jump the view to the player with no blend. Scroll speed is left untouched. */
  snapToFeet(feetY: number, viewHeight: number): void {
    this.bottomY = feetY - viewHeight * FOLLOW_ANCHOR;
  }

  update(
    dt: number,
    elapsed: number,
    playerFeetY: number,
    viewHeight: number,
    tuning: LevelTuning,
    allowAutoScroll: boolean,
  ): void {
    const desiredBottom = playerFeetY - viewHeight * FOLLOW_ANCHOR;
    if (desiredBottom > this.bottomY) {
      const blend = Math.min(1, FOLLOW_SHARPNESS * dt);
      this.bottomY += (desiredBottom - this.bottomY) * blend;
    }

    if (!allowAutoScroll) {
      this.scrolling = false;
      return;
    }

    if (elapsed < SCROLL_DELAY) return;

    this.scrolling = true;
    if (this.scrollSpeed < tuning.scrollStart) this.scrollSpeed = tuning.scrollStart;
    this.scrollSpeed = Math.min(tuning.scrollMax, this.scrollSpeed + tuning.scrollAccel * dt);
    this.bottomY += this.scrollSpeed * dt;
  }
}
