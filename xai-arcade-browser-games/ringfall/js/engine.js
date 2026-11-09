/**
 * Ringfall simulation. No DOM and no rendering — main.js drives it.
 * States: start, playing, shop, gameover.
 */

export const STATE = {
  START: "start",
  PLAYING: "playing",
  SHOP: "shop",
  GAME_OVER: "gameover",
};

export const COLORS = Object.freeze({
  player: "#2f7bff",
  melee: "#b7c0cc",
  bullet: "#ffe14a",
  basic: "#e53935",
  fast: "#ff8c1a",
  gem: "#3ddc78",
});

export const WAVE_DURATION = 30;
export const MAX_WEAPONS = 6;
export const INVULN_TIME = 0.5;

export function xpRequired(level) {
  return 6 + Math.max(1, level) * 4;
}

export function shopPrice(base, wave) {
  return base + Math.max(0, wave - 1) * 3;
}

export function spawnInterval(wave) {
  return Math.max(0.24, 0.88 - (wave - 1) * 0.07);
}

export function spawnsPerTick(wave) {
  return 1 + Math.floor((wave - 1) / 2);
}

export function fastChance(wave) {
  return Math.min(0.55, 0.18 + (wave - 1) * 0.07);
}

export function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  const whole = safe <= 0 ? 0 : Math.ceil(safe - 1e-9);
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function cameraOffset(player, view) {
  return {
    x: view.width / 2 - player.x,
    y: view.height / 2 - player.y,
  };
}

export function circleHitsAabb(cx, cy, radius, box) {
  const left = box.x - box.size / 2;
  const top = box.y - box.size / 2;
  const closestX = Math.max(left, Math.min(cx, left + box.size));
  const closestY = Math.max(top, Math.min(cy, top + box.size));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

function normalizeAxis(axis) {
  const x = axis && Number.isFinite(axis.x) ? axis.x : 0;
  const y = axis && Number.isFinite(axis.y) ? axis.y : 0;
  const mag = Math.hypot(x, y);
  if (mag > 1) return { x: x / mag, y: y / mag };
  return { x, y };
}

export class Player {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.radius = 16;
    this.maxHealth = 100;
    this.health = 100;
    this.speed = 235;
    this.damageMultiplier = 1;
    this.collectionRadius = 120;
    this.attackSpeed = 0;
    this.regen = 0;
    this.regenTimer = 0;
    this.lifeSteal = 0;
    this.armor = 0;
    this.waveHeal = 0.2;
    this.invuln = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpRequired(1);
    this.currency = 0;
    this.weapons = [];
    this.facing = 0;
  }

  addWeapon(weapon) {
    if (this.weapons.length >= MAX_WEAPONS) return false;
    weapon.readyIn = weapon.cooldownFor(this);
    weapon.timer = Math.min(weapon.readyIn, this.weapons.length * 0.07);
    this.weapons.push(weapon);
    return true;
  }

  attackFactor() {
    return Math.max(0.4, 1 + this.attackSpeed / 100);
  }

  cooldownFor(base) {
    return base / this.attackFactor();
  }
}

export class Weapon {
  constructor({ id, name, kind, cooldown, baseDamage, color }) {
    this.id = id;
    this.name = name;
    this.kind = kind;
    this.cooldown = cooldown;
    this.baseDamage = baseDamage;
    this.color = color;
    this.timer = 0;
    this.readyIn = cooldown;
    this.aim = 0;
  }

  damageFor(player) {
    return Math.max(1, Math.round(this.baseDamage * player.damageMultiplier));
  }

  cooldownFor(player) {
    return player.cooldownFor(this.cooldown);
  }

  update() {}
}

export class MeleeWeapon extends Weapon {
  constructor(config) {
    super(config);
    this.range = config.range;
    this.arc = config.arc;
    this.swingDuration = config.swingDuration;
    this.knockback = config.knockback || 0;
    this.swing = null;
  }

