import {
  GAME_WIDTH,
  GAME_HEIGHT,
  LEVEL,
  START_AGE,
  DEATH_AGE,
  COMBAT,
  HAZARD,
  GRAPPLE,
  NAV,
  SHOP,
  randomAgeGain,
} from "../config.js";
import { Player } from "../entities/Player.js";
import { Enemy } from "../entities/Enemy.js";
import { HUD } from "../ui/HUD.js";
import { audio } from "../audio.js";
import { generateLevel } from "../gen/bsp.js";
import { buildNav, findPath } from "../gen/nav.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    audio.resume();
    this.registry.set("won", false);
    if (this.registry.get("age") == null) this.registry.set("age", START_AGE);
    if (this.registry.get("kills") == null) this.registry.set("kills", 0);
    if (this.registry.get("parries") == null) this.registry.set("parries", 0);

    this.level = generateLevel();
    this.nav = buildNav(this.level.platforms, NAV);
    this.physics.world.setBounds(0, 0, this.level.width, this.level.height + 200);
    this.physics.world.gravity.y = LEVEL.gravity;
    this.cameras.main.setBounds(0, 0, this.level.width, this.level.height);
    this.cameras.main.setBackgroundColor("#070709");

    this.paused = false;
    this.agingLock = false;
    this.attackers = new Set();
    this.fx = [];

    this.playerBolts = this.add.group();
    this.enemyBolts = this.add.group();
    this.rope = this.add.graphics().setDepth(11);

    this.drawWorld();
    this.createPlatforms();
    this.createFalling();
    this.createSpikes();
    this.createBounce();
    this.createGate();
    this.createDoors();
    this.createSwitches();
    this.createShop();
    this.createChests();
    this.createEmitters();
    this.coins = this.add.group();
    this.shopStock = SHOP;
    this.shopOpen = false;
    this.unlocked = { plate: false, switch: false };
    this.lastSafe = { x: this.level.spawn.x, y: this.level.spawn.y };

    this.player = new Player(this, this.level.spawn.x, this.level.spawn.y, this.registry.get("age") || START_AGE);
    this.player.setDepth(10);
    this.enemies = this.add.group();
    this.level.enemies.forEach((s) => {
      const e = new Enemy(this, s.x, s.y, s.kind);
      e.setDepth(8);
      this.enemies.add(e);
    });

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.player, this.doors);
    this.physics.add.collider(this.enemies, this.doors);
    this.physics.add.collider(this.player, this.falling, this.onFallingStep, null, this);
    this.physics.add.collider(this.enemies, this.falling);
    this.physics.add.overlap(this.player, this.spikes, this.onSpike, null, this);
    this.physics.add.overlap(this.player, this.pads, this.onBounce, null, this);
    this.physics.add.overlap(this.enemies, this.pads, this.onBounce, null, this);
    this.physics.add.overlap(this.player, this.coins, this.onCoin, null, this);
    this.physics.add.overlap(this.player, this.gate, this.onGateOverlap, null, this);
    this.physics.add.overlap(this.player, this.plates, this.onPlate, null, this);

    this.hud = new HUD(this);
    this.hud.update(this.player);

    this.setupInput();
    this.setupCamera();
    this.setupAsh();

    this.time.delayedCall(400, () => {
      this.hud.flashBanner(`PIT SEED ${this.level.seed}`, "#d8c8a8");
    });

    this.events.on("shutdown", () => {
      this.input.keyboard.removeAllListeners();
    });
  }

  drawWorld() {
    const W = this.level.width;
    const H = this.level.height;
    this.add.rectangle(0, 0, W, H, 0x07080c).setOrigin(0).setDepth(-30);

    const far = this.add.tileSprite(0, 0, W, H, "bg-far");
    far.setOrigin(0, 0);
    far.setScrollFactor(0.12, 0.08);
    far.setDepth(-20);
    this.farBg = far;

    const mid = this.add.tileSprite(0, 40, W, H, "bg-mid");
    mid.setOrigin(0, 0);
    mid.setScrollFactor(0.38, 0.16);
    mid.setDepth(-12);
    mid.setAlpha(0.68);
    this.midBg = mid;

    const fog = this.add.rectangle(0, H - 260, W, 260, 0x0a0c10, 0.35).setOrigin(0).setDepth(-8);
    fog.setScrollFactor(0.55, 0.3);

    const pits = this.level.pits || [];
    pits.forEach(([a, b]) => {
      const pit = this.add.rectangle((a + b) / 2, H - 32, b - a, 64, 0x100808);
      pit.setDepth(0);
      this.add.rectangle((a + b) / 2, H - 62, b - a, 6, 0x4a1410, 0.55).setDepth(1);
    });
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    this.level.platforms.forEach((p) => {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      if (p.h > 80 && p.w < 40) {
        const wall = this.add.tileSprite(cx, cy, p.w, p.h, "tile-wall");
        this.physics.add.existing(wall, true);
        this.platforms.add(wall);
      } else if (p.h <= 24) {
        const body = this.add.rectangle(cx, cy, p.w, p.h, 0x1a1a1e, 0);
        this.physics.add.existing(body, true);
        this.platforms.add(body);
        for (let x = p.x + 70; x < p.x + p.w + 40; x += 130) {
          const piece = this.add.image(Math.min(x, p.x + p.w - 40), p.y + 8, "tile-bridge");
          piece.setDisplaySize(Math.min(150, p.w + 20), 58);
          piece.setDepth(2);
        }
      } else {
        const wall = this.add.tileSprite(cx, cy, p.w, p.h, "tile-wall");
        this.physics.add.existing(wall, true);
        this.platforms.add(wall);
        const lip = this.add.tileSprite(cx, p.y + 10, p.w, 22, "tile-flag");
        lip.setDepth(2);
      }
    });
  }

  createGate() {
    const gx = this.level.gate.x;
    const gy = this.level.gate.y;
    this.add.image(gx, gy, "tile-gate").setDisplaySize(72, 148).setDepth(3);
    this.gate = this.add.rectangle(gx, gy, 36, 100, 0xd8b060, 0.12);
    this.gate.setDepth(3);
    this.physics.add.existing(this.gate, true);
    this.add
      .text(gx, gy - 140, "GATE", {
        fontFamily: "Oswald",
        fontSize: "16px",
        color: "#d8b060",
      })
      .setOrigin(0.5)
      .setDepth(4);
    this.reachedGate = false;
  }

  createDoors() {
    this.doors = this.physics.add.staticGroup();
    (this.level.doors || []).forEach((d) => {
      const door = this.add.image(d.x + d.w / 2, d.y + d.h / 2, "prop-door");
      door.setDisplaySize(d.w + 8, d.h);
      door.setDepth(5);
      this.physics.add.existing(door, true);
      door.locked = true;
      this.doors.add(door);
      this.add
        .text(d.x + d.w / 2, d.y - 16, "LOCKED", {
          fontFamily: "Oswald",
          fontSize: "12px",
          color: "#c8a050",
        })
        .setOrigin(0.5)
        .setDepth(6);
    });
  }

  createSwitches() {
    this.plates = this.physics.add.staticGroup();
    this.levers = [];
    (this.level.plates || []).forEach((p) => {
      const plate = this.add.image(p.x + p.w / 2, p.y + p.h / 2, "prop-plate");
      plate.setDisplaySize(p.w + 8, 16);
      plate.setDepth(4);
      this.physics.add.existing(plate, true);
      plate.switchId = p.id;
      this.plates.add(plate);
      this.add.text(p.x + p.w / 2, p.y - 18, "PLATE", { fontFamily: "Oswald", fontSize: "11px", color: "#c8b080" }).setOrigin(0.5).setDepth(6);
    });
    (this.level.switches || []).forEach((s) => {
      const lev = this.add.image(s.x + s.w / 2, s.y + s.h / 2, "prop-switch");
      lev.setDisplaySize(22, 28);
      lev.setDepth(5);
      this.physics.add.existing(lev, true);
      lev.switchId = s.id;
      lev.hit = false;
      this.levers.push(lev);
      this.add.text(s.x + s.w / 2, s.y - 18, "SWITCH", { fontFamily: "Oswald", fontSize: "11px", color: "#e07040" }).setOrigin(0.5).setDepth(6);
    });
  }

  createShop() {
    const s = this.level.shop;
    if (!s) return;
    this.keeper = this.add.image(s.x, s.y, "prop-keeper");
    this.keeper.setDisplaySize(56, 64);
    this.keeper.setDepth(7);
    this.add
      .text(s.x, s.y - 48, "SHOP  ·  E", {
        fontFamily: "Oswald",
        fontSize: "14px",
        color: "#e8d080",
      })
      .setOrigin(0.5)
      .setDepth(7);
  }

  createChests() {
    this.chests = [];
    (this.level.chests || []).forEach((c) => {
      const box = this.add.image(c.x, c.y, "prop-chest");
      box.setDisplaySize(42, 34);
      box.setDepth(6);
      this.physics.add.existing(box, true);
      box.body.setSize(32, 24);
      box.weapon = c.weapon;
      box.opened = false;
      box.marker = this.add
        .text(c.x, c.y - 28, "?", {
          fontFamily: "Oswald",
          fontSize: "14px",
          color: "#e8c060",
        })
        .setOrigin(0.5)
        .setDepth(7);
      this.chests.push(box);
    });
  }

  createFalling() {
    this.falling = this.physics.add.staticGroup();
    (this.level.falling || []).forEach((p) => {
      const plank = this.add.tileSprite(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, "tex-wood");
      plank.setDepth(3);
      this.physics.add.existing(plank, true);
      plank.armed = false;
      plank.broken = false;
      plank.homeX = plank.x;
      plank.homeY = plank.y;
      this.falling.add(plank);
    });
  }

  createSpikes() {
    this.spikes = this.physics.add.staticGroup();
    (this.level.spikes || []).forEach((s) => {
      const zone = this.add.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, 0xff0000, 0);
      this.physics.add.existing(zone, true);
      zone.dir = s.dir;
      this.spikes.add(zone);
      const step = s.dir === "up" ? 10 : 14;
      if (s.dir === "up") {
        for (let x = s.x + 4; x < s.x + s.w; x += step) {
          this.add.image(x, s.y + s.h / 2, "tex-spike").setDepth(4).setDisplaySize(10, s.h);
        }
      } else {
        const flip = s.dir === "left";
        for (let y = s.y + 6; y < s.y + s.h; y += step) {
          const sp = this.add.image(s.x + s.w / 2, y, "tex-spike");
          sp.setDepth(4);
          sp.setAngle(flip ? -90 : 90);
          sp.setDisplaySize(10, 16);
        }
      }
    });
  }

  createBounce() {
    this.pads = this.physics.add.staticGroup();
    (this.level.bounce || []).forEach((b) => {
      const pad = this.add.image(b.x + b.w / 2, b.y + b.h / 2, "tex-bounce");
      pad.setDisplaySize(b.w, b.h + 6);
      pad.setDepth(4);
      this.physics.add.existing(pad, true);
      pad.readyAt = 0;
      this.pads.add(pad);
    });
  }

  createEmitters() {
    this.dust = this.add.particles(0, 0, "fx-dust", {
      lifespan: 420,
      speed: { min: 20, max: 80 },
      scale: { start: 1.4, end: 0.2 },
      alpha: { start: 0.7, end: 0 },
      gravityY: 80,
      emitting: false,
    });
    this.dust.setDepth(14);
    this.embers = this.add.particles(0, 0, "fx-ember", {
      lifespan: 500,
      speed: { min: 20, max: 90 },
      scale: { start: 1.2, end: 0.1 },
      alpha: { start: 0.9, end: 0 },
      gravityY: -40,
      blendMode: "ADD",
      emitting: false,
    });
    this.embers.setDepth(15);
    this.sparks = this.add.particles(0, 0, "fx-spark", {
      lifespan: 280,
      speed: { min: 40, max: 140 },
      scale: { start: 1.2, end: 0.2 },
      alpha: { start: 1, end: 0 },
      blendMode: "ADD",
      emitting: false,
    });
    this.sparks.setDepth(16);
  }

  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys({
      left: "A",
      right: "D",
      left2: "LEFT",
      right2: "RIGHT",
      up: "W",
      up2: "UP",
      down: "S",
      down2: "DOWN",
      space: "SPACE",
      dash: "SHIFT",
      attack: "J",
      attack2: "Z",
      block: "K",
      block2: "X",
      dodge: "L",
      dodge2: "C",
      pause: "ESC",
    });

    kb.on("keydown-SPACE", () => !this.paused && this.player && this.player.tryJump());
    kb.on("keydown-W", () => !this.paused && this.player && this.player.tryJump());
    kb.on("keydown-UP", () => !this.paused && this.player && this.player.tryJump());
    kb.on("keydown-SHIFT", () => {
      if (this.paused || !this.player) return;
      this.player.tryDash(this.readAxis());
    });
    kb.on("keydown-J", () => !this.paused && this.onStrikeDown());
    kb.on("keydown-Z", () => !this.paused && this.onStrikeDown());
    kb.on("keyup-J", () => this.onStrikeUp());
    kb.on("keyup-Z", () => this.onStrikeUp());
    kb.on("keydown-L", () => !this.paused && this.player && this.player.tryDodge(this.readAxis()));
    kb.on("keydown-C", () => !this.paused && this.player && this.player.tryDodge(this.readAxis()));
    kb.on("keydown-K", () => !this.paused && this.player && this.player.startBlock());
    kb.on("keydown-X", () => !this.paused && this.player && this.player.startBlock());
    kb.on("keyup-K", () => this.player && this.player.releaseBlock());
    kb.on("keyup-X", () => this.player && this.player.releaseBlock());
    kb.on("keydown-ESC", () => this.togglePause());
    kb.on("keydown-F", () => !this.paused && !this.shopOpen && this.player && this.player.trySpecial());
    kb.on("keydown-E", () => !this.paused && this.tryInteract());
    kb.on("keydown-ONE", () => this.shopOpen && this.buyShop(0));
    kb.on("keydown-TWO", () => this.shopOpen && this.buyShop(1));
    kb.on("keydown-THREE", () => this.shopOpen && this.buyShop(2));
    kb.on("keydown-FOUR", () => this.shopOpen && this.buyShop(3));
    kb.on("keydown-Q", () => !this.paused && this.tryGrappleInput());
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (ptr) => {
      if (this.paused || !this.player) return;
      if (ptr.rightButtonDown() || ptr.button === 2) this.tryGrappleInput();
    });
    this.input.on("pointermove", (ptr) => {
      if (!this.player) return;
      const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      this.player.setAim(wp.x, wp.y);
    });
  }

  tryGrappleInput() {
    if (!this.player) return;
    const ptr = this.input.activePointer;
    if (ptr) {
      const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      this.player.setAim(wp.x, wp.y);
    }
    this.player.tryGrapple();
  }

  grappleBoxes() {
    const boxes = [];
    const push = (obj) => {
      if (!obj || !obj.active || !obj.body || !obj.body.enable) return;
      const b = obj.body;
      boxes.push({ left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height });
    };
    this.platforms?.getChildren().forEach(push);
    this.falling?.getChildren().forEach(push);
    return boxes;
  }

  showGrappleShot(x, y, hit, dx, dy) {
    const g = this.rope;
    g.clear();
    const len = Math.hypot(dx, dy) || 1;
    const ex = hit ? hit.x : x + (dx / len) * GRAPPLE.maxRange;
    const ey = hit ? hit.y : y + (dy / len) * GRAPPLE.maxRange;
    g.lineStyle(2, hit ? 0xc8e8f0 : 0x886060, 0.85);
    g.lineBetween(x, y, ex, ey);
    if (!hit) {
      this.time.delayedCall(90, () => this.clearGrappleShot());
    }
  }

  drawGrapple(x, y, hx, hy) {
    const g = this.rope;
    g.clear();
    g.lineStyle(2, 0xd8c8a0, 0.95);
    g.lineBetween(x, y, hx, hy);
    g.fillStyle(0xf0e8c8, 1);
    g.fillCircle(hx, hy, 4);
  }

  clearGrappleShot() {
    this.rope?.clear();
  }

  findPath(x0, y0, x1, y1) {
    return findPath(this.nav, x0, y0, x1, y1);
  }

  setupCamera() {
    this.cameras.main.startFollow(this.player, true, 0.12, 0.08, 0, 40);
    this.cameras.main.setDeadzone(80, 60);
    const vig = this.add.graphics().setScrollFactor(0).setDepth(150);
    vig.fillStyle(0x000000, 0.55);
    vig.fillRect(0, 0, GAME_WIDTH, 28);
    vig.fillRect(0, GAME_HEIGHT - 28, GAME_WIDTH, 28);
    vig.fillStyle(0x000000, 0.28);
    vig.fillRect(0, 0, 36, GAME_HEIGHT);
    vig.fillRect(GAME_WIDTH - 36, 0, 36, GAME_HEIGHT);
  }

  setupAsh() {
    this.ash = this.add.particles(0, 0, this.makeDot("ash", 2, 0x8a7a68), {
      x: { min: 0, max: this.level.width },
      y: -10,
      lifespan: 4000,
      speedY: { min: 20, max: 70 },
      speedX: { min: -16, max: 10 },
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 0.35, end: 0 },
      quantity: 1,
      frequency: 60,
      blendMode: "ADD",
    });
  }

  makeDot(key, size, color) {
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({ add: false });
    g.fillStyle(color, 1);
    g.fillRect(0, 0, size, size);
    g.generateTexture(key, size, size);
    g.destroy();
    return key;
  }

  readAxis() {
    const k = this.keys;
    let x = 0;
    if (k.left.isDown || k.left2.isDown) x -= 1;
    if (k.right.isDown || k.right2.isDown) x += 1;
    return x;
  }

  faceHint() {
    let face = this.readAxis();
    if (face === 0) {
      const near = this.nearestEnemy(180);
      if (near) face = Math.sign(near.x - this.player.x);
    }
    return face;
  }

  onStrikeDown() {
    if (!this.player || this.agingLock) return;
    const down = this.keys.down.isDown || this.keys.down2.isDown;
    this.player.onStrikeDown(this.faceHint(), down);
  }

  onStrikeUp() {
    if (!this.player || this.agingLock) return;
    this.player.onStrikeUp(this.faceHint());
  }

  readDown() {
    return this.keys.down.isDown || this.keys.down2.isDown;
  }

  nearestEnemy(maxDist) {
    let best = null;
    let bestD = maxDist;
    this.enemies.getChildren().forEach((e) => {
      if (!e.alive) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }

  canEnemyAttack(enemy) {
    const live = [...this.attackers].filter((e) => e.alive && (e.state === "windup" || e.state === "strike"));
    this.attackers = new Set(live);
    if (this.attackers.has(enemy)) return true;
    if (this.attackers.size >= 2) return false;
    this.attackers.add(enemy);
    return true;
  }

  onParry(player, fromX) {
    const count = (this.registry.get("parries") || 0) + 1;
    this.registry.set("parries", count);
    audio.parry();
    this.hitstop(COMBAT.parryHitstopMs);
    this.shake(0.012, 120);
    this.burst(player.x + player.facing * 16, player.y, 0xfff0c0, 16);
    this.floatText(player.x, player.y - 48, "PARRY", "#ffe9a0");
    this.cameras.main.flash(60, 240, 230, 200);
  }

  onPlayerDown() {
    if (this.agingLock) return;
    this.agingLock = true;
    if (this.player.age >= DEATH_AGE) {
      this.realDeath();
      return;
    }
    this.ageUp();
  }

  ageUp() {
    const gain = randomAgeGain();
    this.player.collapse();
    this.cameras.main.shake(200, 0.008);
    audio.ageUp();
    this.hud.flashBanner(`+${gain} YEARS`, "#c07050");

    this.time.delayedCall(520, () => {
      this.player.age = Math.min(this.player.age + gain, 99);
      this.registry.set("age", this.player.age);
      this.player.applyAgeStats(true);
      this.player.hp = this.player.hpMax;
      this.player.riseAfterAge();
      this.floatText(this.player.x, this.player.y - 56, `AGE ${this.player.age}`, "#e8d0b0");
      this.hud.update(this.player);
      this.time.delayedCall(200, () => {
        this.agingLock = false;
      });
    });
  }

  realDeath() {
    this.player.collapse();
    audio.death();
    this.hud.flashBanner("THE BODY FAILS", "#c04030");
    this.cameras.main.fadeOut(1200, 0, 0, 0);
    this.time.delayedCall(1250, () => {
      this.registry.set("won", false);
      this.scene.start("GameOverScene");
    });
  }

  win() {
    if (this.reachedGate) return;
    this.reachedGate = true;
    this.registry.set("won", true);
    this.registry.set("age", this.player.age);
    this.hud.flashBanner("THE GATE OPENS", "#d8c070");
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.time.delayedCall(950, () => this.scene.start("GameOverScene"));
  }

  togglePause() {
    if (this.shopOpen) {
      this.closeShop();
      return;
    }
    if (this.agingLock) return;
    this.paused = !this.paused;
    this.physics.world.isPaused = this.paused;
    if (this.paused) {
      if (!this.pauseText) {
        this.pauseText = this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "PAUSED", {
            fontFamily: "Oswald",
            fontSize: "48px",
            color: "#e8dcc8",
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(300);
      }
      this.pauseText.setVisible(true);
    } else if (this.pauseText) {
      this.pauseText.setVisible(false);
    }
  }

  addPlayerBolt(bolt) {
    this.playerBolts.add(bolt);
  }

  addEnemyBolt(bolt) {
    this.enemyBolts.add(bolt);
  }

  resolveBolts() {
    this.playerBolts.getChildren().forEach((b) => {
      if (!b.aliveBolt) return;
      this.enemies.getChildren().forEach((e) => {
        if (!e.alive || !b.aliveBolt) return;
        if (this.physics.overlap(b, e)) {
          e.takeHit(b.damage, b.x);
          this.emitSparks(b.x, b.y, 6);
          b.kill();
        }
      });
    });
    this.enemyBolts.getChildren().forEach((b) => {
      if (!b.aliveBolt || !this.player.alive) return;
      if (this.physics.overlap(b, this.player)) {
        this.player.takeHit(b.damage, b.x);
        this.emitSparks(b.x, b.y, 5);
        b.kill();
      }
    });
  }

  onFallingStep(player, plank) {
    if (!plank || plank.armed || plank.broken) return;
    if (player !== this.player) return;
    plank.armed = true;
    this.tweens.add({
      targets: plank,
      x: plank.x + 2,
      duration: 50,
      yoyo: true,
      repeat: 18,
    });
    this.time.delayedCall(HAZARD.fallArmMs, () => this.breakPlank(plank));
  }

  breakPlank(plank) {
    if (!plank.active || plank.broken) return;
    plank.broken = true;
    if (plank.body) plank.body.enable = false;
    this.tweens.add({
      targets: plank,
      y: plank.y + 220,
      alpha: 0,
      angle: 18,
      duration: 480,
      onComplete: () => {
        plank.setVisible(false);
        this.time.delayedCall(HAZARD.fallRespawnMs, () => this.restorePlank(plank));
      },
    });
    this.emitDust(plank.x, plank.y, 8);
  }

  restorePlank(plank) {
    if (!plank.active) return;
    plank.x = plank.homeX;
    plank.y = plank.homeY;
    plank.alpha = 1;
    plank.angle = 0;
    plank.armed = false;
    plank.broken = false;
    plank.setVisible(true);
    if (plank.body) {
      plank.body.enable = true;
      plank.body.updateFromGameObject();
    }
  }

  onSpike(_actor, spike) {
    if (!this.player.alive || this.agingLock) return;
    const from = spike.dir === "left" ? this.player.x - 40 : spike.dir === "right" ? this.player.x + 40 : this.player.x;
    const result = this.player.takeHit(HAZARD.spikeDamage, from);
    if (result === "hit" || result === "block") {
      const kb = spike.dir === "left" ? 280 : spike.dir === "right" ? -280 : this.player.facing * -220;
      this.player.setVelocity(kb, -240);
    }
  }

  onBounce(actor, pad) {
    if (!actor.body || this.time.now < (pad.readyAt || 0)) return;
    pad.readyAt = this.time.now + 280;
    actor.setMaxVelocity(900, 1100);
    actor.setVelocityY(HAZARD.bounceVel);
    this.tweens.add({
      targets: pad,
      scaleY: 0.7,
      duration: 80,
      yoyo: true,
    });
    this.emitDust(pad.x, pad.y, 7);
    audio.jump();
  }

  spawnCoins(x, y, n = 3) {
    for (let i = 0; i < n; i++) {
      const c = this.add.image(x + (Math.random() - 0.5) * 20, y - 8, "prop-coin");
      c.setDisplaySize(14, 14);
      c.setDepth(9);
      this.physics.add.existing(c);
      c.body.setBounce(0.45, 0.45);
      c.body.setVelocity((Math.random() - 0.5) * 160, -180 - Math.random() * 80);
      c.body.setAllowGravity(true);
      this.coins.add(c);
      this.physics.add.collider(c, this.platforms);
      this.physics.add.collider(c, this.falling);
    }
  }

  onCoin(_player, coin) {
    if (!coin.active) return;
    this.player.addCoins(1);
    this.floatText(coin.x, coin.y - 16, "+1", "#e8c040");
    audio.ui();
    coin.destroy();
  }

  onGateOverlap() {
    if (this.reachedGate || !this.player.alive) return;
    if (this.doors?.getChildren().some((d) => d.locked && d.body?.enable)) return;
    this.win();
  }

  onPlate(_player, plate) {
    if (this.unlocked[plate.switchId]) return;
    this.unlocked[plate.switchId] = true;
    plate.setTint(0xc8e080);
    this.floatText(plate.x, plate.y - 24, "PLATE SET", "#c8e080");
    this.tryUnlockDoors();
  }

  checkSwitches() {
    if (!this.player.attackBox || !this.levers) return;
    this.levers.forEach((lev) => {
      if (lev.hit || !lev.body) return;
      if (this.physics.overlap(this.player.attackBox, lev)) {
        lev.hit = true;
        this.unlocked[lev.switchId] = true;
        lev.setTint(0x40c060);
        this.floatText(lev.x, lev.y - 24, "SWITCH", "#40c060");
        this.tryUnlockDoors();
      }
    });
  }

  tryUnlockDoors() {
    if (!this.unlocked.plate || !this.unlocked.switch) return;
    this.doors?.getChildren().forEach((d) => {
      if (!d.locked) return;
      d.locked = false;
      if (d.body) d.body.enable = false;
      this.tweens.add({
        targets: d,
        alpha: 0.15,
        scaleY: 0.2,
        duration: 280,
      });
    });
    this.hud.flashBanner("THE WAY OPENS", "#c8e080");
    audio.parry();
  }

  tryInteract() {
    if (!this.player || this.agingLock) return;
    if (this.shopOpen) {
      this.closeShop();
      return;
    }
    if (this.keeper && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.keeper.x, this.keeper.y) < 70) {
      this.openShop();
      return;
    }
    this.chests.forEach((ch) => {
      if (ch.opened) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, ch.x, ch.y) < 56) {
        ch.opened = true;
        if (ch.marker) ch.marker.setVisible(false);
        if (this.textures.exists("prop-chest-open")) {
          ch.setTexture("prop-chest-open");
          ch.setDisplaySize(48, 42);
        }
        this.player.equipWeapon(ch.weapon);
        this.emitEmbers(ch.x, ch.y, 8);
        audio.ui();
      }
    });
  }

  openShop() {
    this.shopOpen = true;
    this.physics.world.isPaused = true;
    this.time.paused = true;
    this.shopUi = this.add.container(640, 360).setScrollFactor(0).setDepth(3000);
    const panel = this.add.rectangle(0, 0, 520, 340, 0x100e10, 0.94);
    panel.setStrokeStyle(2, 0xc8a050);
    const title = this.add.text(0, -140, "THE KEEPER", { fontFamily: "Oswald", fontSize: "28px", color: "#e8d080" }).setOrigin(0.5);
    const lines = SHOP.map((it, i) => `${i + 1}   ${it.name}    ${it.cost}c    ${it.desc}`);
    const list = this.add
      .text(0, 10, lines.join("\n") + "\n\nE / ESC  close", {
        fontFamily: "Share Tech Mono",
        fontSize: "16px",
        color: "#c8b8a0",
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5);
    this.shopUi.add([panel, title, list]);
  }

  closeShop() {
    this.shopOpen = false;
    this.physics.world.isPaused = false;
    this.time.paused = false;
    this.shopUi?.destroy();
    this.shopUi = null;
  }

  buyShop(index) {
    const item = SHOP[index];
    if (!item) return;
    if (this.player.buyUpgrade(item.id)) {
      this.floatText(this.player.x, this.player.y - 40, item.name, "#e8d080");
    } else {
      this.floatText(this.player.x, this.player.y - 40, "NOT ENOUGH", "#c05040");
    }
  }

  rescuePlayer() {
    if (this.player.grappling || this.player.hooking) this.player.releaseGrapple(false);
    const safe = this.lastSafe || this.findSafeLanding(this.player.x) || this.level.spawn;
    this.player.setPosition(safe.x, safe.y);
    this.player.body.setVelocity(0, 0);
    this.player.body.setAllowGravity(true);
    this.player.takeHit(16, this.player.x);
  }

  findSafeLanding(fromX) {
    const plats = (this.level.platforms || []).filter((p) => p.w >= 70 && p.h <= 40 && p.y < this.level.height - 80);
    if (!plats.length) return this.level.spawn;
    let best = null;
    let bestD = Infinity;
    plats.forEach((p) => {
      const x = Phaser.Math.Clamp(fromX, p.x + 28, p.x + p.w - 28);
      const y = p.y - 42;
      const d = Math.abs(x - fromX) + Math.abs(p.y - (this.lastSafe?.y || p.y)) * 0.25;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    });
    return best;
  }

  emitDust(x, y, count = 6) {
    this.dust?.emitParticleAt(x, y, count);
  }

  emitEmbers(x, y, count = 6) {
    this.embers?.emitParticleAt(x, y, count);
  }

  emitSparks(x, y, count = 6) {
    this.sparks?.emitParticleAt(x, y, count);
  }

  emitSlash(x, y, facing) {
    const s = this.add.image(x + facing * 30, y - 4, "fx-slash").setDepth(13);
    s.setFlipX(facing < 0);
    s.setAlpha(0.92);
    s.setScale(0.9);
    this.tweens.add({
      targets: s,
      alpha: 0,
      scale: 1.35,
      x: s.x + facing * 16,
      duration: 170,
      onComplete: () => s.destroy(),
    });
  }

  onSlamImpact(player) {
    this.shake(0.022, 200);
    this.hitstop(90);
    audio.hit();
    this.emitDust(player.x, player.y + 18, 16);
    this.emitSparks(player.x, player.y + 8, 10);
    const shock = this.add.image(player.x, player.y + 18, "fx-shock").setDepth(12);
    shock.setTint(0xf0d080);
    this.tweens.add({
      targets: shock,
      scale: 3.2,
      alpha: 0,
      duration: 280,
      onComplete: () => shock.destroy(),
    });
    this.floatText(player.x, player.y - 48, "SLAM", "#f0d080");
    this.enemies.getChildren().forEach((e) => {
      if (!e.alive) return;
      if (Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) <= COMBAT.slamRadius) {
        const dmg = Math.round(player.atk * COMBAT.slamScale);
        e.takeHit(dmg, player.x, false);
        e.body.setVelocityX(Math.sign(e.x - player.x) * 260);
      }
    });
  }

  burst(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const p = this.add.rectangle(x, y, 3, 3, color);
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 180;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * s * 0.25,
        y: y + Math.sin(a) * s * 0.25,
        alpha: 0,
        duration: 220 + Math.random() * 180,
        onComplete: () => p.destroy(),
      });
    }
  }

  floatText(x, y, text, color) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: "Oswald",
        fontSize: "18px",
        color,
      })
      .setOrigin(0.5)
      .setDepth(80);
    this.tweens.add({
      targets: t,
      y: y - 28,
      alpha: 0,
      duration: 620,
      onComplete: () => t.destroy(),
    });
  }

  shake(intensity, ms) {
    this.cameras.main.shake(ms, intensity);
  }

  hitstop(ms) {
    this.physics.world.timeScale = 0.08;
    this.time.delayedCall(ms, () => {
      this.physics.world.timeScale = 1;
    });
  }

  resolvePlayerAttacks() {
    const box = this.player.attackBox;
    if (!box) return;
    let any = false;
    this.enemies.getChildren().forEach((e) => {
      if (!e.alive || this.player.hitSet.has(e)) return;
      if (this.physics.overlap(box, e)) {
        this.player.hitSet.add(e);
        any = true;
        const riposte = this.time.now < this.player.riposteUntil && e.state === "stun";
        let scale = this.player.wep.dmg[this.player.attackStep] || 1;
        let kb = this.player.wep.kb[this.player.attackStep] || 160;
        if (this.player.attackKind === "heavy") {
          scale = COMBAT.heavyScale;
          kb = COMBAT.heavyKnockback;
        } else if (this.player.attackKind === "dash") {
          scale = COMBAT.dashThrustScale;
          kb = 240;
        } else if (this.player.attackKind === "slam") {
          scale = COMBAT.slamScale;
          kb = 280;
        }
        if (riposte) scale *= COMBAT.riposteScale;
        const dmg = Math.round(this.player.atk * scale);
        e.takeHit(dmg, this.player.x, riposte);
        e.body.setVelocityX(this.player.facing * kb);
      }
    });
    if (any) {
      this.hitstop(this.player.attackKind === "heavy" ? 80 : COMBAT.hitstopMs);
      this.shake(this.player.attackKind === "heavy" ? 0.018 : 0.007, this.player.attackKind === "heavy" ? 160 : 70);
      this.emitSparks(this.player.x + this.player.facing * 20, this.player.y, 6);
    }
  }

  update(_t, delta) {
    if (this.paused || this.shopOpen || !this.player) return;

    const input = {
      x: this.readAxis(),
      jumpHeld: this.keys.space.isDown || this.keys.up.isDown || this.keys.up2.isDown,
      up: this.keys.up.isDown || this.keys.up2.isDown,
      down: this.keys.down.isDown || this.keys.down2.isDown,
    };

    if (!this.agingLock) {
      this.player.refresh(input, delta);
      this.resolvePlayerAttacks();
      this.enemies.getChildren().forEach((e) => e.refresh && e.refresh(this.player, delta));
    }

    if (this.player.grounded && this.player.alive && !this.player.aging) {
      this.lastSafe = { x: this.player.x, y: this.player.y };
    }

    if (this.player.y > this.level.height + 40 && !this.agingLock) {
      this.rescuePlayer();
    }

    this.resolveBolts();

    this.checkSwitches();

    this.hud.update(this.player);
  }
}
