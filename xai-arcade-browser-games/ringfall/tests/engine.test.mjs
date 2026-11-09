import assert from "node:assert/strict";
import test from "node:test";
import {
  Axe,
  BasicEnemy,
  Bat,
  Bazooka,
  Bow,
  FastEnemy,
  Gem,
  INVULN_TIME,
  MAX_WEAPONS,
  Projectile,
  Shotgun,
  STATE,
  WAVE_DURATION,
  cameraOffset,
  circleHitsAabb,
  createOffers,
  fastChance,
  formatTime,
  Game,
  offerBread,
  offerWeapon,
  Player,
  shopPrice,
  spawnInterval,
  spawnsPerTick,
  xpRequired,
} from "../js/engine.js";

function outsideView(game, enemy) {
  const halfW = game.view.width / 2;
  const halfH = game.view.height / 2;
  return (
    Math.abs(enemy.x - game.player.x) > halfW ||
    Math.abs(enemy.y - game.player.y) > halfH
  );
}

function rngFrom(values) {
  let index = 0;
  return () => values[index++] ?? 0;
}

test("four states, a centered player, and a 30 second wave", () => {
  const game = new Game();
  assert.equal(game.state, STATE.START);
  assert.equal(WAVE_DURATION, 30);
  assert.equal(INVULN_TIME, 0.5);
  assert.equal(formatTime(30), "0:30");
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(9.2), "0:10");

  game.player.x = 150;
  game.player.y = -40;
  game.setView(800, 600);
  const cam = cameraOffset(game.player, game.view);
  assert.equal(cam.x + game.player.x, 400);
  assert.equal(cam.y + game.player.y, 300);

  const startX = game.player.x;
  game.update(1, { x: 1, y: 0 });
  assert.equal(game.player.x, startX);

  game.startRun();
  assert.equal(game.state, STATE.PLAYING);
  assert.equal(game.timeLeft, 30);
  assert.equal(game.player.maxHealth, 100);
  assert.equal(game.player.health, 100);
  assert.equal(game.player.weapons.length, 2);
  assert.ok(game.player.speed > 0);
  assert.ok(game.player.damageMultiplier > 0);
  assert.ok(game.player.collectionRadius > 0);
});

test("WASD movement is normalized and uncapped by walls", () => {
  const game = new Game();
  game.startRun();
  for (let i = 0; i < 60; i += 1) game.update(1 / 60, { x: 1, y: 0 });
  assert.ok(Math.abs(game.player.x - game.player.speed) < 0.02);

  const diagonal = new Game();
  diagonal.startRun();
  for (let i = 0; i < 60; i += 1) diagonal.update(1 / 60, { x: 1, y: 1 });
  const traveled = Math.hypot(diagonal.player.x, diagonal.player.y);
  assert.ok(Math.abs(traveled - diagonal.player.speed) < 0.05);
});

test("enemy types, scaling, and spawns just outside the view", () => {
  const basic = new BasicEnemy(0, 0, 1);
  const fast = new FastEnemy(0, 0, 1);
  assert.equal(basic.kind, "basic");
  assert.equal(fast.kind, "fast");
  assert.ok(fast.speed > basic.speed);
  assert.ok(fast.maxHp < basic.maxHp);
  assert.ok(fast.contactDamage >= 1);
  assert.ok(new BasicEnemy(0, 0, 3).maxHp > basic.maxHp);
  assert.ok(spawnInterval(1) > spawnInterval(4));
  assert.ok(spawnsPerTick(4) > spawnsPerTick(1));
  assert.ok(fastChance(4) > fastChance(1));

  const game = new Game();
  game.startRun();
  game.setView(800, 600);
  game.player.x = 0;
  game.player.y = 0;
  const sides = [
    [0, 0.5, 0, 0.99],
    [0.25, 0.5, 0, 0.99],
    [0.5, 0.5, 0, 0.99],
    [0.75, 0.5, 0, 0.99],
  ];
  for (const values of sides) {
    game.enemies = [];
    const enemy = game.spawnEnemy(rngFrom(values));
    assert.equal(outsideView(game, enemy), true);
  }

  const low = new Game();
  low.startRun();
  const weak = low.spawnOne("basic", 0, 0);
  const high = new Game();
  high.startRun();
  high.wave = 4;
  const tough = high.spawnOne("basic", 0, 0);
  assert.ok(tough.maxHp > weak.maxHp);
});