  update(dt, game) {
    if (this.swing) {
      const swing = this.swing;
      swing.age += dt;
      const t = Math.min(1, swing.age / swing.duration);
      swing.prev = swing.angle;
      swing.angle = swing.from + (swing.to - swing.from) * t;
      this.applyHits(game);
      if (t >= 1) {
        this.swing = null;
        const cd = this.cooldownFor(game.player);
        this.timer = cd;
        this.readyIn = cd;
      }
      return;
    }

    this.timer -= dt;
    if (this.timer > 0) return;

    const target = game.closestEnemy(game.player.x, game.player.y);
    if (!target) {
      this.timer = 0;
      return;
    }
    this.aim = Math.atan2(target.y - game.player.y, target.x - game.player.x);

    const dx = target.x - game.player.x;
    const dy = target.y - game.player.y;
    const reach = this.range + target.size * 0.5 * Math.SQRT2;
    if (Math.hypot(dx, dy) > reach) {
      this.timer = 0;
      return;
    }

    const half = this.arc / 2;
    const from = this.aim - half;
    this.swing = {
      from,
      to: this.aim + half,
      prev: from,
      angle: from,
      age: 0,
      duration: game.player.cooldownFor(this.swingDuration),
      hits: new Set(),
    };
  }

  applyHits(game) {
    const swing = this.swing;
    const player = game.player;
    const damage = this.damageFor(player);
    for (const enemy of game.enemies) {
      if (!enemy.alive || swing.hits.has(enemy)) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy);
      const reach = this.range + enemy.size * 0.5 * Math.SQRT2;
      if (dist > reach) continue;

      let angle = Math.atan2(dy, dx);
      while (angle < swing.from) angle += Math.PI * 2;
      while (angle >= swing.from + Math.PI * 2) angle -= Math.PI * 2;
      if (angle < swing.prev - 0.15 || angle > swing.angle + 0.15) continue;
      swing.hits.add(enemy);
      enemy.takeDamage(damage, game);
      if (this.knockback > 0) {
        const away = Math.hypot(dx, dy) || 1;
        enemy.knockVX = (dx / away) * this.knockback;
        enemy.knockVY = (dy / away) * this.knockback;
      }
    }
  }
}

export class Axe extends MeleeWeapon {
  constructor() {
    super({
      id: "axe",
      name: "Axe",
      kind: "melee",
      cooldown: 1.25,
      baseDamage: 40,
      color: "#b7c0cc",
      range: 100,
      arc: Math.PI * 1.7,
      swingDuration: 0.32,
    });
  }
}

export class Bat extends MeleeWeapon {
  constructor() {
    super({
      id: "bat",
      name: "Bat",
      kind: "melee",
      cooldown: 0.7,
      baseDamage: 18,
      color: "#e2b15a",
      range: 88,
      arc: Math.PI * 0.9,
      swingDuration: 0.16,
      knockback: 680,
    });
  }
}

export class Nunchaku extends MeleeWeapon {
  constructor() {
    super({
      id: "nunchaku",
      name: "Nunchaku",
      kind: "melee",
      cooldown: 0.26,
      baseDamage: 7,
      color: "#f4f1ea",
      range: 48,
      arc: Math.PI * 0.55,
      swingDuration: 0.08,
    });
  }
}

export class RangedWeapon extends Weapon {
  constructor(config) {
    super(config);
    this.projectileSpeed = config.projectileSpeed;
    this.target = null;
  }

  trackAim(game) {
    const target = game.closestEnemy(game.player.x, game.player.y);
    this.target = target;
    if (!target) return;
    this.aim = Math.atan2(target.y - game.player.y, target.x - game.player.x);
  }

  update(dt, game) {
    this.trackAim(game);
    this.timer -= dt;
    if (this.timer > 0) return;
    if (!this.target) {
      this.timer = 0;
      return;
    }
    this.fire(game, this.target);
    const cd = this.cooldownFor(game.player);
    this.timer = cd;
    this.readyIn = cd;
  }

  spawnShot(game, angle, options) {
    const player = game.player;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const spawn = player.radius + 10;
    game.projectiles.push(
      new Projectile(
        player.x + nx * spawn,
        player.y + ny * spawn,
        nx * this.projectileSpeed,
        ny * this.projectileSpeed,
        options.damage ?? this.damageFor(player),
        options,
      ),
    );
  }
}

export class Shotgun extends RangedWeapon {
  constructor() {
    super({
      id: "shotgun",
      name: "Shotgun",
      kind: "ranged",
      cooldown: 0.95,
      baseDamage: 7,
      color: "#ff9f43",
      projectileSpeed: 520,
    });
    this.pellets = 5;
    this.spread = 0.5;
  }

  fire(game) {
    const step = this.pellets === 1 ? 0 : this.spread / (this.pellets - 1);
    const start = this.aim - this.spread / 2;
    for (let i = 0; i < this.pellets; i += 1) {
      this.spawnShot(game, start + step * i, {
        color: this.color,
        style: "pellet",
        radius: 3,
        maxRange: 210,
        pierce: 1,
      });
    }
  }
}

