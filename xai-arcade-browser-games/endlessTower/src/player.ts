import {
  AIR_ACCEL,
  AIR_FRICTION,
  GRAVITY,
  GROUND_FRICTION,
  JUMP_VX_CARRY,
  MAX_FALL_SPEED,
  SPRING_JUMP_MULTIPLIER,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  VIEW_WIDTH,
} from './constants.js';
import type { Controls, Platform, PlayerStats } from './types.js';

export class Player {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  readonly width = PLAYER_WIDTH;
  readonly height = PLAYER_HEIGHT;
  grounded = true;
  standingId: number | null = 0;
  facing: -1 | 1 = 1;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Returns the platform landed on this step, if the feet crossed its top.
   * Horizontal speed is left intact on a jump so it shapes the arc.
   */
  update(dt: number, controls: Controls, platforms: readonly Platform[], stats: PlayerStats): Platform | null {
    this.applyHorizontal(dt, controls, stats);

    if (controls.consumeJump() && this.grounded) {
      const launch = this.standingKind(platforms) === 'spring' ? SPRING_JUMP_MULTIPLIER : 1;
      this.vy = (stats.jumpSpeed + Math.abs(this.vx) * JUMP_VX_CARRY) * launch;
      this.grounded = false;
      this.standingId = null;
    }

    this.x += this.vx * dt;
    this.bounceOffWalls();

    if (this.grounded) {
      const support = this.findSupport(platforms);
      if (support) {
        this.y = support.y;
        this.vy = 0;
        this.standingId = support.id;
        return null;
      }
      this.grounded = false;
      this.standingId = null;
    }

    this.vy += GRAVITY * dt;
    if (this.vy < MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    const previousFeet = this.y;
    this.y += this.vy * dt;

    if (this.vy > 0) return null;
    return this.tryLand(previousFeet, platforms);
  }

  private applyHorizontal(dt: number, controls: Controls, stats: PlayerStats): void {
    const accel = this.grounded ? stats.groundAccel : AIR_ACCEL;
    const friction = this.grounded ? GROUND_FRICTION : AIR_FRICTION;

    if (controls.left && !controls.right) {
      this.vx -= accel * dt;
      this.facing = -1;
    } else if (controls.right && !controls.left) {
      this.vx += accel * dt;
      this.facing = 1;
    } else {
      const step = friction * dt;
      if (Math.abs(this.vx) <= step) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * step;
    }

    if (this.vx > stats.maxRunSpeed) this.vx = stats.maxRunSpeed;
    else if (this.vx < -stats.maxRunSpeed) this.vx = -stats.maxRunSpeed;
  }

  /** Reverse direction at the screen edges and keep the speed magnitude. */
  private bounceOffWalls(): void {
    if (this.x < 0) {
      this.x = 0;
      if (this.vx < 0) this.vx = -this.vx;
    } else if (this.x + this.width > VIEW_WIDTH) {
      this.x = VIEW_WIDTH - this.width;
      if (this.vx > 0) this.vx = -this.vx;
    }
  }

  private standingKind(platforms: readonly Platform[]): Platform['kind'] | null {
    for (const platform of platforms) {
      if (platform.id === this.standingId) return platform.kind;
    }
    return null;
  }

  private findSupport(platforms: readonly Platform[]): Platform | null {
    for (const platform of platforms) {
      if (platform.id !== this.standingId) continue;
      if (this.overlaps(platform, 2) && Math.abs(this.y - platform.y) <= 0.75) {
        return platform;
      }
    }
    return null;
  }

  private tryLand(previousFeet: number, platforms: readonly Platform[]): Platform | null {
    let landed: Platform | null = null;
    for (const platform of platforms) {
      if (!this.overlaps(platform, 0)) continue;
      const crossed = previousFeet >= platform.y && this.y <= platform.y;
      if (!crossed) continue;
      if (!landed || platform.y > landed.y) landed = platform;
    }
    if (!landed) return null;

    this.y = landed.y;
    this.vy = 0;
    this.grounded = true;
    this.standingId = landed.id;
    return landed;
  }

  private overlaps(platform: Platform, inset: number): boolean {
    const left = this.x + inset;
    const right = this.x + this.width - inset;
    return right > platform.x && left < platform.x + platform.width;
  }
}
