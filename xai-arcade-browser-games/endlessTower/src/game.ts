import { TELEPORT_DISTANCE, VIEW_HEIGHT, VIEW_WIDTH } from './constants.js';
import { Camera } from './camera.js';
import { collectCoins, pullCoins } from './coins.js';
import { GhostRun, type GhostFrame } from './ghost.js';
import { levelTuning, type LevelTuning } from './levels.js';
import { Player } from './player.js';
import { Renderer, type DrawSnapshot } from './renderer.js';
import { Score } from './score.js';
import { shopInfo, type ShopController } from './shop.js';
import type { Controls, GameStatus } from './types.js';
import { Upgrades, Wallet, type UpgradeId } from './upgrades.js';
import { World } from './world.js';

export class Game {
  status: GameStatus = 'playing';
  elapsed = 0;
  level = 1;
  player: Player;
  world: World;
  camera: Camera;
  score: Score;
  readonly wallet = new Wallet();
  readonly upgrades = new Upgrades();
  private tuning: LevelTuning = levelTuning(1);
  private shopPlatformId: number | null = null;
  private readonly ghost = new GhostRun();
  private ghostFrame: GhostFrame | null = null;
  private readonly renderer: Renderer;

  constructor(
    ctx: CanvasRenderingContext2D,
    private readonly controls: Controls,
    private readonly shop: ShopController,
  ) {
    this.renderer = new Renderer(ctx);
    this.player = this.spawnPlayer();
    this.world = new World(this.tuning);
    this.camera = new Camera();
    this.score = new Score();
  }

  update(dt: number): void {
    if (this.status === 'Game Over') {
      if (this.controls.consumeRestart() || this.controls.consumeJump()) this.resetRun();
      return;
    }
    if (this.status === 'Stop') return;

    this.elapsed += dt;
    this.controls.consumeRestart();

    const stats = this.upgrades.stats();
    const landed = this.player.update(dt, this.controls, this.world.platforms, stats);
    if (landed) this.score.onLand(landed);
    this.world.tickFragile(dt, this.player.standingId);
    if (this.player.grounded && !this.world.platforms.some((platform) => platform.id === this.player.standingId)) {
      this.player.grounded = false;
      this.player.standingId = null;
    }
    this.score.update(dt, this.player.y);
    this.prepareShopPlatform();

    pullCoins(this.world.coins, this.player, stats.magnetRadius, dt);
    const gained = collectCoins(this.world.coins, this.player);
    if (gained > 0) this.wallet.add(gained);

    this.ghost.record(this.player);
    this.ghostFrame = this.ghost.advance();

    if (
      this.shopPlatformId != null &&
      this.player.grounded &&
      this.player.standingId === this.shopPlatformId
    ) {
      this.status = 'Stop';
      this.camera.scrolling = false;
      this.shop.open(shopInfo(this.level, this.wallet, this.upgrades));
      return;
    }

    const autoScroll = this.shopPlatformId == null;
    this.camera.update(dt, this.elapsed, this.player.y, VIEW_HEIGHT, this.tuning, autoScroll);
    this.world.update(this.camera.bottomY, VIEW_HEIGHT);

    if (this.player.y < this.camera.bottomY) {
      this.ghost.commitDeath();
      this.status = 'Game Over';
    }
  }

  draw(): void {
    this.renderer.draw(this.snapshot());
  }

  buy(id: UpgradeId): boolean {
    if (this.status !== 'Stop') return false;
    const bought = this.upgrades.purchase(id, this.wallet);
    if (!bought) return false;
    if (id === 'teleport') this.teleport();
    this.shop.sync(shopInfo(this.level, this.wallet, this.upgrades));
    return true;
  }

  beginNextLevel(): void {
    if (this.status !== 'Stop') return;
    this.controls.consumeJump();
    this.controls.consumeRestart();
    this.level += 1;
    const tuned = levelTuning(this.level);
    const previous = levelTuning(this.level - 1);
    const segment = tuned.targetHeight - previous.targetHeight;
    this.tuning = {
      ...tuned,
      targetHeight: Math.max(tuned.targetHeight, this.score.maxHeight + segment),
    };
    this.world.setTuning(this.tuning);
    this.world.clearSpawnCeiling();
    this.shopPlatformId = null;
    this.status = 'playing';
    this.shop.close();
  }

  private teleport(): void {
    const keptVx = this.player.vx;
    const landingY = this.player.y + TELEPORT_DISTANCE;
    const pad = this.world.placeTeleportPad(landingY, this.player.x + this.player.width / 2);
    this.player.y = pad.y;
    this.player.vy = 0;
    this.player.vx = keptVx;
    this.player.grounded = true;
    this.player.standingId = pad.id;
    this.score.update(0, this.player.y);
    this.camera.snapToFeet(this.player.y, VIEW_HEIGHT);
    this.world.update(this.camera.bottomY, VIEW_HEIGHT);
  }

  private resetRun(): void {
    this.level = 1;
    this.wallet.balance = 0;
    this.upgrades.ranks.jump = 0;
    this.upgrades.ranks.run = 0;
    this.upgrades.ranks.magnet = 0;
    this.upgrades.ranks.teleport = 0;
    this.ghost.beginAttempt();
    this.ghostFrame = null;
    this.shopPlatformId = null;
    this.startLevel();
    this.shop.close();
  }

  /** The shop floor appears once the goal height has already been reached. */
  private prepareShopPlatform(): void {
    if (this.shopPlatformId != null) return;
    if (this.score.maxHeight < this.tuning.targetHeight) return;
    const platform = this.world.placeShopPlatform(this.tuning.targetHeight);
    this.shopPlatformId = platform.id;
  }

  private startLevel(): void {
    this.status = 'playing';
    this.elapsed = 0;
    this.tuning = levelTuning(this.level);
    this.player = this.spawnPlayer();
    this.world = new World(this.tuning);
    this.camera = new Camera();
    this.score = new Score();
  }

  private spawnPlayer(): Player {
    return new Player(VIEW_WIDTH / 2 - 18, 0);
  }

  private snapshot(): DrawSnapshot {
    return {
      status: this.status,
      platforms: this.world.platforms,
      coins: this.world.coins,
      player: this.player,
      cameraBottom: this.camera.bottomY,
      scrollSpeed: this.camera.scrollSpeed,
      scrolling: this.camera.scrolling,
      score: this.score.total,
      maxHeight: this.score.maxHeight,
      targetHeight: this.tuning.targetHeight,
      level: this.level,
      coinsBalance: this.wallet.balance,
      magnetRadius: this.upgrades.stats().magnetRadius,
      platformsLanded: this.score.platformsLanded,
      combo: this.score.combo,
      bestCombo: this.score.bestCombo,
      popup: this.score.popup,
      elapsed: this.elapsed,
      ghost: this.ghostFrame,
    };
  }
}