export class Bow extends RangedWeapon {
  constructor() {
    super({
      id: "bow",
      name: "Bow",
      kind: "ranged",
      cooldown: 0.68,
      baseDamage: 16,
      color: "#8dffb0",
      projectileSpeed: 980,
    });
  }

  fire(game) {
    this.spawnShot(game, this.aim, {
      color: this.color,
      style: "line",
      pierce: 2,
      radius: 4,
    });
  }
}

export class Bazooka extends RangedWeapon {
  constructor() {
    super({
      id: "bazooka",
      name: "Bazooka",
      kind: "ranged",
      cooldown: 1.45,
      baseDamage: 32,
      color: "#ff5d4a",
      projectileSpeed: 250,
    });
    this.blastRadius = 88;
  }

  fire(game) {
    this.spawnShot(game, this.aim, {
      color: this.color,
      style: "rocket",
      radius: 6,
      pierce: 1,
      maxRange: 460,
      explosion: { radius: this.blastRadius, damage: this.damageFor(game.player) },
      damage: 0,
    });
  }
}

export class Enemy {
  constructor(x, y, stats) {
    this.x = x;
    this.y = y;
    this.kind = stats.kind;
    this.size = stats.size;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.speed = stats.speed;
    this.contactDamage = stats.contactDamage;
    this.alive = true;
    this.age = 0;
    this.flash = 0;
    this.knockVX = 0;
    this.knockVY = 0;
  }

  update(dt, player) {
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt);
    const knock = Math.hypot(this.knockVX, this.knockVY);
    if (knock > 16) {
      this.x += this.knockVX * dt;
      this.y += this.knockVY * dt;
      const decay = Math.exp(-6.5 * dt);
      this.knockVX *= decay;
      this.knockVY *= decay;
      return;
    }
    this.knockVX = 0;
    this.knockVY = 0;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.001) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  takeDamage(amount, game) {
    if (!this.alive) return;
    const dealt = Math.max(1, Math.round(amount));
    this.hp -= dealt;
    this.flash = 0.09;
    game.spawnFloater(this.x, this.y - this.size * 0.65, String(dealt), "#fff4d2");
    if (this.hp <= 0) {
      this.alive = false;
      game.kills += 1;
      game.gems.push(new Gem(this.x, this.y));
      game.burst(this.x, this.y, this.kind === "fast" ? COLORS.fast : COLORS.basic);
      game.onEnemyKilled();
    }
  }
}

function scaledStats(wave) {
  return {
    hp: 1 + (wave - 1) * 0.5,
    speed: 1 + (wave - 1) * 0.045,
    damage: 1 + (wave - 1) * 0.1,
  };
}

export class BasicEnemy extends Enemy {
  constructor(x, y, wave) {
    const scale = scaledStats(wave);
    super(x, y, {
      kind: "basic",
      size: 28,
      maxHp: Math.round(30 * scale.hp),
      speed: 90 * scale.speed,
      contactDamage: Math.max(1, Math.round(12 * scale.damage)),
    });
  }
}

export class FastEnemy extends Enemy {
  constructor(x, y, wave) {
    const scale = scaledStats(wave);
    super(x, y, {
      kind: "fast",
      size: 18,
      maxHp: Math.max(1, Math.round(14 * scale.hp)),
      speed: 170 * scale.speed,
      contactDamage: Math.max(1, Math.round(8 * scale.damage)),
    });
  }
}

export class Projectile {
  constructor(x, y, vx, vy, damage, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.radius = options.radius ?? 4;
    this.alive = true;
    this.trail = [];
    this.pierce = options.pierce ?? 1;
    this.maxRange = options.maxRange ?? Infinity;
    this.traveled = 0;
    this.color = options.color ?? COLORS.bullet;
    this.style = options.style ?? "pellet";
    this.explosion = options.explosion ?? null;
    this.hits = new Set();
  }