test("later waves spawn more enemies", () => {
  function aliveAfter(wave) {
    const game = new Game();
    game.startRun();
    game.wave = wave;
    game.player.weapons = [];
    game.player.health = 1e7;
    game.player.maxHealth = 1e7;
    for (let i = 0; i < 180; i += 1) game.update(1 / 60, { x: 0, y: 0 });
    return game.enemies.length;
  }
  assert.ok(aliveAfter(4) > aliveAfter(1));
});

test("weapons fire on their own and still aim while fleeing", () => {
  const game = new Game();
  game.startRun();
  const bow = new Bow();
  bow.cooldown = 10;
  game.player.weapons = [bow];
  game.spawnOne("basic", -400, 0);
  const before = game.player.x;
  game.update(1 / 60, { x: 1, y: 0 });
  assert.ok(game.player.x > before);
  assert.equal(game.projectiles.length, 1);
  assert.ok(game.projectiles[0].vx < 0);
  assert.ok(Math.abs(bow.aim - Math.PI) < 0.2 || Math.abs(bow.aim + Math.PI) < 0.2);

  const idle = new Game();
  idle.startRun();
  idle.player.weapons = [];
  idle.update(0.2, { x: 0, y: 0 });
  assert.equal(idle.projectiles.length, 0);

  const aimed = new Game();
  aimed.startRun();
  const onlyBow = new Bow();
  aimed.player.weapons = [onlyBow];
  aimed.spawnOne("basic", 400, 0);
  aimed.update(1 / 60, { x: 0, y: 0 });
  assert.equal(aimed.projectiles.length, 1);
  assert.ok(aimed.projectiles[0].vx > 0);
  assert.equal(onlyBow.kind, "ranged");
});

test("bullets damage enemies and disappear on hit or off screen", () => {
  const game = new Game();
  game.startRun();
  game.player.weapons = [];
  const enemy = game.spawnOne("basic", 80, 0);
  enemy.hp = 1;
  game.projectiles.push(new Projectile(30, 0, 900, 0, 10));
  let killed = false;
  for (let i = 0; i < 40 && !killed; i += 1) {
    game.update(1 / 60, { x: 0, y: 0 });
    killed = !enemy.alive;
  }
  assert.equal(killed, true);
  assert.equal(game.projectiles.length, 0);
  assert.equal(game.gems.length, 1);
  assert.equal(game.kills, 1);

  const miss = new Game();
  miss.startRun();
  miss.player.weapons = [];
  miss.projectiles.push(
    new Projectile(miss.player.x + miss.view.width, miss.player.y, 0, 0, 5),
  );
  miss.update(1 / 60, { x: 0, y: 0 });
  assert.equal(miss.projectiles.length, 0);
});

test("an axe swing hurts an enemy in range and ignores a distant one", () => {
  const close = new Game();
  close.startRun();
  const axe = new Axe();
  axe.cooldown = 10;
  close.player.weapons = [axe];
  const near = close.spawnOne("basic", 50, 0);
  const nearHp = near.hp;
  for (let i = 0; i < 24; i += 1) close.update(1 / 60, { x: 0, y: 0 });
  assert.ok(near.hp < nearHp);

  const far = new Game();
  far.startRun();
  const idleAxe = new Axe();
  far.player.weapons = [idleAxe];
  const distant = far.spawnOne("basic", 520, 0);
  const farHp = distant.hp;
  for (let i = 0; i < 24; i += 1) far.update(1 / 60, { x: 0, y: 0 });
  assert.equal(distant.hp, farHp);
});

test("enemy contact hurts once per invincibility window", () => {
  const game = new Game();
  game.startRun();
  game.player.weapons = [];
  game.player.health = 80;
  const enemy = game.spawnOne("basic", 0, 0);
  game.update(1 / 60, { x: 0, y: 0 });
  assert.equal(game.player.health, 80 - enemy.contactDamage);
  assert.equal(game.player.invuln, INVULN_TIME);

  const mid = game.player.health;
  for (let i = 0; i < 20; i += 1) {
    enemy.x = game.player.x;
    enemy.y = game.player.y;
    enemy.alive = true;
    game.update(1 / 60, { x: 0, y: 0 });
  }
  assert.equal(game.player.health, mid);

  for (let i = 0; i < 24; i += 1) {
    enemy.x = game.player.x;
    enemy.y = game.player.y;
    enemy.alive = true;
    game.update(1 / 60, { x: 0, y: 0 });
  }
  assert.ok(game.player.health < mid);
});

