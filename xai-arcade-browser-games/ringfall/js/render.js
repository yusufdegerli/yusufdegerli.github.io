import { COLORS, STATE, cameraOffset } from "./engine.js";

function drawGrid(ctx, player, view) {
  const cell = 64;
  const left = player.x - view.width / 2 - cell;
  const right = player.x + view.width / 2 + cell;
  const top = player.y - view.height / 2 - cell;
  const bottom = player.y + view.height / 2 + cell;
  const x0 = Math.floor(left / cell) * cell;
  const y0 = Math.floor(top / cell) * cell;

  ctx.fillStyle = "rgba(198, 220, 242, 0.075)";
  for (let x = x0; x < right; x += cell) {
    for (let y = y0; y < bottom; y += cell) {
      const col = Math.floor(x / cell);
      const row = Math.floor(y / cell);
      if (((col + row) & 1) === 0) ctx.fillRect(x, y, cell, cell);
    }
  }

  ctx.beginPath();
  ctx.strokeStyle = "rgba(226, 236, 246, 0.32)";
  ctx.lineWidth = 1.25;
  for (let x = x0; x <= right; x += cell) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  for (let y = y0; y <= bottom; y += cell) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();

  const dist = Math.hypot(player.x, player.y);
  const reach = Math.hypot(view.width, view.height);
  const start = Math.max(160, Math.floor((dist - reach) / 160) * 160);
  const end = dist + reach;
  ctx.strokeStyle = "rgba(120, 176, 230, 0.16)";
  ctx.lineWidth = 2;
  for (let radius = start; radius <= end && radius < 5000; radius += 160) {
    if (radius <= 0) continue;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGem(ctx, gem) {
  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = COLORS.gem;
  ctx.fillRect(-gem.size / 2, -gem.size / 2, gem.size, gem.size);
  ctx.strokeStyle = "rgba(8, 20, 12, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-gem.size / 2, -gem.size / 2, gem.size, gem.size);
  ctx.restore();
}

function drawEnemy(ctx, enemy) {
  const pop = Math.min(1, enemy.age / 0.12);
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.scale(pop, pop);
  ctx.fillStyle = enemy.kind === "fast" ? COLORS.fast : COLORS.basic;
  ctx.fillRect(-enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.strokeRect(-enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size);
  if (enemy.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${enemy.flash / 0.09 * 0.7})`;
    ctx.fillRect(-enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size);
  }
  ctx.restore();

  const ratio = Math.max(0, enemy.hp / enemy.maxHp);
  const barW = enemy.size;
  const barH = 3;
  const bx = enemy.x - barW / 2;
  const by = enemy.y - enemy.size / 2 - 7;
  ctx.fillStyle = "#1a1d24";
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = enemy.kind === "fast" ? COLORS.fast : COLORS.basic;
  ctx.fillRect(bx, by, barW * ratio, barH);
}

function drawBlade(ctx, x, y, angle, inner, outer, width, color) {
  ctx.strokeStyle = color || COLORS.melee;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
  ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
  ctx.stroke();
}

function drawIdleBlades(ctx, game) {
  const idle = game.player.weapons.filter((weapon) => weapon.kind === "melee" && !weapon.swing);
  if (!idle.length) return;
  const player = game.player;
  const target = game.closestEnemy(player.x, player.y);
  const aim = target
    ? Math.atan2(target.y - player.y, target.x - player.x)
    : player.facing;
  idle.forEach((weapon, index) => {
    const spread = (index - (idle.length - 1) / 2) * 0.22;
    const outer = player.radius + Math.max(12, Math.min(34, weapon.range * 0.34));
    drawBlade(
      ctx,
      player.x,
      player.y,
      aim + spread,
      player.radius + 3,
      outer,
      4,
      weapon.color,
    );
  });
}

function drawSwing(ctx, player, weapon) {
  const swing = weapon.swing;
  const angle = swing.angle;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = weapon.color || COLORS.melee;
  ctx.lineWidth = Math.max(10, Math.min(22, weapon.range * 0.16));
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(player.x, player.y, weapon.range * 0.72, swing.from, angle);
  ctx.stroke();
  ctx.restore();
  drawBlade(
    ctx,
    player.x,
    player.y,
    angle,
    player.radius + 2,
    weapon.range,
    6,
    weapon.color,
  );
}

function drawRangedAim(ctx, player) {
  const ranged = player.weapons.filter((weapon) => weapon.kind === "ranged");
  ranged.forEach((weapon, index) => {
    const offset = (index - (ranged.length - 1) / 2) * 5;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(weapon.aim);
    ctx.fillStyle = weapon.color || COLORS.bullet;
    ctx.fillRect(4, -3 + offset, 16, 6);
    ctx.restore();
  });
}

function drawProjectile(ctx, shot) {
  const color = shot.color || COLORS.bullet;
  const angle = Math.atan2(shot.vy, shot.vx);
  if (shot.style === "line" || shot.style === "rocket") {
    ctx.save();
    ctx.translate(shot.x, shot.y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    if (shot.style === "line") {
      ctx.fillRect(-16, -1.5, 20, 3);
    } else {
      ctx.fillRect(-8, -3.5, 16, 7);
      ctx.fillStyle = "#ffd27a";
      ctx.fillRect(-13, -2, 6, 4);
    }
    ctx.restore();
    return;
  }

  for (let i = 0; i < shot.trail.length; i += 1) {
    const point = shot.trail[i];
    const t = (i + 1) / (shot.trail.length + 1);
    ctx.beginPath();
    ctx.globalAlpha = 0.35 * t;
    ctx.fillStyle = color;
    ctx.arc(point.x, point.y, shot.radius * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#fff6c2";
  ctx.arc(shot.x, shot.y, shot.radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawExplosion(ctx, boom) {
  const t = Math.max(0, Math.min(1, boom.age / boom.duration));
  const radius = boom.radius * (0.4 + 0.6 * t);
  ctx.beginPath();
  ctx.fillStyle = `rgba(255, 120, 70, ${0.38 * (1 - t)})`;
  ctx.arc(boom.x, boom.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.strokeStyle = `rgba(255, 220, 150, ${0.85 * (1 - t)})`;
  ctx.lineWidth = 3;
  ctx.arc(boom.x, boom.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPlayer(ctx, player, now) {
  ctx.beginPath();
  ctx.ellipse(
    player.x,
    player.y + player.radius * 0.2,
    player.radius * 0.95,
    player.radius * 0.42,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fill();

  const blinking = player.invuln > 0 && Math.floor(player.invuln * 18) % 2 === 0;
  ctx.save();
  if (blinking) ctx.globalAlpha = 0.4;
  const pulse = 1 + Math.sin(now / 260) * 0.025;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius * pulse, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.player;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = blinking ? "#ffffff" : "#e7f0ff";
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "#9cc4ff";
  ctx.lineWidth = 3;
  ctx.arc(
    player.x,
    player.y,
    player.radius - 5,
    player.facing - 0.55,
    player.facing + 0.55,
  );
  ctx.stroke();
  ctx.restore();
}

function drawPlayerHealth(ctx, player) {
  const barW = 48;
  const barH = 6;
  const x = player.x - barW / 2;
  const y = player.y + player.radius + 10;
  const ratio = Math.max(0, Math.min(1, player.health / player.maxHealth));
  ctx.fillStyle = "#3a1d22";
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = ratio <= 0.3 ? "#ff5a5a" : "#46d37a";
  ctx.fillRect(x, y, barW * ratio, barH);
  ctx.strokeStyle = "#0b0d12";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, barW - 1, barH - 1);
}

function drawFloaters(ctx, floaters) {
  ctx.font = "700 14px Trebuchet MS, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const floater of floaters) {
    ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.globalAlpha = 1;
}

export function draw(ctx, game, dpr, now) {
  const { width, height } = game.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#243044";
  ctx.fillRect(0, 0, width, height);

  const cam = cameraOffset(game.player, game.view);
  const mag = game.shake;
  const shakeX = mag > 0 ? (Math.random() - 0.5) * mag * 2 : 0;
  const shakeY = mag > 0 ? (Math.random() - 0.5) * mag * 2 : 0;

  ctx.save();
  ctx.translate(cam.x + shakeX, cam.y + shakeY);
  drawGrid(ctx, game.player, game.view);

  if (game.state === STATE.PLAYING) {
    ctx.beginPath();
    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(61, 220, 120, 0.2)";
    ctx.arc(game.player.x, game.player.y, game.player.collectionRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const gem of game.gems) drawGem(ctx, gem);

  for (const particle of game.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      particle.x - particle.size / 2,
      particle.y - particle.size / 2,
      particle.size,
      particle.size,
    );
  }
  ctx.globalAlpha = 1;

  for (const enemy of game.enemies) drawEnemy(ctx, enemy);

  drawIdleBlades(ctx, game);
  for (const weapon of game.player.weapons) {
    if (weapon.kind === "melee" && weapon.swing) drawSwing(ctx, game.player, weapon);
  }

  for (const shot of game.projectiles) drawProjectile(ctx, shot);
  for (const boom of game.explosions) drawExplosion(ctx, boom);
  drawPlayer(ctx, game.player, now);
  drawRangedAim(ctx, game.player);
  if (game.state !== STATE.START) drawPlayerHealth(ctx, game.player);
  drawFloaters(ctx, game.floaters);
  ctx.restore();

  if (game.hurtFlash > 0 && game.state === STATE.PLAYING) {
    ctx.fillStyle = `rgba(180, 24, 32, ${0.22 * game.hurtFlash})`;
    ctx.fillRect(0, 0, width, height);
  }
}