  update(dt, game) {
    const step = Math.hypot(this.vx, this.vy) * dt;
    this.traveled += step;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 4) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.traveled >= this.maxRange) {
      this.detonate(game);
      this.alive = false;
      return;
    }

    const halfW = game.view.width / 2 + 110;
    const halfH = game.view.height / 2 + 110;
    if (
      Math.abs(this.x - game.player.x) > halfW ||
      Math.abs(this.y - game.player.y) > halfH
    ) {
      this.detonate(game);
      this.alive = false;
      return;
    }

    for (const enemy of game.enemies) {
      if (!enemy.alive || this.hits.has(enemy)) continue;
      if (!circleHitsAabb(this.x, this.y, this.radius, enemy)) continue;
      this.hits.add(enemy);
      if (this.damage > 0) enemy.takeDamage(this.damage, game);
      this.pierce -= 1;
      if (this.explosion || this.pierce <= 0) {
        this.detonate(game);
        this.alive = false;
        return;
      }
    }
  }

  detonate(game) {
    if (!this.explosion || this.detonated) return;
    this.detonated = true;
    game.explosions.push(
      new Explosion(this.x, this.y, this.explosion.radius, this.explosion.damage),
    );
  }
}

export class Explosion {
  constructor(x, y, radius, damage) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.age = 0;
    this.duration = 0.32;
    this.alive = true;
    this.applied = false;
  }

  update(dt, game) {
    if (!this.applied) {
      this.applied = true;
      for (const enemy of game.enemies) {
        if (!enemy.alive) continue;
        const reach = this.radius + enemy.size * 0.35;
        if (Math.hypot(enemy.x - this.x, enemy.y - this.y) <= reach) {
          enemy.takeDamage(this.damage, game);
        }
      }
    }
    this.age += dt;
    if (this.age >= this.duration) this.alive = false;
  }
}

export class Gem {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 8;
    this.alive = true;
    this.pulling = false;
    this.speed = 90;
  }

  update(dt, game) {
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= player.radius + this.size * 0.5) {
      game.collectGem(this);
      return;
    }
    if (dist <= player.collectionRadius) this.pulling = true;
    if (!this.pulling || dist === 0) return;
    this.speed = Math.min(820, this.speed + 1700 * dt);
    const step = Math.min(dist, this.speed * dt);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
  }
}

export class Floater {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 0.55;
    this.maxLife = 0.55;
  }

  update(dt) {
    this.life -= dt;
    this.y -= 32 * dt;
  }
}

export class Particle {
  constructor(x, y, color) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 140;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 0.28 + Math.random() * 0.12;
    this.maxLife = this.life;
    this.size = 2 + Math.random() * 3;
    this.color = color;
  }

  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}

function pushEnemyOut(enemy, player) {
  let dx = enemy.x - player.x;
  let dy = enemy.y - player.y;
  let dist = Math.hypot(dx, dy);
  if (dist < 0.001) {
    dx = Math.cos(player.facing || 0);
    dy = Math.sin(player.facing || 0);
    dist = 1;
  }
  const needed = player.radius + enemy.size * Math.SQRT2 * 0.5 + 1;
  if (dist < needed) {
    enemy.x = player.x + (dx / dist) * needed;
    enemy.y = player.y + (dy / dist) * needed;
  }
}

export function offerMaxHealth(amount, baseCost, wave) {
  return {
    id: `hp-${amount}`,
    tag: "Stat",
    title: `+${amount} Max Health`,
    detail: `Raises max health by ${amount} and heals ${amount}.`,
    cost: shopPrice(baseCost, wave),
    accent: "#ff5d6c",
    sold: false,
    requiresSlot: false,
    apply(player) {
      player.maxHealth += amount;
      player.health = Math.min(player.maxHealth, player.health + amount);
    },
  };
}

export function offerSpeed(amount, baseCost, wave) {
  return {
    id: `speed-${amount}`,
    tag: "Stat",
    title: `+${amount} Movement Speed`,
    detail: "You cover more of the open field between hits.",
    cost: shopPrice(baseCost, wave),
    accent: "#4aa3ff",
    sold: false,
    requiresSlot: false,
    apply(player) {
      player.speed += amount;
    },
  };
}

export function offerDamage(amount, baseCost, wave) {
  const shown = amount.toFixed(2);
  return {
    id: `dmg-${shown}`,
    tag: "Stat",
    title: `+${shown} Damage Multiplier`,
    detail: "Every weapon hits harder.",
    cost: shopPrice(baseCost, wave),
    accent: "#f0b429",
    sold: false,
    requiresSlot: false,
    apply(player) {
      player.damageMultiplier =
        Math.round((player.damageMultiplier + amount) * 100) / 100;
    },
  };
}

export function offerAttackSpeed(amount, baseCost, wave) {
  return {
    id: `aspd-${amount}`,
    tag: "Stat",
    title: `+${amount} Attack Speed`,
    detail: "Shortens the cooldown of every weapon.",
    cost: shopPrice(baseCost, wave),
    accent: "#9ad7ff",
    sold: false,
    requiresSlot: false,
    apply(player) {
      player.attackSpeed += amount;
    },
  };
}

