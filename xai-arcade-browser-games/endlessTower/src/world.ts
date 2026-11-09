import {
  CULL_MARGIN,
  FRAGILE_BREAK_SECONDS,
  GROUND_HEIGHT,
  PLATFORM_HEIGHT,
  SPAWN_AHEAD,
  TELEPORT_PAD_WIDTH,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from './constants.js';
import { makeCoin } from './coins.js';
import type { LevelTuning } from './levels.js';
import { clamp, lerp, rand } from './math.js';
import type { Coin, Platform, PlatformKind } from './types.js';

export class World {
  readonly platforms: Platform[] = [];
  readonly coins: Coin[] = [];
  private nextId = 0;
  private nextIndex = 0;
  private nextCoinId = 0;
  private nextY = 0;
  /** While set, procedural platforms stop just below this height. */
  private spawnCeiling: number | null = null;

  constructor(private tuning: LevelTuning) {
    this.platforms.push(this.make(0, VIEW_WIDTH, 0, GROUND_HEIGHT, true, false, false, 'normal'));
    this.nextY = 78;
    this.ensureGeneratedUntil(Math.min(VIEW_HEIGHT + SPAWN_AHEAD, tuning.targetHeight + 160));
  }

  setTuning(tuning: LevelTuning): void {
    this.tuning = tuning;
  }

  clearSpawnCeiling(): void {
    this.spawnCeiling = null;
  }

  /**
   * Clears anything already at or above `y` and lays down one wide shop floor.
   * Generation above it stays blocked until the level continues.
   */
  placeShopPlatform(y: number): Platform {
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const platform = this.platforms[i];
      if (!platform.ground && platform.y >= y - 0.5) this.platforms.splice(i, 1);
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      if (this.coins[i].y >= y - 0.5) this.coins.splice(i, 1);
    }

    const margin = 16;
    const platform = this.make(margin, VIEW_WIDTH - margin * 2, y, PLATFORM_HEIGHT, false, false, true, 'normal');
    this.platforms.push(platform);
    this.spawnCeiling = y;
    if (this.nextY > y) this.nextY = y + 88;
    return platform;
  }

  /**
   * Fills every gap below `feetY`, then places one solid pad at that exact height.
   * The fill is a straight loop, so a 2500px teleport cannot stall the frame.
   */
  placeTeleportPad(feetY: number, centerX: number): Platform {
    this.spawnCeiling = null;
    this.ensureGeneratedUntil(feetY);
    const width = Math.min(TELEPORT_PAD_WIDTH, VIEW_WIDTH);
    const x = clamp(centerX - width / 2, 0, VIEW_WIDTH - width);
    const pad = this.make(x, width, feetY, PLATFORM_HEIGHT, false, true, false, 'normal');
    this.platforms.push(pad);
    if (this.nextY <= feetY) this.nextY = feetY + 72;
    return pad;
  }

  /** Cracks a fragile platform while it is stood on, then deletes it after 0.6s. */
  tickFragile(dt: number, standingId: number | null): void {
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const platform = this.platforms[i];
      if (platform.kind !== 'fragile') continue;
      const stoodOn = platform.id === standingId;
      if (platform.crumble == null && !stoodOn) continue;
      platform.crumble = (platform.crumble ?? 0) + dt;
      if (platform.crumble < FRAGILE_BREAK_SECONDS) continue;
      this.platforms.splice(i, 1);
    }
  }

  /** Creates platforms above the view and drops ones that have left the bottom. */
  update(cameraBottom: number, viewHeight: number): void {
    this.ensureGeneratedUntil(cameraBottom + viewHeight + SPAWN_AHEAD);
    const cutoff = cameraBottom - CULL_MARGIN;
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      if (this.platforms[i].y < cutoff) this.platforms.splice(i, 1);
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      if (this.coins[i].y < cutoff) this.coins.splice(i, 1);
    }
  }

  private ensureGeneratedUntil(targetY: number): void {
    let guard = 0;
    const limit = this.spawnCeiling == null ? targetY : Math.min(targetY, this.spawnCeiling - 40);
    while (this.nextY < limit && guard < 10000) {
      guard += 1;
      const progress = clamp(this.nextY / this.tuning.targetHeight, 0, 1);
      const step = Math.min(1, (this.tuning.level - 1) / 8);
      const difficulty = clamp(step * 0.65 + progress * 0.35, 0, 1);
      const clustered = Math.random() < 0.4;
      const minWidth = this.tuning.minWidth;
      const maxWidth = lerp(this.tuning.maxWidth, minWidth + 12, progress);
      const width = rand(minWidth, Math.max(minWidth + 8, maxWidth));
      const previous = this.platforms[this.platforms.length - 1];
      const x = this.placeX(previous, width, difficulty);
      const platform = this.make(x, width, this.nextY, PLATFORM_HEIGHT, false, false, false, this.rollKind(difficulty));
      this.platforms.push(platform);
      const coin = makeCoin(this.nextCoinId, platform.x, platform.width, platform.y, Math.random());
      if (coin) {
        this.coins.push(coin);
        this.nextCoinId += 1;
      }

      const stretch = Math.min(18, (this.tuning.level - 1) * 3);
      const gap = clustered
        ? rand(46, 68 + stretch)
        : rand(lerp(76, 108, difficulty) + stretch, lerp(98, 140, difficulty) + stretch);
      this.nextY += gap;
    }
  }

  /** Keeps the next platform inside a running-jump reach of the previous one. */
  private placeX(previous: Platform, width: number, difficulty: number): number {
    const reach = lerp(200, 300, difficulty);
    const previousCenter = previous.x + previous.width / 2;
    const minCenter = Math.max(width / 2, previousCenter - reach);
    const maxCenter = Math.min(VIEW_WIDTH - width / 2, previousCenter + reach);
    const span = Math.max(0, maxCenter - minCenter);
    return minCenter + Math.random() * span - width / 2;
  }

  private rollKind(difficulty: number): PlatformKind {
    const roll = Math.random();
    const fragileChance = lerp(0.12, 0.26, difficulty);
    const springChance = lerp(0.1, 0.18, difficulty);
    if (roll < fragileChance) return 'fragile';
    if (roll < fragileChance + springChance) return 'spring';
    return 'normal';
  }

  private make(
    x: number,
    width: number,
    y: number,
    height: number,
    ground: boolean,
    anchor: boolean,
    shop: boolean,
    kind: PlatformKind,
  ): Platform {
    const platform: Platform = {
      id: this.nextId,
      index: this.nextIndex,
      x,
      y,
      width,
      height,
      ground,
      anchor,
      shop,
      kind,
      crumble: null,
    };
    this.nextId += 1;
    this.nextIndex += 1;
    return platform;
  }
}
