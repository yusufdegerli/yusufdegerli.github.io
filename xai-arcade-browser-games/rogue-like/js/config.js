export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const START_AGE = 20;
export const DEATH_AGE = 80;

export function maxHealthForAge(age) {
  const t = Phaser.Math.Clamp((age - START_AGE) / (DEATH_AGE - START_AGE), 0, 1);
  return Math.round(Phaser.Math.Linear(100, 34, t));
}

export function attackForAge(age) {
  const t = Phaser.Math.Clamp((age - START_AGE) / (DEATH_AGE - START_AGE), 0, 1);
  return Math.round(Phaser.Math.Linear(12, 44, t));
}

export function randomAgeGain() {
  return Phaser.Math.Between(6, 14);
}

export function playerTintForAge(age) {
  const t = Phaser.Math.Clamp((age - START_AGE) / (DEATH_AGE - START_AGE), 0, 1);
  const r = Math.round(Phaser.Math.Linear(255, 176, t));
  const g = Math.round(Phaser.Math.Linear(255, 164, t));
  const b = Math.round(Phaser.Math.Linear(255, 148, t));
  return (r << 16) | (g << 8) | b;
}

export const MOVE = {
  maxSpeed: 390,
  accel: 4600,
  decel: 4000,
  airAccel: 3000,
  airDecel: 900,
  jumpSpeed: 730,
  doubleJumpSpeed: 690,
  gravity: 1680,
  fallGravity: 2140,
  jumpCut: 0.5,
  jumpMinMs: 110,
  maxFall: 820,
  coyoteMs: 100,
  bufferMs: 120,
  dashSpeed: 820,
  dashMs: 128,
  dashCooldownMs: 380,
  dashIFramesMs: 120,
  dodgeSpeed: 460,
  dodgeMs: 230,
  dodgeIFramesMs: 200,
  dodgeCooldownMs: 360,
};

export const COMBAT = {
  parryWindowMs: 175,
  blockDamageScale: 0.28,
  blockChipMin: 1,
  hurtIFramesMs: 420,
  hitstopMs: 55,
  parryHitstopMs: 110,
  riposteWindowMs: 900,
  riposteScale: 1.7,
  attackLockMs: [90, 80, 110],
  attackActiveMs: [70, 70, 90],
  attackRecoverMs: [160, 180, 280],
  attackLinkMs: [110, 120, 0],
  attackRange: [58, 62, 70],
  attackDamageScale: [1, 1.18, 1.5],
  attackKnockback: [140, 180, 320],
  chargeMs: 1000,
  heavyStartupMs: 220,
  heavyActiveMs: 140,
  heavyRecoverMs: 400,
  heavyRange: 84,
  heavyScale: 2.35,
  heavyKnockback: 420,
  slamSpeed: 980,
  slamRadius: 110,
  slamScale: 1.85,
  dashThrustRange: 72,
  dashThrustScale: 1.35,
  specialCost: 36,
  specialRegen: 16,
  specialMax: 100,
  specialSpeed: 620,
  specialScale: 1.55,
  specialCooldownMs: 380,
};

