import {
  START_AGE,
  MOVE,
  COMBAT,
  GRAPPLE,
  WEAPONS,
  maxHealthForAge,
  attackForAge,
  playerTintForAge,
} from "../config.js";
import { audio } from "../audio.js";
import { juiceAttack, juiceHurt, juiceDash, juiceDie } from "../juice.js";
import { Projectile } from "./Projectile.js";
import { raycastBoxes } from "../gen/ray.js";

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, age = START_AGE) {
    super(scene, x, y, "player-idle");
    this.scene = scene;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setDisplaySize(80, 80);
    this.setSize(26, 48);
    this.setOffset(35, 30);
    this.setCollideWorldBounds(true);
    this.setMaxVelocity(900, MOVE.maxFall);
    this.setDrag(0, 0);

    this.facing = 1;
    this.age = age;
    this.applyAgeStats(true);
    this.hp = this.hpMax;

    this.state = "idle";
    this.jumpsLeft = 2;
    this.coyoteUntil = 0;
    this.jumpBufferedUntil = 0;
    this.jumpHeld = false;
    this.cutJump = false;
    this.jumpStartedAt = 0;

    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.dodgeUntil = 0;
    this.dodgeReadyAt = 0;
    this.invulnUntil = 0;

    this.blocking = false;
    this.parryUntil = 0;
    this.blockHeld = false;

    this.attackStep = 0;
    this.attackPhase = "idle";
    this.attackPhaseUntil = 0;
    this.attackHitDone = false;
    this.queuedAttack = false;
    this.riposteUntil = 0;
    this.attackKind = "light";
    this.hitSet = new Set();

    this.charging = false;
    this.chargeStart = 0;
    this.charged = false;
    this.slamPending = false;

    this.hurtUntil = 0;
    this.aging = false;
    this.alive = true;
    this.lastGrounded = true;
    this.attackBox = null;
    this.lastAnim = "";
    this.energy = COMBAT.specialMax;
    this.specialReadyAt = 0;
    this.baseScaleX = 1;
    this.baseScaleY = 1;
    this.grappling = false;
    this.hooking = false;
    this.hookX = 0;
    this.hookY = 0;
    this.ropeLen = 0;
    this.swingW = 0;
    this.grappleReadyAt = 0;
    this.aimX = 1;
    this.aimY = -1;
    this.coins = 0;
    this.weaponId = "sword";
    this.wep = WEAPONS.sword;
    this.bonusAtk = 0;
    this.bonusHp = 0;
    this.energyMax = COMBAT.specialMax;

    this.arm = scene.add.image(x + 16, y + 4, "wep-sword").setDepth(11);
    this.refreshLook();
    this.showPose("player-idle");
  }

  applyAgeStats(skipHp = false) {
    const prevMax = this.hpMax || maxHealthForAge(this.age);
    this.hpMax = maxHealthForAge(this.age) + (this.bonusHp || 0);
    this.atk = attackForAge(this.age) + (this.bonusAtk || 0);
    if (!skipHp) {
      const ratio = prevMax > 0 ? this.hp / prevMax : 1;
      this.hp = Math.max(1, Math.round(this.hpMax * Math.min(1, ratio)));
    }
    this.refreshLook();
  }

  refreshLook() {
    const age = playerTintForAge(this.age);
    const wt = this.wep?.tint || 0xffffff;
    const r = Math.round((((age >> 16) & 255) * ((wt >> 16) & 255)) / 255);
    const g = Math.round((((age >> 8) & 255) * ((wt >> 8) & 255)) / 255);
    const b = Math.round(((age & 255) * (wt & 255)) / 255);
    this.setTint((r << 16) | (g << 8) | b);
    this.syncWeaponVisual();
  }

  syncWeaponVisual() {
    if (!this.arm || !this.arm.active) return;
    const key = this.wep?.overlay;
    if (key && this.scene.textures.exists(key)) {
      if (this.arm.texture.key !== key) this.arm.setTexture(key);
      this.arm.setVisible(this.alive);
    } else {
      this.arm.setVisible(false);
    }
    const sc = (this.wep?.scale || 1) * 1.15;
    this.arm.setScale(sc);
    const ox = this.wep?.id === "bow" ? this.facing * 10 : this.facing * 18;
    const oy = this.wep?.id === "hammer" ? 0 : this.wep?.id === "bow" ? 2 : 6;
    this.arm.setPosition(this.x + ox, this.y + oy);
    this.arm.setFlipX(this.facing < 0);
    this.arm.setAngle(this.wep?.id === "bow" ? this.facing * -12 : this.state === "attack" ? this.facing * 25 : 0);
    this.arm.setDepth((this.depth || 10) + 1);
    this.arm.setAlpha(this.alpha);
  }

  now() {
    return this.scene.time.now;
  }

  get grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  get invulnerable() {
    return this.now() < this.invulnUntil || this.state === "dash" || this.state === "dodge" || this.state === "slam";
  }

  get isParrying() {
    return this.blocking && this.now() <= this.parryUntil && this.state === "block";
  }

  get isBlocking() {
    return this.blocking && this.state === "block";
  }

  get busy() {
    return (
      this.aging ||
      this.state === "dash" ||
      this.state === "dodge" ||
      this.state === "attack" ||
      this.state === "heavy" ||
      this.state === "slam" ||
      this.state === "hurt" ||
      this.state === "dead" ||
      this.state === "grapple"
    );
  }

  face(dir) {
    if (!dir) return;
    this.facing = dir > 0 ? 1 : -1;
    this.setFlipX(this.facing < 0);
  }

  showPose(key, anim = false) {
    if (anim) {
      if (this.lastAnim !== key) {
        this.play(key, true);
        this.lastAnim = key;
      }
      const s = 80 * (this.wep?.scale || 1);
      this.setDisplaySize(s, s);
      this.syncWeaponVisual();
      return;
    }
    this.lastAnim = key;
    if (this.anims.isPlaying) this.anims.stop();
    if (this.texture.key !== key) this.setTexture(key);
    const s = 80 * (this.wep?.scale || 1);
    this.setDisplaySize(s, s);
    this.syncWeaponVisual();
  }

  tryJump() {
    this.jumpBufferedUntil = this.now() + MOVE.bufferMs;
  }

  consumeJump() {
    const n = this.now();
    const canCoyote = n <= this.coyoteUntil && this.jumpsLeft >= 1;
    const canGround = this.grounded && this.jumpsLeft >= 1;
    const canDouble = !this.grounded && this.jumpsLeft > 0 && !(canCoyote || canGround);
    if (this.grappling) {
      this.releaseGrapple(true);
      return true;
    }
    if (this.state === "dash" || this.state === "dodge" || this.state === "hurt" || this.aging) return false;
    if (this.state === "attack" || this.state === "heavy" || this.state === "slam") return false;

    if (canGround || canCoyote) {
      this.setVelocityY(-MOVE.jumpSpeed);
      this.jumpsLeft = 1;
      this.coyoteUntil = 0;
      this.jumpBufferedUntil = 0;
      this.jumpHeld = true;
      this.cutJump = false;
      this.jumpStartedAt = n;
      this.state = "jump";
      this.cancelCharge();
      audio.jump();
      this.scene.emitDust(this.x, this.y + 22, 5);
      return true;
    }
    if (canDouble) {
      this.setVelocityY(-MOVE.doubleJumpSpeed);
      this.jumpsLeft = 0;
      this.jumpBufferedUntil = 0;
      this.jumpHeld = true;
      this.cutJump = false;
      this.jumpStartedAt = n;
      this.state = "djump";
      this.cancelCharge();
      audio.doubleJump();
      this.scene.emitEmbers(this.x, this.y + 8, 6);
      return true;
    }
    return false;
  }

  tryDash(inputX) {
    const n = this.now();
    if (n < this.dashReadyAt || this.aging || this.state === "hurt" || this.state === "attack" || this.state === "heavy") {
      return false;
    }
    if (this.grappling) this.releaseGrapple(false);
    const dir = inputX !== 0 ? Math.sign(inputX) : this.facing;
    this.face(dir);
    this.cancelCharge();
    this.state = "dash";
    this.attackKind = "dash";
    this.dashUntil = n + MOVE.dashMs;
    this.dashReadyAt = n + MOVE.dashCooldownMs;
    this.invulnUntil = n + MOVE.dashIFramesMs;
    this.blocking = false;
    this.hitSet = new Set();
    this.attackHitDone = false;
    this.setVelocity(dir * MOVE.dashSpeed, this.grounded ? 0 : this.body.velocity.y * 0.35);
    this.body.setAllowGravity(false);
    this.spawnAttackBox(COMBAT.dashThrustRange, 26, 0.05);
    audio.dash();
    this.scene.emitDust(this.x, this.y + 10, 8);
    this.scene.emitSlash(this.x, this.y, this.facing);
    juiceDash(this.scene, this, dir);
    return true;
  }

  tryDodge(inputX) {
    const n = this.now();
    if (n < this.dodgeReadyAt || this.aging || this.state === "hurt" || this.state === "dash") return false;
    if ((this.state === "attack" || this.state === "heavy") && this.attackPhase === "active") return false;
    const dir = inputX !== 0 ? Math.sign(inputX) : this.facing;
    this.face(dir);
    this.cancelCharge();
    this.state = "dodge";
    this.dodgeUntil = n + MOVE.dodgeMs;
    this.dodgeReadyAt = n + MOVE.dodgeCooldownMs;
    this.invulnUntil = n + MOVE.dodgeIFramesMs;
    this.blocking = false;
    this.endAttack();
    this.body.setAllowGravity(true);
    this.setVelocity(dir * MOVE.dodgeSpeed, this.grounded ? -80 : this.body.velocity.y * 0.4);
    audio.dodge();
    this.scene.emitDust(this.x, this.y + 12, 6);
    return true;
  }

  startBlock() {
    if (this.aging || this.state === "hurt" || this.state === "dash" || this.state === "dodge" || this.state === "slam") {
      return;
    }
    if (this.state === "attack" || this.state === "heavy") return;
    if (this.blockHeld) return;
    this.cancelCharge();
    this.blockHeld = true;
    this.blocking = true;
    this.parryUntil = this.now() + COMBAT.parryWindowMs;
    this.state = "block";
    this.setVelocityX(this.body.velocity.x * 0.4);
  }

  releaseBlock() {
    this.blockHeld = false;
    this.blocking = false;
    if (this.state === "block") this.state = this.grounded ? "idle" : "fall";
  }

  onStrikeDown(preferDir, downHeld) {
    if (this.aging || this.state === "hurt") return;
    if (this.state === "dash") return;
    if (!this.grounded && downHeld) {
      this.startSlam();
      return;
    }
    if (this.state === "attack" || this.state === "heavy" || this.state === "slam" || this.state === "dodge") {
      if (this.state === "attack" && this.attackStep < 2 && (this.attackPhase === "active" || this.attackPhase === "recover")) {
        this.queuedAttack = true;
      }
      return;
    }
    if (this.state === "block") this.releaseBlock();
    if (preferDir) this.face(preferDir);
    this.charging = true;
    this.charged = false;
    this.chargeStart = this.now();
  }

  onStrikeUp(preferDir) {
    if (!this.charging) return;
    const ready = this.charged || this.now() - this.chargeStart >= COMBAT.chargeMs;
    this.charging = false;
    if (this.aging || this.state === "hurt" || this.state === "dash" || this.state === "slam") return;
    if (preferDir) this.face(preferDir);
    if (ready) this.beginHeavy();
    else this.tryAttack(preferDir);
  }

  cancelCharge() {
    this.charging = false;
    this.charged = false;
  }

  setAim(wx, wy) {
    this.aimX = wx - this.x;
    this.aimY = wy - this.y;
  }

  tryGrapple() {
    if (this.aging || !this.alive || this.state === "hurt" || this.state === "dead") return false;
    if (this.grappling || this.hooking) {
      this.releaseGrapple(false);
      return true;
    }
    if (this.now() < this.grappleReadyAt) return false;
    let dx = this.aimX;
    let dy = this.aimY;
    if (Math.abs(dx) + Math.abs(dy) < 8) {
      dx = this.facing;
      dy = -1.15;
    }
    const boxes = this.scene.grappleBoxes?.() || [];
    const hit = raycastBoxes(this.x, this.y - 10, dx, dy, GRAPPLE.maxRange, boxes);
    this.scene.showGrappleShot(this.x, this.y - 10, hit, dx, dy);
    if (!hit) {
      audio.swing(0);
      this.grappleReadyAt = this.now() + GRAPPLE.cooldownMs;
      return false;
    }
    const L = Math.max(GRAPPLE.minLen, hit.t);
    this.hookX = hit.x;
    this.hookY = hit.y;
    this.ropeLen = L;
    this.hooking = true;
    this.cancelCharge();
    this.endAttack();
    this.body.setAllowGravity(false);
    const pullX = this.x;
    const pullY = this.y;
    this.scene.tweens.add({
      targets: this,
      x: this.hookX + ((pullX - this.hookX) / L) * Math.min(L, 120),
      y: this.hookY + ((pullY - this.hookY) / L) * Math.min(L, 120),
      duration: 70,
      onComplete: () => this.attachGrapple(),
    });
    audio.dash();
    return true;
  }

  attachGrapple() {
    if (!this.alive || this.aging) return;
    this.hooking = false;
    this.grappling = true;
    this.state = "grapple";
    this.body.setAllowGravity(false);
    const dx = this.x - this.hookX;
    const dy = this.y - this.hookY;
    this.ropeLen = Math.max(GRAPPLE.minLen, Math.hypot(dx, dy));
    const th = Math.atan2(dx, dy);
    const tx = Math.cos(th);
    const ty = -Math.sin(th);
    this.swingW = (this.body.velocity.x * tx + this.body.velocity.y * ty) / this.ropeLen;
    this.scene.emitSparks(this.hookX, this.hookY, 8);
  }

  releaseGrapple(boost) {
    if (!this.grappling && !this.hooking) return;
    this.grappling = false;
    this.hooking = false;
    this.grappleReadyAt = this.now() + GRAPPLE.cooldownMs;
    this.body.setAllowGravity(true);
    this.state = this.grounded ? "idle" : "fall";
    if (boost) {
      this.setVelocity(this.body.velocity.x * 1.05, Math.min(this.body.velocity.y, -260));
      this.jumpsLeft = Math.max(this.jumpsLeft, 1);
    }
    this.scene.clearGrappleShot();
  }

  updateGrapple(input, dt) {
    if (input.x) this.face(input.x);
    if (input.x) this.swingW += input.x * GRAPPLE.swingAccel * dt;
    if (input.up) this.ropeLen = Math.max(GRAPPLE.minLen, this.ropeLen - GRAPPLE.reel * dt);
    if (input.down) this.ropeLen = Math.min(GRAPPLE.maxRange, this.ropeLen + GRAPPLE.reel * dt);

    let dx = this.x - this.hookX;
    let dy = this.y - this.hookY;
    let th = Math.atan2(dx, dy);
    const g = MOVE.gravity;
    const a = -(g / Math.max(80, this.ropeLen)) * Math.sin(th);
    this.swingW += a * dt;
    this.swingW *= GRAPPLE.damping;
    th += this.swingW * dt;
    const nx = this.hookX + this.ropeLen * Math.sin(th);
    const ny = this.hookY + this.ropeLen * Math.cos(th);
    const vx = this.ropeLen * this.swingW * Math.cos(th);
    const vy = -this.ropeLen * this.swingW * Math.sin(th);
    this.setPosition(nx, ny);
    this.setVelocity(vx, vy);
    this.body.setAllowGravity(false);
    this.scene.drawGrapple(this.x, this.y - 8, this.hookX, this.hookY);
  }

  startSlam() {
    if (this.grappling || this.hooking) this.releaseGrapple(false);
    if (this.grounded || this.state === "slam") return;
    this.cancelCharge();
    this.state = "slam";
    this.attackKind = "slam";
    this.slamPending = true;
    this.blocking = false;
    this.endAttack();
    this.body.setAllowGravity(true);
    this.setVelocity(this.facing * 70, COMBAT.slamSpeed);
    this.hitSet = new Set();
    audio.dash();
    this.scene.emitEmbers(this.x, this.y, 8);
  }

  beginHeavy() {
    const n = this.now();
    this.state = "heavy";
    this.attackKind = "heavy";
    this.attackPhase = "startup";
    this.attackPhaseUntil = n + COMBAT.heavyStartupMs;
    this.attackHitDone = false;
    this.hitSet = new Set();
    this.queuedAttack = false;
    this.blocking = false;
    this.setVelocityX(this.facing * 40);
    audio.swing(2);
    this.scene.emitEmbers(this.x, this.y - 16, 10);
    juiceAttack(this.scene, this, this.facing);
  }

  tryAttack(preferDir = 0) {
    if (this.aging || this.state === "hurt" || this.state === "dash" || this.state === "dodge" || this.state === "slam") {
      return false;
    }
    if (this.state === "block") this.releaseBlock();
    if (this.state === "attack") {
      if (this.attackStep < 2 && (this.attackPhase === "active" || this.attackPhase === "recover")) {
        this.queuedAttack = true;
      }
      return false;
    }
    if (this.state === "heavy") return false;
    if (preferDir) this.face(preferDir);
    this.beginAttack(0);
    return true;
  }

  beginAttack(step) {
    const n = this.now();
    this.state = "attack";
    this.attackKind = "light";
    this.attackStep = step;
    this.attackPhase = "startup";
    this.attackPhaseUntil = n + this.wep.lock[step];
    this.attackHitDone = false;
    this.hitSet = new Set();
    this.queuedAttack = false;
    this.blocking = false;
    this.setVelocityX(this.facing * (90 + step * 40));
    audio.swing(step);
    juiceAttack(this.scene, this, this.facing);
  }

  endAttack() {
    this.attackPhase = "idle";
    this.destroyAttackBox();
    if (this.state === "attack" || this.state === "heavy") {
      this.state = this.grounded ? "idle" : "fall";
    }
  }

  destroyAttackBox() {
    if (this.attackBox) {
      this.attackBox.destroy();
      this.attackBox = null;
    }
  }

  spawnAttackBox(range, h, alpha = 0.12) {
    if (this.wep.kind === "ranged" && this.attackKind === "light") {
      const bolt = new Projectile(this.scene, this.x + this.facing * 26, this.y - 2, "fx-bolt", {
        vx: this.facing * 700,
        damage: Math.round(this.atk * this.wep.dmg[0]),
        from: "player",
        tint: 0xe8d0a0,
        life: 900,
        w: 16,
        h: 6,
      });
      this.scene.addPlayerBolt(bolt);
      return;
    }
    this.destroyAttackBox();
    const box = this.scene.add.rectangle(
      this.x + this.facing * (20 + range * 0.35),
      this.y + 4,
      range,
      h,
      0xf2e8d0,
      alpha
    );
    this.scene.physics.add.existing(box);
    box.body.setAllowGravity(false);
    box.body.setImmovable(true);
    this.attackBox = box;
  }

  onLand() {
    this.jumpsLeft = 2;
    this.coyoteUntil = this.now() + MOVE.coyoteMs;
    if (this.state === "slam" && this.slamPending) {
      this.slamPending = false;
      this.scene.onSlamImpact(this);
      this.state = "attack";
      this.attackKind = "slam";
      this.attackPhase = "recover";
      this.attackPhaseUntil = this.now() + 320;
      this.destroyAttackBox();
      return;
    }
    if (this.state === "jump" || this.state === "djump" || this.state === "fall") {
      this.state = Math.abs(this.body.velocity.x) > 20 ? "run" : "idle";
      audio.land();
      this.scene.emitDust(this.x, this.y + 22, 6);
    }
  }

  takeHit(amount, fromX, kind = "hit") {
    if (!this.alive || this.aging) return "ignore";
    if (this.invulnerable && kind === "hit") return "whiff";

    const dir = Math.sign(this.x - fromX) || -this.facing;

    if (this.isParrying && Math.sign(fromX - this.x) === this.facing) {
      this.scene.onParry(this, fromX);
      this.riposteUntil = this.now() + COMBAT.riposteWindowMs;
      return "parry";
    }

    if (this.isBlocking && Math.sign(fromX - this.x) === this.facing) {
      const chip = Math.max(COMBAT.blockChipMin, Math.round(amount * COMBAT.blockDamageScale));
      this.hp = Math.max(0, this.hp - chip);
      this.setVelocity(dir * 160, -40);
      audio.block();
      this.scene.emitSparks(this.x + this.facing * 14, this.y, 7);
      this.scene.floatText(this.x, this.y - 40, `BLOCK ${chip}`, "#c8b080");
      this.scene.shake(0.006, 70);
      if (this.hp <= 0) this.scene.onPlayerDown();
      return "block";
    }

    this.cancelCharge();
    if (this.grappling || this.hooking) this.releaseGrapple(false);
    this.hp = Math.max(0, this.hp - amount);
    this.state = "hurt";
    this.hurtUntil = this.now() + 180;
    this.invulnUntil = this.now() + COMBAT.hurtIFramesMs;
    this.blocking = false;
    this.endAttack();
    this.body.setAllowGravity(true);
    this.setVelocity(dir * 260, -180);
    audio.hurt();
    this.scene.burst(this.x, this.y, 0xa02020, 14);
    this.scene.emitDust(this.x, this.y, 8);
    this.scene.floatText(this.x, this.y - 40, `${amount}`, "#e06060");
    this.scene.shake(0.016, 140);
    this.scene.hitstop(COMBAT.hitstopMs);
    this.setTintFill(0xff4040);
    this.scene.time.delayedCall(90, () => this.refreshLook());
    juiceHurt(this.scene, this);
    if (this.hp <= 0) this.scene.onPlayerDown();
    return "hit";
  }

  collapse() {
    this.aging = true;
    this.alive = false;
    this.state = "dead";
    this.blocking = false;
    this.cancelCharge();
    this.endAttack();
    this.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    if (this.arm) this.arm.setVisible(false);
    juiceDie(this.scene, this);
  }

  riseAfterAge() {
    this.alive = true;
    this.aging = false;
    this.hp = this.hpMax;
    this.invulnUntil = this.now() + 900;
    this.state = "idle";
    this.body.setAllowGravity(true);
    this.scene.tweens.killTweensOf(this);
    this.setAngle(0);
    this.setScale(1, 1);
    this.setAlpha(1);
    if (this.arm) this.arm.setVisible(true);
    this.syncWeaponVisual();
    this.scene.tweens.add({
      targets: this,
      scaleY: 1,
      duration: 280,
      ease: "Back.easeOut",
    });
    this.refreshLook();
  }

  trySpecial() {
    const n = this.now();
    if (!this.alive || this.aging || this.state === "hurt" || this.state === "dead") return false;
    if (this.energy < COMBAT.specialCost || n < this.specialReadyAt) return false;
    this.energy -= COMBAT.specialCost;
    this.specialReadyAt = n + COMBAT.specialCooldownMs;
    this.cancelCharge();
    const bolt = new Projectile(this.scene, this.x + this.facing * 28, this.y - 4, "fx-bolt", {
      vx: this.facing * COMBAT.specialSpeed,
      damage: Math.round(this.atk * COMBAT.specialScale),
      from: "player",
      tint: 0x9ae8f0,
      life: 1600,
      w: 18,
      h: 8,
    });
    this.scene.addPlayerBolt(bolt);
    audio.special();
    this.scene.emitEmbers(this.x + this.facing * 20, this.y, 8);
    juiceAttack(this.scene, this, this.facing);
    this.scene.floatText(this.x, this.y - 44, "ASHBOLT", "#8ad4dc");
    return true;
  }

  refresh(input, delta) {
    if (this.aging || this.state === "dead") {
      this.syncVisual();
      return;
    }

    const n = this.now();
    const dt = delta / 1000;
    this.energy = Math.min(this.energyMax || COMBAT.specialMax, this.energy + COMBAT.specialRegen * dt);

    if (this.grappling) {
      this.updateGrapple(input, dt);
      this.syncVisual();
      return;
    }

    const grounded = this.grounded;

    if (grounded && !this.lastGrounded) this.onLand();
    if (!grounded && this.lastGrounded) {
      this.coyoteUntil = n + MOVE.coyoteMs;
      if (this.jumpsLeft === 2) this.jumpsLeft = 1;
    }
    this.lastGrounded = grounded;

    if (n < this.jumpBufferedUntil) {
      if (this.consumeJump()) this.jumpBufferedUntil = 0;
    }

    if (this.charging && n - this.chargeStart >= COMBAT.chargeMs) {
      this.charged = true;
      if (n % 80 < 16) this.scene.emitEmbers(this.x - this.facing * 8, this.y - 18, 1);
    }

    if (this.state === "dash") {
      this.setVelocityX(this.facing * MOVE.dashSpeed);
      this.setVelocityY(0);
      if (this.attackBox) {
        this.attackBox.x = this.x + this.facing * 40;
        this.attackBox.y = this.y + 4;
      }
      if (n >= this.dashUntil) {
        this.body.setAllowGravity(true);
        this.setVelocityX(this.facing * MOVE.maxSpeed * 0.7);
        this.destroyAttackBox();
        this.state = grounded ? "run" : "fall";
      }
      this.applyGravity(grounded);
      this.syncVisual();
      return;
    }

    if (this.state === "slam") {
      this.setVelocityY(Math.max(this.body.velocity.y, COMBAT.slamSpeed * 0.7));
      this.applyGravity(grounded);
      this.syncVisual();
      return;
    }

    if (this.state === "dodge") {
      if (n >= this.dodgeUntil) this.state = grounded ? "idle" : "fall";
      this.applyGravity(grounded);
      this.syncVisual();
      return;
    }

    if (this.state === "hurt") {
      this.applyGravity(grounded);
      if (n >= this.hurtUntil) this.state = grounded ? "idle" : "fall";
      this.syncVisual();
      return;
    }

    if (this.state === "attack" || this.state === "heavy") {
      this.updateAttack(n);
      this.applyGravity(grounded);
      if (!grounded) {
        this.setVelocityX(Phaser.Math.Linear(this.body.velocity.x, input.x * MOVE.maxSpeed * 0.35, 0.08));
      }
      this.syncVisual();
      return;
    }

    if (this.blockHeld && this.state !== "block" && !this.busy) {
      this.state = "block";
      this.blocking = true;
    }

    const chargeSlow = this.charging ? 0.45 : 1;
    const target = input.x * MOVE.maxSpeed * (this.state === "block" ? 0.35 : chargeSlow);
    const turning =
      input.x !== 0 &&
      this.body.velocity.x !== 0 &&
      Math.sign(input.x) !== Math.sign(this.body.velocity.x);
    const accel = grounded
      ? input.x !== 0
        ? turning
          ? MOVE.accel * 1.85
          : MOVE.accel
        : MOVE.decel
      : input.x !== 0
        ? MOVE.airAccel
        : MOVE.airDecel;
    const maxStep = accel * dt;
    const next =
      Math.abs(target - this.body.velocity.x) <= maxStep
        ? target
        : this.body.velocity.x + Math.sign(target - this.body.velocity.x) * maxStep;
    this.setVelocityX(next);

    if (input.x !== 0 && this.state !== "block" && !this.charging) this.face(input.x);

    if (
      !input.jumpHeld &&
      this.jumpHeld &&
      this.body.velocity.y < 0 &&
      !this.cutJump &&
      n - this.jumpStartedAt >= MOVE.jumpMinMs
    ) {
      this.setVelocityY(this.body.velocity.y * MOVE.jumpCut);
      this.cutJump = true;
    }
    this.jumpHeld = input.jumpHeld;
    this.applyGravity(grounded);

    if (this.state === "block") {
      this.syncVisual();
      return;
    }

    if (!grounded) {
      this.state = this.body.velocity.y < 0 ? (this.state === "djump" ? "djump" : "jump") : "fall";
    } else if (this.charging) {
      this.state = "idle";
    } else if (Math.abs(this.body.velocity.x) > 24) {
      this.state = "run";
    } else {
      this.state = "idle";
    }
    this.syncVisual();
  }

  syncVisual() {
    this.setFlipX(this.facing < 0);
    const fade = this.invulnerable && this.now() < this.invulnUntil && this.state !== "dash" && this.state !== "slam";
    this.setAlpha(fade ? 0.7 : 1);

    if (this.state === "run") this.showPose("player-run", true);
    else if (this.state === "jump" || this.state === "djump" || this.state === "fall") this.showPose("player-jump");
    else if (this.state === "grapple") this.showPose("player-jump");
    else if (this.state === "dash") this.showPose("player-dash");
    else if (this.state === "slam") this.showPose("player-slam");
    else if (this.state === "block") this.showPose("player-block");
    else if (this.state === "hurt" || this.state === "dead") this.showPose("player-hurt");
    else if (this.state === "heavy") this.showPose(this.attackPhase === "startup" ? "player-charge" : "player-heavy");
    else if (this.state === "attack") this.showPose("player-attack");
    else if (this.charging && this.now() - this.chargeStart > 180) this.showPose("player-charge");
    else this.showPose("player-idle");
    this.syncWeaponVisual();
  }

  equipWeapon(id) {
    const next = WEAPONS[id];
    if (!next) return;
    this.weaponId = id;
    this.wep = next;
    this.refreshLook();
    this.setTintFill(next.glow || 0xffffff);
    this.scene.time.delayedCall(140, () => this.refreshLook());
    this.scene.emitEmbers(this.x, this.y, 10);
    this.scene.floatText(this.x, this.y - 50, next.name, "#e8d080");
    this.scene.hud?.flashBanner(next.name, "#e8d080");
  }

  addCoins(n) {
    this.coins += n;
    this.scene.registry.set("coins", this.coins);
  }

  buyUpgrade(id) {
    const item = (this.scene.shopStock || []).find((s) => s.id === id);
    if (!item || this.coins < item.cost) return false;
    this.coins -= item.cost;
    this.scene.registry.set("coins", this.coins);
    if (id === "vita") {
      this.bonusHp += 18;
      this.applyAgeStats(true);
      this.hp = Math.min(this.hpMax, this.hp + 18);
    } else if (id === "edge") {
      this.bonusAtk += 5;
      this.applyAgeStats(true);
    } else if (id === "ash") {
      this.energyMax += 20;
      this.energy = this.energyMax;
    } else if (id === "salve") {
      this.hp = this.hpMax;
    }
    audio.ui();
    return true;
  }

  applyGravity(grounded) {
    this.setMaxVelocity(900, this.state === "slam" ? 1100 : MOVE.maxFall);
    if (!grounded && this.body.velocity.y > 0) this.setGravityY(MOVE.fallGravity - MOVE.gravity);
    else this.setGravityY(0);
  }

  updateAttack(n) {
    if (n < this.attackPhaseUntil) return;
    if (this.state === "heavy") {
      if (this.attackPhase === "startup") {
        this.attackPhase = "active";
        this.attackPhaseUntil = n + COMBAT.heavyActiveMs;
        this.spawnAttackBox(COMBAT.heavyRange, 42, 0.16);
        this.scene.emitSlash(this.x, this.y, this.facing);
        this.scene.shake(0.02, 180);
        this.scene.hitstop(80);
        return;
      }
      if (this.attackPhase === "active") {
        this.attackPhase = "recover";
        this.attackPhaseUntil = n + COMBAT.heavyRecoverMs;
        this.destroyAttackBox();
        return;
      }
      this.endAttack();
      return;
    }
    if (this.attackPhase === "startup") {
      this.attackPhase = "active";
      this.attackPhaseUntil = n + this.wep.active[this.attackStep];
      this.spawnAttackBox(this.wep.range[this.attackStep], this.attackStep === 2 ? 36 : 28);
      this.scene.emitSlash(this.x, this.y + 2, this.facing);
      return;
    }
    if (this.attackPhase === "active") {
      this.attackPhase = "recover";
      this.attackPhaseUntil = n + this.wep.recover[this.attackStep];
      this.destroyAttackBox();
      return;
    }
    if (this.attackPhase === "recover") {
      if (this.queuedAttack && this.attackStep < 2 && this.attackKind === "light") {
        this.beginAttack(this.attackStep + 1);
        return;
      }
      this.endAttack();
    }
  }
}