export function offerRegen(amount, baseCost, wave) {
  return {
    id: `regen-${amount}`,
    tag: "Stat",
    title: `+${amount} Health Regeneration`,
    detail: `Heals ${amount} health every 3 seconds.`,
    cost: shopPrice(baseCost, wave),
    accent: "#46d37a",
    sold: false,
    requiresSlot: false,
    apply(player) {
      player.regen += amount;
    },
  };
}

export function offerLifeSteal(amount, baseCost, wave) {
  return {
    id: `steal-${amount}`,
    tag: "Stat",
    title: `+${amount}% Life Steal`,
    detail: `${amount}% chance to heal 1 health when an enemy dies.`,
    cost: shopPrice(baseCost, wave),
    accent: "#ff6b9a",
    sold: false,
    requiresSlot: false,
    apply(player) {
      player.lifeSteal = Math.min(100, player.lifeSteal + amount);
    },
  };
}

export function offerArmor(amount, baseCost, wave) {
  return {
    id: `armor-${amount}`,
    tag: "Stat",
    title: `+${amount} Armor`,
    detail: `Enemy hits deal ${amount} less damage. A hit still deals at least 1.`,
    cost: shopPrice(baseCost, wave),
    accent: "#c5d0dc",
    sold: false,
    requiresSlot: false,
    apply(player) {
      player.armor += amount;
    },
  };
}

export function offerBread(wave) {
  return {
    id: "bread",
    tag: "Tradeoff",
    title: "Bread",
    detail: "Max Health +3. Attack Speed −5.",
    cost: shopPrice(8, wave),
    accent: "#e2b15a",
    sold: false,
    requiresSlot: false,
    tradeoff: true,
    apply(player) {
      player.maxHealth += 3;
      player.health = Math.min(player.maxHealth, player.health + 3);
      player.attackSpeed -= 5;
    },
  };
}

export function offerIronPlate(wave) {
  return {
    id: "iron-plate",
    tag: "Tradeoff",
    title: "Iron Plate",
    detail: "Armor +4. Movement Speed −30.",
    cost: shopPrice(12, wave),
    accent: "#9aa8ba",
    sold: false,
    requiresSlot: false,
    tradeoff: true,
    apply(player) {
      player.armor += 4;
      player.speed = Math.max(90, player.speed - 30);
    },
  };
}

export function offerAdrenaline(wave) {
  return {
    id: "adrenaline",
    tag: "Tradeoff",
    title: "Adrenaline",
    detail: "Attack Speed +25. Armor −2.",
    cost: shopPrice(14, wave),
    accent: "#ff7a59",
    sold: false,
    requiresSlot: false,
    tradeoff: true,
    apply(player) {
      player.attackSpeed += 25;
      player.armor = Math.max(0, player.armor - 2);
    },
  };
}

export function offerVampireFang(wave) {
  return {
    id: "vampire-fang",
    tag: "Tradeoff",
    title: "Vampire Fang",
    detail: "Life Steal +15%. Max Health −20.",
    cost: shopPrice(14, wave),
    accent: "#d46bff",
    sold: false,
    requiresSlot: false,
    tradeoff: true,
    apply(player) {
      player.lifeSteal = Math.min(100, player.lifeSteal + 15);
      const loss = Math.min(20, Math.max(0, player.maxHealth - 50));
      player.maxHealth -= loss;
      player.health = Math.min(player.health, player.maxHealth);
    },
  };
}

const WEAPON_CATALOG = [
  {
    id: "axe",
    title: "Axe",
    detail: "High damage, slow swings, and a very wide arc.",
    cost: 22,
    accent: "#b7c0cc",
    create: () => new Axe(),
  },
  {
    id: "bat",
    title: "Bat",
    detail: "Medium damage. Hits knock enemies backward.",
    cost: 22,
    accent: "#e2b15a",
    create: () => new Bat(),
  },
  {
    id: "nunchaku",
    title: "Nunchaku",
    detail: "Very fast, low damage, and a very short reach.",
    cost: 20,
    accent: "#f4f1ea",
    create: () => new Nunchaku(),
  },
  {
    id: "shotgun",
    title: "Shotgun",
    detail: "Fires 5 pellets in a short cone.",
    cost: 24,
    accent: "#ff9f43",
    create: () => new Shotgun(),
  },
  {
    id: "bow",
    title: "Bow",
    detail: "A fast arrow that pierces into a second enemy.",
    cost: 24,
    accent: "#8dffb0",
    create: () => new Bow(),
  },
  {
    id: "bazooka",
    title: "Bazooka",
    detail: "A slow rocket. The blast damages every enemy in the circle.",
    cost: 26,
    accent: "#ff5d4a",
    create: () => new Bazooka(),
  },
];

