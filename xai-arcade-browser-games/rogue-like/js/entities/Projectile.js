export class Projectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, { vx, damage, from, tint, life = 1400, w = 16, h = 8 } = {}) {
    super(scene, x, y, texture);
    this.scene = scene;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(11);
    this.body.setAllowGravity(false);
    this.body.setSize(w, h);
    this.setVelocity(vx, 0);
    this.setFlipX(vx < 0);
    if (tint) this.setTint(tint);
    this.damage = damage;
    this.from = from;
    this.aliveBolt = true;
    this.lifeTimer = scene.time.delayedCall(life, () => this.kill());
  }

  kill() {
    if (!this.aliveBolt) return;
    this.aliveBolt = false;
    this.lifeTimer?.remove();
    if (this.body) this.body.enable = false;
    this.destroy();
  }
}
