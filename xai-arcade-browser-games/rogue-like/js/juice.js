export function juiceAttack(scene, sprite, facing) {
  if (!sprite.active) return;
  scene.tweens.killTweensOf(sprite);
  const sx = sprite.scaleX;
  const sy = sprite.scaleY;
  sprite.x += facing * 8;
  scene.tweens.add({
    targets: sprite,
    scaleX: sx * 1.18,
    scaleY: sy * 0.86,
    duration: 70,
    yoyo: true,
    onComplete: () => {
      if (sprite.active) sprite.setScale(sx, sy);
    },
  });
}

export function juiceHurt(scene, sprite) {
  if (!sprite.active) return;
  scene.tweens.killTweensOf(sprite);
  const sx = Math.abs(sprite.scaleX) || 1;
  const sy = sprite.scaleY || 1;
  scene.tweens.add({
    targets: sprite,
    angle: { from: -12, to: 10 },
    duration: 70,
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      if (sprite.active) {
        sprite.setAngle(0);
        sprite.setScale(Math.sign(sprite.scaleX || 1) * sx, sy);
      }
    },
  });
}

export function juiceDash(scene, sprite, facing) {
  if (!sprite.active) return;
  scene.tweens.killTweensOf(sprite);
  const sx = sprite.scaleX;
  const sy = sprite.scaleY;
  scene.tweens.add({
    targets: sprite,
    scaleX: sx * 1.35,
    scaleY: sy * 0.72,
    duration: 90,
    yoyo: true,
    onComplete: () => {
      if (sprite.active) sprite.setScale(sx, sy);
    },
  });
  for (let i = 1; i <= 3; i++) {
    const ghost = scene.add.image(sprite.x - facing * i * 16, sprite.y, sprite.texture.key);
    ghost.setDisplaySize(sprite.displayWidth, sprite.displayHeight);
    ghost.setFlipX(sprite.flipX);
    ghost.setAlpha(0.35);
    ghost.setTint(0x88d0e8);
    ghost.setDepth((sprite.depth || 10) - 1);
    scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 140 + i * 40,
      onComplete: () => ghost.destroy(),
    });
  }
}

export function juiceDie(scene, sprite, onDone) {
  if (!sprite.active) {
    onDone?.();
    return;
  }
  scene.tweens.killTweensOf(sprite);
  scene.tweens.add({
    targets: sprite,
    angle: 80,
    scaleY: 0.15,
    alpha: 0,
    y: sprite.y + 18,
    duration: 380,
    ease: "Quad.easeIn",
    onComplete: () => onDone?.(),
  });
}
