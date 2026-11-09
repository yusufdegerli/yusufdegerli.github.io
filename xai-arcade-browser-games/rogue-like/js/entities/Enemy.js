import { ENEMY } from "../config.js";
import { audio } from "../audio.js";
import { juiceAttack, juiceHurt, juiceDie } from "../juice.js";
import { Projectile } from "./Projectile.js";

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, kind = "thug") {
    const cfg = ENEMY[kind] || ENEMY.thug;
    super(scene, x, y, `${cfg.sprite}-idle`);
    this.scene = scene;
    this.cfg = cfg;
    this.kind = cfg.kind;
    this.role = cfg.role || "melee";

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(8);
    this.setDisplaySize(cfg.displayW, cfg.displayH);
    this.setSize(cfg.w, cfg.h);
    const ox = (this.width - cfg.w) / 2;
    const oy = this.height - cfg.h - 2;
    this.setOffset(ox, Math.max(0, oy));
    this.setCollideWorldBounds(true);

    this.hp = cfg.hp;
    this.hpMax = cfg.hp;
    this.facing = -1;
    this.state = "idle";
    this.alive = true;
    this.thinkAt = 0;
    this.windupUntil = 0;
    this.strikeUntil = 0;
    this.recoverUntil = 0;
    this.stunUntil = 0;
    this.hurtUntil = 0;
    this.healAt = 0;
    this.hitLanded = false;
    this.patrolDir = Math.random() < 0.5 ? -1 : 1;
    this.home = x;
    this.hitBox = null;
    this.tell = null;
    this.eyeGlow = null;
    this.wiped = false;
    this.path = [];
    this.pathAt = 0;
    this.navJumping = false;
    this.applyTint();
    this.face(this.facing);
    this.startIdleBob();
  }

  applyTint() {
    if (this.cfg.tint) this.setTint(this.cfg.tint);
    else this.clearTint();
  }

  startIdleBob() {
    if (this.bobTween) this.bobTween.stop();
    this.bobTween = this.scene.tweens.add({
      targets: this,
      scaleY: this.scaleY * 1.04,
      duration: 420 + Math.random() * 180,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  now() {
    return this.scene.time.now;
  }

  pose(suffix) {
    const key = `${this.cfg.sprite}-${suffix}`;
    if (this.texture.key !== key && this.scene.textures.exists(key)) {
      this.setTexture(key);
      this.setDisplaySize(this.cfg.displayW, this.cfg.displayH);
    }
    this.setFlipX(this.facing > 0);
  }

  face(dir) {
    if (!dir) return;
    this.facing = dir > 0 ? 1 : -1;
    this.setFlipX(this.facing > 0);
  }

  startWindup() {
    const n = this.now();
    this.state = "windup";
    this.windupUntil = n + this.cfg.windupMs;
    this.hitLanded = false;
    this.pose("windup");
    this.setTint(0xffc090);
    this.scene.time.delayedCall(80, () => {
      if (this.alive && this.state === "windup") this.applyTint();
    });
    this.scene.emitEmbers(this.x, this.y - 18, 5);
    audio.telegraph();
    this.spawnTell();
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 0.88,
      scaleY: this.scaleY * 1.1,
      duration: 90,
      yoyo: true,
    });
  }

  spawnTell() {
    this.clearTell();
    const mark = this.scene.add.image(this.x + this.facing * (this.cfg.range * 0.4), this.y + this.cfg.h * 0.35, "fx-shock");
    mark.setDepth(7);
    mark.setTint(0xc04020);
    mark.setAlpha(0.28);
    mark.setScale(0.35);
    this.tell = mark;
    this.eyeGlow = this.scene.add.circle(this.x, this.y - this.cfg.h * 0.28, 5, 0xff3310, 0.0);
    this.eyeGlow.setDepth(12);
    this.eyeGlow.setBlendMode(Phaser.BlendModes.ADD);
  }

  clearTell() {
    if (this.tell && this.tell.active) this.tell.destroy();
    this.tell = null;
    if (this.eyeGlow && this.eyeGlow.active) this.eyeGlow.destroy();
    this.eyeGlow = null;
  }

  get inParryWindow() {
    if (this.state !== "windup") return false;
    return this.windupUntil - this.now() <= this.cfg.parryMs;
  }

  beginStrike() {
    const n = this.now();
    this.state = "strike";
    this.strikeUntil = n + this.cfg.activeMs;
    this.recoverUntil = this.strikeUntil + this.cfg.recoverMs;
    this.pose("strike");
    juiceAttack(this.scene, this, this.facing);
    if (this.role === "ranged" || this.role === "mage") {
      this.fireBolt();
    } else {
      this.spawnHitBox();
      this.setVelocityX(this.facing * 90);
    }
    this.scene.emitDust(this.x, this.y + 16, 4);
  }

  fireBolt() {
    const key = this.role === "mage" ? "fx-orb" : "fx-shot";
    const bolt = new Projectile(this.scene, this.x + this.facing * 22, this.y - 6, key, {
      vx: this.facing * (this.role === "mage" ? 260 : 380),
      damage: this.cfg.damage,
      from: "enemy",
      tint: this.role === "mage" ? 0xc090ff : 0xe07040,
      life: 1800,
      w: 12,
      h: 12,
    });
    this.scene.addEnemyBolt(bolt);
  }

  spawnHitBox() {
    this.clearHitBox();
    const box = this.scene.add.rectangle(
      this.x + this.facing * (this.cfg.range * 0.45 + 8),
      this.y,
      this.cfg.range,
      this.kind === "brute" ? 44 : 30,
      0xff6644,
      0.08
    );
    this.scene.physics.add.existing(box);
    box.body.setAllowGravity(false);
    box.body.setImmovable(true);
    box.enemy = this;
    this.hitBox = box;
  }

  clearHitBox() {
    if (this.hitBox && this.hitBox.active) this.hitBox.destroy();
    this.hitBox = null;
  }

  stun(ms) {
    this.state = "stun";
    this.stunUntil = this.now() + ms;
    this.clearHitBox();
    this.clearTell();
    this.pose("idle");
    this.setTint(0x88d0ff);
    this.setVelocityX(0);
    this.scene.emitSparks(this.x, this.y - 10, 10);
  }

  takeHit(amount, fromX, riposte = false) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    const dir = Math.sign(this.x - fromX) || 1;
    this.setVelocity(dir * (riposte ? 280 : 160), riposte ? -160 : -80);
    this.hurtUntil = this.now() + 140;
    if (this.state === "windup" || this.state === "strike") {
      this.clearHitBox();
      this.clearTell();
      this.state = "hurt";
    } else if (this.state !== "stun") {
      this.state = "hurt";
    }
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.alive && this.state !== "stun") this.applyTint();
    });
    audio.hit();
    juiceHurt(this.scene, this);
    this.scene.burst(this.x, this.y, riposte ? 0xffe080 : 0xc03030, riposte ? 14 : 8);
    this.scene.emitDust(this.x, this.y, 6);
    this.scene.floatText(
      this.x,
      this.y - 30,
      riposte ? `RIPOSTE ${amount}` : `${amount}`,
      riposte ? "#ffe080" : "#e8e0d4"
    );
    if (this.hp <= 0) this.die();
  }

  explode() {
    if (!this.alive) return;
    this.scene.emitDust(this.x, this.y, 18);
    this.scene.emitSparks(this.x, this.y, 14);
    this.scene.shake(0.016, 140);
    audio.boom();
    const player = this.scene.player;
    if (player?.alive && Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 70) {
      player.takeHit(this.cfg.damage, this.x);
    }
    this.hp = 0;
    this.die();
  }

  die() {
    if (this.wiped || this.state === "dead") {
      this.wipe();
      return;
    }
    this.alive = false;
    this.state = "dead";
    this.clearHitBox();
    this.clearTell();
    if (this.bobTween) this.bobTween.stop();
    this.setVelocity(0, 0);
    if (this.body) this.body.enable = false;
    this.scene.registry.set("kills", (this.scene.registry.get("kills") || 0) + 1);
    this.scene.spawnCoins?.(this.x, this.y, 2 + Math.floor(Math.random() * 3));
    juiceDie(this.scene, this, () => this.wipe());
  }

  wipe() {
    if (this.wiped) return;
    this.wiped = true;
    this.clearHitBox();
    this.clearTell();
    if (this.bobTween) this.bobTween.stop();
    if (this.body) this.body.enable = false;
    this.destroy();
  }

  updateTell() {
    if (!this.tell || !this.tell.active) return;
    const total = this.cfg.windupMs;
    const left = Math.max(0, this.windupUntil - this.now());
    const p = 1 - left / total;
    this.tell.x = this.x + this.facing * (this.cfg.range * 0.4);
    this.tell.y = this.y + this.cfg.h * 0.35;
    this.tell.setScale(0.35 + p * 0.7);
    this.tell.setAlpha(0.22 + p * 0.45);
    if (this.eyeGlow && this.eyeGlow.active) {
      this.eyeGlow.setPosition(this.x + this.facing * 6, this.y - this.cfg.h * 0.28);
      this.eyeGlow.setAlpha(0.15 + p * 0.7);
      this.eyeGlow.setScale(0.7 + p * 1.4);
    }
    if (this.inParryWindow) {
      this.tell.setTint(0xf4f0e0);
      this.setTint(0xffe8c0);
      if (this.eyeGlow && this.eyeGlow.active) this.eyeGlow.setFillStyle(0xfff2c0, 0.85);
    }
  }

  canClaimAttack(player) {
    return this.scene.canEnemyAttack(this, player);
  }

  ledgeAhead(dir) {
    const x = this.x + dir * (this.cfg.w * 0.5 + 10);
    const y = this.y + this.cfg.h / 2 + 8;
    const plats = this.scene.platforms?.getChildren?.() || [];
    return !plats.some((p) => {
      const b = p.getBounds();
      return x >= b.left && x <= b.right && y >= b.top - 6 && y <= b.bottom + 12;
    });
  }

  tryHealAllies(n) {
    if (!this.cfg.heal || n < this.healAt) return;
    this.healAt = n + this.cfg.healEveryMs;
    this.scene.enemies.getChildren().forEach((e) => {
      if (!e.alive || e === this) return;
      if (e.hp >= e.hpMax) return;
      if (Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) > 180) return;
      e.hp = Math.min(e.hpMax, e.hp + this.cfg.heal);
      this.scene.emitEmbers(e.x, e.y - 10, 6);
      this.scene.floatText(e.x, e.y - 36, `+${this.cfg.heal}`, "#c090ff");
    });
  }

  refresh(player) {
    if (!this.alive || !player.alive) {
      if (this.alive) this.setVelocityX(0);
      return;
    }

    const n = this.now();
    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    const dir = Math.sign(dx) || this.facing;

    if (this.role === "mage") this.tryHealAllies(n);

    if (this.state === "stun") {
      this.setVelocityX(0);
      this.setAlpha(0.85 + Math.sin(n / 40) * 0.15);
      if (n >= this.stunUntil) {
        this.setAlpha(1);
        this.applyTint();
        this.state = "idle";
        this.pose("idle");
      }
      return;
    }
    this.setAlpha(1);

    if (this.state === "hurt") {
      if (n >= this.hurtUntil) {
        this.applyTint();
        this.state = "idle";
        this.pose("idle");
      }
      return;
    }

    if (this.state === "windup") {
      this.setVelocityX(0);
      this.face(dir);
      this.pose("windup");
      this.updateTell();
      if (n >= this.windupUntil) this.beginStrike();
      return;
    }

    if (this.state === "strike") {
      if (!this.hitLanded && this.hitBox && player.alive) {
        if (this.scene.physics.overlap(this.hitBox, player)) {
          this.hitLanded = true;
          const result = player.takeHit(this.cfg.damage, this.x);
          if (result === "parry") {
            this.stun(this.cfg.stunMs);
            return;
          }
        }
      }
      if (n >= this.strikeUntil) {
        this.clearHitBox();
        this.clearTell();
        this.applyTint();
        this.state = "recover";
        this.pose("idle");
      }
      return;
    }

    if (this.state === "recover") {
      this.setVelocityX(0);
      if (n >= this.recoverUntil) this.state = "idle";
      return;
    }

    this.pose("idle");

    const aggro = Math.max(this.cfg.aggro, 720);
    const inCombat =
      dist < (this.cfg.range || 50) + 10 && Math.abs(player.y - this.y) < 70;

    if (this.role === "kamikaze" && dist < 38 && Math.abs(player.y - this.y) < 50) {
      this.explode();
      return;
    }

    if (inCombat && this.role !== "kamikaze") {
      this.face(dir);
      if (this.role === "ranged" || this.role === "mage") {
        this.setVelocityX(0);
        if (this.canClaimAttack(player) && n >= this.thinkAt) {
          this.thinkAt = n + 220;
          this.startWindup();
        }
        return;
      }
      this.setVelocityX(0);
      if (this.canClaimAttack(player) && n >= this.thinkAt) {
        this.thinkAt = n + 180;
        this.startWindup();
      }
      return;
    }

    if (dist < aggro || Math.abs(player.y - this.y) > 40) {
      this.chase(player, n);
      return;
    }

    this.setVelocityX(this.patrolDir * this.cfg.speed * 0.35);
    this.face(this.patrolDir);
    if (this.ledgeAhead(this.patrolDir) || Math.abs(this.x - this.home) > 120) this.patrolDir *= -1;
  }

  chase(player, n) {
    if (!this.scene.nav) {
      const dir = Math.sign(player.x - this.x) || this.facing;
      this.face(dir);
      if (!this.ledgeAhead(dir)) this.setVelocityX(dir * this.cfg.speed);
      else this.setVelocityX(0);
      return;
    }
    if (n >= this.pathAt) {
      this.pathAt = n + 420;
      this.path = this.scene.findPath(this.x, this.y + this.cfg.h * 0.4, player.x, player.y + 20);
    }
    if (!this.path || this.path.length < 2) {
      const dir = Math.sign(player.x - this.x) || this.facing;
      this.face(dir);
      const grounded = this.body.blocked.down || this.body.touching.down;
      if (player.y > this.y + 50 && this.ledgeAhead(dir)) {
        this.setVelocityX(dir * this.cfg.speed);
        return;
      }
      if (player.y < this.y - 40 && grounded && (this.ledgeAhead(dir) || Math.abs(player.x - this.x) < 40)) {
        this.setVelocity(dir * 200, -560);
        return;
      }
      if (!this.ledgeAhead(dir)) this.setVelocityX(dir * this.cfg.speed);
      else this.setVelocityX(0);
      return;
    }
    while (this.path.length > 1 && Math.abs(this.path[0].x - this.x) < 18 && Math.abs(this.path[0].y - (this.y + this.cfg.h * 0.4)) < 28) {
      this.path.shift();
    }
    const next = this.path[0];
    if (!next) return;
    const dir = Math.sign(next.x - this.x) || this.facing;
    this.face(dir);
    const via = next.via || "walk";
    const grounded = this.body.blocked.down || this.body.touching.down;

    if (via === "jump" && grounded && (this.ledgeAhead(dir) || next.y < this.y - 20)) {
      this.setVelocity(dir * Math.max(this.cfg.speed, 180), -560);
      this.navJumping = true;
      return;
    }
    if (via === "drop" && this.ledgeAhead(dir)) {
      this.setVelocityX(dir * this.cfg.speed);
      return;
    }
    if (via === "walk" && this.ledgeAhead(dir) && grounded) {
      if (next.y > this.y + 30) this.setVelocityX(dir * this.cfg.speed);
      else if (Math.abs(next.x - this.x) > 30) this.setVelocity(dir * 190, -520);
      else this.setVelocityX(0);
      return;
    }
    this.setVelocityX(dir * this.cfg.speed);
  }
}