test("square and circle collisions meet at the edge", () => {
  const box = { x: 0, y: 0, size: 20 };
  assert.equal(circleHitsAabb(0, 0, 4, box), true);
  assert.equal(circleHitsAabb(100, 0, 4, box), false);
  assert.equal(circleHitsAabb(14, 0, 4, box), true);
  assert.equal(circleHitsAabb(15, 0, 4, box), false);
  assert.equal(circleHitsAabb(14, 14, 4, box), false);
  assert.equal(circleHitsAabb(12, 12, 4, box), true);
});

test("gems wait, then fly in for currency and a level up", () => {
  const idle = new Game();
  idle.startRun();
  idle.player.weapons = [];
  const parked = new Gem(0, 500);
  idle.gems.push(parked);
  idle.update(0.5, { x: 0, y: 0 });
  assert.equal(parked.y, 500);
  assert.equal(idle.player.currency, 0);
  assert.equal(idle.gems.length, 1);

  const game = new Game();
  game.startRun();
  game.player.weapons = [];
  game.gems.push(new Gem(0, 80));
  let guard = 0;
  while (game.gems.length > 0 && guard < 180) {
    game.update(1 / 60, { x: 0, y: 0 });
    guard += 1;
  }
  assert.equal(game.gems.length, 0);
  assert.equal(game.player.currency, 1);
  assert.equal(game.player.xp, 1);
  assert.equal(game.player.level, 1);

  game.player.health = 40;
  game.player.xpToNext = 1;
  game.gems.push(new Gem(game.player.x, game.player.y));
  game.update(1 / 60, { x: 0, y: 0 });
  assert.equal(game.player.level, 2);
  assert.ok(game.player.health > 40);
  assert.ok(game.player.health <= game.player.maxHealth);
  assert.equal(game.player.currency, 2);
  assert.ok(game.player.xp < game.player.xpToNext);

  game.player.health = game.player.maxHealth;
  game.grantXp(100);
  assert.ok(game.player.level > 2);
  assert.equal(game.player.health, game.player.maxHealth);
  assert.equal(xpRequired(1) > 0, true);
});

test("the wave timer opens the shop and clears the field", () => {
  const game = new Game();
  game.startRun();
  game.player.weapons = [];
  game.spawnOne("basic", 240, 0);
  game.gems.push(new Gem(4000, 4000));
  game.projectiles.push(new Projectile(30, 0, 0, 0, 5));
  game.timeLeft = 0.01;
  game.update(1 / 60, { x: 0, y: 0 });
  assert.equal(game.state, STATE.SHOP);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.gems.length, 0);
  assert.equal(game.projectiles.length, 0);
  assert.equal(game.offers.length, 4);
  assert.equal(game.wave, 1);

  const frozen = game.player.x;
  game.update(1, { x: 1, y: 0 });
  assert.equal(game.player.x, frozen);
  assert.equal(game.state, STATE.SHOP);

  game.nextWave();
  assert.equal(game.state, STATE.PLAYING);
  assert.equal(game.wave, 2);
  assert.equal(game.timeLeft, WAVE_DURATION);
});

test("death beats a wave ending on the same moment", () => {
  const game = new Game();
  game.startRun();
  game.player.weapons = [];
  game.player.health = 1;
  game.timeLeft = 0.01;
  game.spawnOne("basic", 0, 0);
  game.update(1 / 60, { x: 0, y: 0 });
  assert.equal(game.state, STATE.GAME_OVER);
  assert.equal(game.player.health, 0);
  assert.ok(game.enemies.length >= 1);
});