export function offerWeapon(id, wave) {
  const spec = WEAPON_CATALOG.find((entry) => entry.id === id);
  return {
    id: spec.id,
    tag: "Weapon",
    title: spec.title,
    detail: spec.detail,
    cost: shopPrice(spec.cost, wave),
    accent: spec.accent,
    sold: false,
    requiresSlot: true,
    apply(player) {
      player.addWeapon(spec.create());
    },
  };
}

export function offerRadius(amount, baseCost, wave) {
  return {
    id: `radius-${amount}`,
    tag: "Stat",
    title: `+${amount} Collection Radius`,
    detail: "Gems start flying toward you from farther away.",
    cost: shopPrice(baseCost, wave),
    accent: "#3ddc78",
    sold: false,
    requiresSlot: false,
    apply(player) {
      player.collectionRadius += amount;
    },
  };
}

export function createOffers(player, wave, rng = Math.random) {
  const owned = new Set(player.weapons.map((weapon) => weapon.id));
  let weaponOffers = WEAPON_CATALOG.filter((spec) => !owned.has(spec.id)).map((spec) =>
    offerWeapon(spec.id, wave),
  );
  if (player.weapons.length >= MAX_WEAPONS) weaponOffers = [];
  else if (weaponOffers.length === 0) {
    weaponOffers = WEAPON_CATALOG.map((spec) => offerWeapon(spec.id, wave));
  }

  const tradeoffs = [
    offerBread(wave),
    offerIronPlate(wave),
    offerAdrenaline(wave),
    offerVampireFang(wave),
  ];
  const stats = [
    offerMaxHealth(25, 10, wave),
    offerMaxHealth(50, 18, wave),
    offerSpeed(34, 12, wave),
    offerDamage(0.25, 16, wave),
    offerRadius(45, 9, wave),
    offerAttackSpeed(20, 14, wave),
    offerRegen(2, 12, wave),
    offerLifeSteal(12, 14, wave),
    offerArmor(3, 13, wave),
  ];

  shuffle(tradeoffs, rng);
  shuffle(weaponOffers, rng);
  shuffle(stats, rng);

  const picked = [];
  const used = new Set();
  const take = (offer) => {
    if (!offer || used.has(offer.id) || picked.length >= 4) return;
    used.add(offer.id);
    picked.push(offer);
  };

  take(tradeoffs[0]);
  if (player.weapons.length < MAX_WEAPONS) take(weaponOffers[0]);
  const rest = weaponOffers.slice(1).concat(tradeoffs.slice(1), stats);
  shuffle(rest, rng);
  for (const offer of rest) take(offer);
  return shuffle(picked, rng);
}

export class Game {
  constructor() {
    this.view = { width: 1280, height: 720 };
    this.shopRevision = 0;
    this.newRun();
  }

  setView(width, height) {
    this.view.width = Math.max(1, width);
    this.view.height = Math.max(1, height);
  }

  newRun() {
    this._create();
    this.state = STATE.START;
  }

  startRun() {
    this._create();
    this.wave = 1;
    this.timeLeft = WAVE_DURATION;
    this.spawnTimer = 0.25;
    this.state = STATE.PLAYING;
    this.applyWaveHeal();
    this.banner(`WAVE ${this.wave}`, "#f7f1df");
  }

  _create() {
    this.player = new Player();
    this.player.addWeapon(new Axe());
    this.player.addWeapon(new Bow());
    this.enemies = [];
    this.projectiles = [];
    this.explosions = [];
    this.gems = [];
    this.particles = [];
    this.floaters = [];
    this.wave = 1;
    this.timeLeft = WAVE_DURATION;
    this.spawnTimer = 0.25;
    this.kills = 0;
    this.offers = [];
    this.shake = 0;
    this.hurtFlash = 0;
    this.bannerText = "";
    this.bannerTime = 0;
    this.bannerColor = "#f7f1df";
    this.state = STATE.START;
  }

  update(dt, axis = { x: 0, y: 0 }) {
    if (this.state !== STATE.PLAYING) return;
    const step = Math.max(0, Math.min(dt, 0.05));
    if (step === 0) return;
    this.updatePlaying(step, normalizeAxis(axis));
  }