export const ENEMY = {
  thug: {
    kind: "thug",
    sprite: "ghoul",
    w: 30,
    h: 52,
    displayW: 78,
    displayH: 78,
    color: 0x8a2e2e,
    hp: 42,
    speed: 145,
    damage: 14,
    range: 50,
    windupMs: 620,
    parryMs: 180,
    activeMs: 110,
    recoverMs: 420,
    stunMs: 1150,
    aggro: 340,
    score: 1,
    role: "melee",
  },
  brawler: {
    kind: "brawler",
    sprite: "hound",
    w: 46,
    h: 34,
    displayW: 92,
    displayH: 66,
    color: 0xb85a28,
    hp: 34,
    speed: 200,
    damage: 10,
    range: 46,
    windupMs: 430,
    parryMs: 150,
    activeMs: 90,
    recoverMs: 300,
    stunMs: 1000,
    aggro: 380,
    score: 1,
    role: "melee",
  },
  brute: {
    kind: "brute",
    sprite: "wight",
    w: 44,
    h: 66,
    displayW: 96,
    displayH: 96,
    color: 0x4a1418,
    hp: 96,
    speed: 105,
    damage: 24,
    range: 68,
    windupMs: 880,
    parryMs: 200,
    activeMs: 140,
    recoverMs: 560,
    stunMs: 1400,
    aggro: 300,
    score: 3,
    role: "melee",
  },
  shooter: {
    kind: "shooter",
    sprite: "ghoul",
    role: "ranged",
    w: 30,
    h: 52,
    displayW: 74,
    displayH: 74,
    color: 0x2e6a6a,
    tint: 0x70d0c4,
    hp: 28,
    speed: 90,
    damage: 11,
    range: 340,
    preferDist: 240,
    windupMs: 520,
    parryMs: 160,
    activeMs: 80,
    recoverMs: 640,
    stunMs: 900,
    aggro: 460,
    score: 1,
  },
  mage: {
    kind: "mage",
    sprite: "wight",
    role: "mage",
    w: 36,
    h: 56,
    displayW: 78,
    displayH: 78,
    color: 0x4a2868,
    tint: 0xb078e0,
    hp: 38,
    speed: 80,
    damage: 8,
    range: 300,
    preferDist: 220,
    windupMs: 700,
    parryMs: 180,
    activeMs: 90,
    recoverMs: 800,
    stunMs: 1100,
    aggro: 420,
    heal: 10,
    healEveryMs: 2600,
    score: 2,
  },
  kamikaze: {
    kind: "kamikaze",
    sprite: "hound",
    role: "kamikaze",
    w: 44,
    h: 32,
    displayW: 86,
    displayH: 60,
    color: 0xc02018,
    tint: 0xff5030,
    hp: 18,
    speed: 260,
    damage: 28,
    range: 36,
    windupMs: 280,
    parryMs: 120,
    activeMs: 80,
    recoverMs: 200,
    stunMs: 700,
    aggro: 500,
    score: 1,
  },
};

export const LEVEL = {
  width: 9600,
  height: 720,
  gravity: 1680,
};

export const HAZARD = {
  spikeDamage: 16,
  bounceVel: -980,
  fallArmMs: 1000,
  fallRespawnMs: 4200,
};

export const GRAPPLE = {
  maxRange: 500,
  minLen: 64,
  damping: 0.993,
  swingAccel: 16,
  reel: 220,
  cooldownMs: 200,
};

export const NAV = {
  jumpH: 175,
  jumpW: 260,
};

export const WEAPONS = {
  sword: {
    id: "sword",
    name: "BONE SWORD",
    kind: "melee",
    tint: 0xffffff,
    glow: 0xd8c8a0,
    overlay: "wep-sword",
    scale: 1,
    range: [58, 62, 70],
    lock: [90, 80, 110],
    active: [70, 70, 90],
    recover: [160, 180, 280],
    dmg: [1, 1.18, 1.5],
    kb: [140, 180, 320],
  },
  dagger: {
    id: "dagger",
    name: "ASH DAGGER",
    kind: "melee",
    tint: 0xa8d4e8,
    glow: 0x80e0ff,
    overlay: "wep-dagger",
    scale: 0.92,
    range: [40, 44, 48],
    lock: [48, 42, 50],
    active: [40, 40, 48],
    recover: [90, 96, 130],
    dmg: [0.7, 0.82, 0.96],
    kb: [80, 100, 130],
  },
  hammer: {
    id: "hammer",
    name: "STONE HAMMER",
    kind: "melee",
    tint: 0xd08048,
    glow: 0xff9040,
    overlay: "wep-hammer",
    scale: 1.12,
    range: [72, 80, 92],
    lock: [150, 140, 170],
    active: [110, 110, 130],
    recover: [260, 280, 380],
    dmg: [1.5, 1.75, 2.15],
    kb: [240, 300, 440],
  },
  bow: {
    id: "bow",
    name: "BONE BOW",
    kind: "ranged",
    tint: 0x90c070,
    glow: 0xc8f090,
    overlay: "wep-bow",
    scale: 1.0,
    range: [36, 36, 36],
    lock: [90, 90, 90],
    active: [50, 50, 50],
    recover: [240, 240, 240],
    dmg: [1.15, 1.15, 1.15],
    kb: [60, 60, 60],
  },
};

export const SHOP = [
  { id: "vita", name: "VITALITY +18", cost: 18, desc: "Raise maximum health" },
  { id: "edge", name: "EDGE +5", cost: 22, desc: "Permanently raise attack" },
  { id: "ash", name: "ASH WELL +20", cost: 16, desc: "Larger ashbolt reserve" },
  { id: "salve", name: "SALVE", cost: 12, desc: "Restore all health" },
];