test("the shop sells four choices, respects currency, and caps weapons at six", () => {
  const player = new Player();
  player.addWeapon(new Axe());
  for (let i = 0; i < 12; i += 1) {
    const offers = createOffers(player, 1, Math.random);
    assert.equal(offers.length, 4);
    assert.equal(new Set(offers.map((offer) => offer.id)).size, 4);
    assert.equal(offers.some((offer) => offer.requiresSlot), true);
    assert.equal(offers.some((offer) => offer.tag === "Tradeoff"), true);
  }

  const full = new Player();
  for (let i = 0; i < 8; i += 1) full.addWeapon(new Axe());
  assert.equal(full.weapons.length, MAX_WEAPONS);
  const locked = createOffers(full, 2, Math.random);
  assert.equal(locked.length, 4);
  assert.equal(locked.every((offer) => !offer.requiresSlot), true);
  assert.equal(locked.some((offer) => offer.tag === "Tradeoff"), true);
  assert.equal(shopPrice(22, 1), 22);
  assert.equal(shopPrice(22, 3), 28);

  const game = new Game();
  game.startRun();
  game.state = STATE.SHOP;
  game.player.currency = 0;
  const axeOffer = offerWeapon("axe", 1);
  game.offers = [axeOffer];
  assert.equal(game.purchase(0).ok, false);
  assert.equal(game.player.weapons.length, 2);
  assert.equal(game.player.currency, 0);

  game.player.currency = 100;
  assert.equal(game.purchase(0).ok, true);
  assert.equal(game.player.weapons.length, 3);
  assert.equal(game.player.currency, 100 - axeOffer.cost);
  assert.equal(game.offers[0].sold, true);
  assert.equal(game.purchase(0).reason, "sold");

  while (game.player.weapons.length < MAX_WEAPONS) {
    game.player.addWeapon(new Bow());
  }
  game.offers = [offerWeapon("axe", 1)];
  game.player.currency = 100;
  const blocked = game.purchase(0);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "slots");
  assert.equal(game.player.weapons.length, MAX_WEAPONS);
  assert.equal(game.player.currency, 100);

  game.offers = [
    {
      id: "hp-25",
      cost: 10,
      sold: false,
      requiresSlot: false,
      apply(avatar) {
        avatar.maxHealth += 25;
        avatar.health += 25;
      },
    },
  ];
  const before = game.player.maxHealth;
  assert.equal(game.purchase(0).ok, true);
  assert.equal(game.player.maxHealth, before + 25);
  assert.equal(game.player.currency, 90);
});

test("shotgun spreads a short cone and the bow pierces a second enemy", () => {
  const spread = new Game();
  spread.startRun();
  spread.spawnTimer = 1000;
  const shotgun = new Shotgun();
  shotgun.cooldown = 10;
  spread.player.weapons = [shotgun];
  const distant = spread.spawnOne("basic", 600, 0);
  distant.speed = 0;
  const hp = distant.hp;
  spread.update(1 / 60, { x: 0, y: 0 });
  assert.equal(spread.projectiles.length, 5);
  assert.ok(spread.projectiles.every((shot) => shot.vx > 0));
  assert.ok(spread.projectiles.some((shot) => shot.vy > 0));
  assert.ok(spread.projectiles.some((shot) => shot.vy < 0));
  for (let i = 0; i < 50; i += 1) spread.update(1 / 60, { x: 0, y: 0 });
  assert.equal(spread.projectiles.length, 0);
  assert.equal(distant.hp, hp);

  const pierce = new Game();
  pierce.startRun();
  pierce.spawnTimer = 1000;
  const bow = new Bow();
  bow.cooldown = 10;
  pierce.player.weapons = [bow];
  const first = pierce.spawnOne("basic", 90, 0);
  const second = pierce.spawnOne("basic", 150, 0);
  first.speed = 0;
  second.speed = 0;
  first.hp = 500;
  second.hp = 500;
  for (let i = 0; i < 30; i += 1) pierce.update(1 / 60, { x: 0, y: 0 });
  assert.ok(first.hp < 500);
  assert.ok(second.hp < 500);
  assert.equal(pierce.projectiles.length, 0);
});