  updatePlaying(dt, axis) {
    const player = this.player;
    player.invuln = Math.max(0, player.invuln - dt);

    if (axis.x !== 0 || axis.y !== 0) {
      player.facing = Math.atan2(axis.y, axis.x);
      player.x += axis.x * player.speed * dt;
      player.y += axis.y * player.speed * dt;
    }

    for (const weapon of player.weapons) weapon.update(dt, this);
    for (const projectile of this.projectiles) projectile.update(dt, this);
    for (const explosion of this.explosions) explosion.update(dt, this);
    for (const enemy of this.enemies) {
      if (enemy.alive) enemy.update(dt, player);
    }
    this.separateEnemies();
    this.resolveContact();
    for (const gem of this.gems) {
      if (gem.alive) gem.update(dt, this);
    }
    this.tickRegen(dt);

    this.projectiles = this.projectiles.filter((shot) => shot.alive);
    this.explosions = this.explosions.filter((boom) => boom.alive);
    this.enemies = this.enemies.filter((enemy) => enemy.alive);
    this.gems = this.gems.filter((gem) => gem.alive);
    this.updateJuice(dt);

    if (player.health <= 0) {
      this.enterGameOver();
      return;
    }

    this.timeLeft -= dt;
    this.updateSpawns(dt);
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.enterShop();
    }
  }

  updateSpawns(dt) {
    this.spawnTimer -= dt;
    const interval = spawnInterval(this.wave);
    const cap = 22 + this.wave * 9;
    let guard = 0;
    while (this.spawnTimer <= 0 && guard < 8) {
      guard += 1;
      this.spawnTimer += interval;
      if (this.enemies.length >= cap) continue;
      const count = spawnsPerTick(this.wave);
      for (let i = 0; i < count && this.enemies.length < cap; i += 1) {
        this.spawnEnemy();
      }
    }
  }

  separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        if (!b.alive) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const minDist = (a.size + b.size) * 0.46;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 0.001) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const push = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  resolveContact() {
    const player = this.player;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (!circleHitsAabb(player.x, player.y, player.radius, enemy)) continue;
      if (player.invuln <= 0 && player.health > 0) {
        const taken = Math.max(1, enemy.contactDamage - player.armor);
        player.health = Math.max(0, player.health - taken);
        player.invuln = INVULN_TIME;
        this.shake = 8;
        this.hurtFlash = 1;
        this.spawnFloater(
          player.x,
          player.y - player.radius - 8,
          `-${taken}`,
          "#ff8d8d",
        );
      }
      pushEnemyOut(enemy, player);
      if (player.health <= 0) break;
    }
  }

  randomEdgePoint(rng) {
    const w = this.view.width;
    const h = this.view.height;
    const side = Math.floor(rng() * 4);
    const along = rng();
    const depth = 28 + rng() * 56;
    const px = this.player.x;
    const py = this.player.y;
    if (side === 0) {
      return { x: px + (along - 0.5) * w, y: py - h / 2 - depth };
    }
    if (side === 1) {
      return { x: px + w / 2 + depth, y: py + (along - 0.5) * h };
    }
    if (side === 2) {
      return { x: px + (along - 0.5) * w, y: py + h / 2 + depth };
    }
    return { x: px - w / 2 - depth, y: py + (along - 0.5) * h };
  }

  spawnEnemy(rng = Math.random) {
    const point = this.randomEdgePoint(rng);
    const enemy =
      rng() < fastChance(this.wave)
        ? new FastEnemy(point.x, point.y, this.wave)
        : new BasicEnemy(point.x, point.y, this.wave);
    this.enemies.push(enemy);
    return enemy;
  }

  spawnOne(kind, x, y) {
    const enemy =
      kind === "fast"
        ? new FastEnemy(x, y, this.wave)
        : new BasicEnemy(x, y, this.wave);
    this.enemies.push(enemy);
    return enemy;
  }

  closestEnemy(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dist = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    return best;
  }

  collectGem(gem) {
    if (!gem.alive) return;
    gem.alive = false;
    this.player.currency += 1;
    this.grantXp(1);
  }

  grantXp(amount) {
    if (amount <= 0) return;
    const player = this.player;
    player.xp += amount;
    let gained = 0;
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level += 1;
      player.xpToNext = xpRequired(player.level);
      gained += 1;
      const heal = Math.max(1, Math.round(player.maxHealth * 0.2));
      player.health = Math.min(player.maxHealth, player.health + heal);
    }
    if (gained > 0) {
      const text = gained > 1 ? `LEVEL ${player.level}` : "LEVEL UP";
      this.banner(text, "#c6f25a");
      this.spawnFloater(player.x, player.y - 28, text, "#c6f25a");
      this.burst(player.x, player.y, COLORS.gem);
    }
  }

  spawnFloater(x, y, text, color) {
    this.floaters.push(new Floater(x, y, text, color));
    if (this.floaters.length > 36) this.floaters.shift();
  }

  burst(x, y, color) {
    for (let i = 0; i < 7; i += 1) this.particles.push(new Particle(x, y, color));
    if (this.particles.length > 90) {
      this.particles.splice(0, this.particles.length - 90);
    }
  }

  updateJuice(dt) {
    for (const particle of this.particles) particle.update(dt);
    for (const floater of this.floaters) floater.update(dt);
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.floaters = this.floaters.filter((floater) => floater.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.4);
    if (this.bannerTime > 0) this.bannerTime -= dt;
  }

  banner(text, color = "#f7f1df") {
    this.bannerText = text;
    this.bannerTime = 1.35;
    this.bannerColor = color;
  }

  onEnemyKilled() {
    const player = this.player;
    if (player.lifeSteal <= 0 || player.health <= 0) return;
    if (player.health >= player.maxHealth) return;
    if (Math.random() * 100 >= player.lifeSteal) return;
    player.health = Math.min(player.maxHealth, player.health + 1);
    this.spawnFloater(player.x, player.y - player.radius - 14, "+1", "#7dffb3");
  }

  tickRegen(dt) {
    const player = this.player;
    player.regenTimer += dt;
    while (player.regenTimer >= 3) {
      player.regenTimer -= 3;
      if (player.regen <= 0 || player.health <= 0 || player.health >= player.maxHealth) continue;
      const before = player.health;
      player.health = Math.min(player.maxHealth, player.health + player.regen);
      const gained = player.health - before;
      if (gained > 0) {
        this.spawnFloater(
          player.x,
          player.y - player.radius - 16,
          `+${gained}`,
          "#7dffb3",
        );
      }
    }
  }

  applyWaveHeal() {
    const player = this.player;
    if (player.waveHeal <= 0 || player.health <= 0 || player.health >= player.maxHealth) return;
    const amount = Math.max(1, Math.round(player.maxHealth * player.waveHeal));
    const before = player.health;
    player.health = Math.min(player.maxHealth, player.health + amount);
    const gained = player.health - before;
    if (gained > 0) {
      this.spawnFloater(player.x, player.y - player.radius - 18, `+${gained}`, "#9ad7ff");
    }
  }

  enterShop() {
    if (this.state !== STATE.PLAYING) return;
    this.enemies = [];
    this.gems = [];
    this.projectiles = [];
    this.explosions = [];
    this.particles = [];
    this.floaters = [];
    for (const weapon of this.player.weapons) {
      weapon.swing = null;
      weapon.timer = 0;
    }
    this.offers = createOffers(this.player, this.wave);
    this.shopRevision += 1;
    this.timeLeft = 0;
    this.bannerTime = 0;
    this.state = STATE.SHOP;
  }

  enterGameOver() {
    if (this.state !== STATE.PLAYING) return;
    this.player.health = 0;
    this.bannerTime = 0;
    this.state = STATE.GAME_OVER;
  }

  purchase(index) {
    if (this.state !== STATE.SHOP) return { ok: false, reason: "state" };
    const offer = this.offers[index];
    if (!offer) return { ok: false, reason: "invalid" };
    if (offer.sold) return { ok: false, reason: "sold" };
    if (offer.requiresSlot && this.player.weapons.length >= MAX_WEAPONS) {
      return { ok: false, reason: "slots" };
    }
    if (this.player.currency < offer.cost) return { ok: false, reason: "money" };
    this.player.currency -= offer.cost;
    offer.apply(this.player);
    offer.sold = true;
    this.shopRevision += 1;
    return { ok: true };
  }

  nextWave() {
    if (this.state !== STATE.SHOP) return;
    this.wave += 1;
    this.timeLeft = WAVE_DURATION;
    this.spawnTimer = 0.3;
    this.offers = [];
    this.state = STATE.PLAYING;
    this.applyWaveHeal();
    this.banner(`WAVE ${this.wave}`, "#f7f1df");
  }
}