test("a bat knocks an enemy back and a bazooka blast reaches its neighbors", () => {
  const game = new Game();
  game.startRun();
  game.spawnTimer = 1000;
  const bat = new Bat();
  bat.cooldown = 10;
  game.player.weapons = [bat];
  const shoved = game.spawnOne("basic", 60, 0);
  shoved.speed = 0;
  const startX = shoved.x;
  for (let i = 0; i < 20; i += 1) game.update(1 / 60, { x: 0, y: 0 });
  assert.ok(shoved.x > startX + 20);
  assert.ok(shoved.hp < shoved.maxHp);

  const blast = new Game();
  blast.startRun();
  blast.spawnTimer = 1000;
  const bazooka = new Bazooka();
  bazooka.cooldown = 10;
  blast.player.weapons = [bazooka];
  const primary = blast.spawnOne("basic", 90, 0);
  const neighbor = blast.spawnOne("basic", 90, 50);
  const outside = blast.spawnOne("basic", 90, 260);
  primary.speed = 0;
  neighbor.speed = 0;
  outside.speed = 0;
  const primaryHp = primary.hp;
  const neighborHp = neighbor.hp;
  const outsideHp = outside.hp;
  for (let i = 0; i < 40; i += 1) blast.update(1 / 60, { x: 0, y: 0 });
  assert.ok(primary.hp < primaryHp);
  assert.ok(neighbor.hp < neighborHp);
  assert.equal(outside.hp, outsideHp);
});

test("attack speed, armor, regen, life steal, wave heal, and bread", () => {
  const player = new Player();
  assert.equal(player.cooldownFor(1), 1);
  player.attackSpeed = 100;
  assert.ok(Math.abs(player.cooldownFor(1) - 0.5) < 1e-9);
  player.attackSpeed = -500;
  assert.equal(player.attackFactor(), 0.4);

  const paced = new Game();
  paced.startRun();
  const bow = new Bow();
  paced.player.weapons = [bow];
  paced.player.attackSpeed = 100;
  paced.spawnOne("basic", 240, 0);
  paced.update(1 / 60, { x: 0, y: 0 });
  assert.ok(Math.abs(bow.readyIn - bow.cooldown / 2) < 0.001);

  const armored = new Game();
  armored.startRun();
  armored.player.weapons = [];
  armored.player.health = 80;
  armored.player.armor = 5;
  const hitter = armored.spawnOne("basic", 0, 0);
  armored.update(1 / 60, { x: 0, y: 0 });
  assert.equal(armored.player.health, 80 - (hitter.contactDamage - 5));
  armored.player.armor = 999;
  armored.player.invuln = 0;
  hitter.x = armored.player.x;
  hitter.y = armored.player.y;
  hitter.alive = true;
  const beforeChip = armored.player.health;
  armored.update(1 / 60, { x: 0, y: 0 });
  assert.equal(armored.player.health, beforeChip - 1);

  const regen = new Game();
  regen.startRun();
  regen.player.weapons = [];
  regen.spawnTimer = 1000;
  regen.player.health = 50;
  regen.player.regen = 2;
  regen.player.regenTimer = 2.97;
  regen.update(0.02, { x: 0, y: 0 });
  assert.equal(regen.player.health, 50);
  regen.update(0.05, { x: 0, y: 0 });
  assert.equal(regen.player.health, 52);

  const steal = new Game();
  steal.startRun();
  steal.player.weapons = [];
  steal.player.health = 50;
  steal.player.lifeSteal = 100;
  const victim = steal.spawnOne("basic", 0, 240);
  victim.takeDamage(999, steal);
  assert.equal(steal.player.health, 51);
  steal.player.lifeSteal = 0;
  steal.player.health = 50;
  const spared = steal.spawnOne("basic", 40, 240);
  spared.takeDamage(999, steal);
  assert.equal(steal.player.health, 50);

  const healed = new Game();
  healed.startRun();
  healed.player.weapons = [];
  healed.player.health = 40;
  healed.timeLeft = 0.01;
  healed.update(1 / 60, { x: 0, y: 0 });
  assert.equal(healed.state, STATE.SHOP);
  healed.nextWave();
  assert.equal(healed.player.health, 60);
  healed.player.health = 95;
  healed.timeLeft = 0.01;
  healed.player.weapons = [];
  healed.update(1 / 60, { x: 0, y: 0 });
  healed.nextWave();
  assert.equal(healed.player.health, healed.player.maxHealth);

  const bread = offerBread(1);
  const fed = new Player();
  bread.apply(fed);
  assert.equal(fed.maxHealth, 103);
  assert.equal(fed.health, 103);
  assert.equal(fed.attackSpeed, -5);
  assert.match(bread.detail, /Max Health \+3/);
  assert.match(bread.detail, /Attack Speed/);
});
