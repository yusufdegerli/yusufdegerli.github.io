/** Logical view size. The canvas is scaled up in CSS; physics stays in these pixels. */
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 720;

export const PLAYER_WIDTH = 36;
export const PLAYER_HEIGHT = 48;

/** Horizontal run. Acceleration is finite so releasing a key slides to a stop. */
export const GROUND_ACCEL = 900;
export const AIR_ACCEL = 420;
export const GROUND_FRICTION = 520;
export const AIR_FRICTION = 36;
export const MAX_RUN_SPEED = 360;

/**
 * Jump vertical speed grows with |vx|, so a running takeoff is higher and,
 * because hang time increases, also farther. Gravity is world-up (negative).
 */
export const JUMP_SPEED = 780;
export const JUMP_VX_CARRY = 0.45;
export const GRAVITY = -1800;
export const MAX_FALL_SPEED = -1100;

export const GROUND_HEIGHT = 36;

export const PLATFORM_HEIGHT = 16;
export const FRAGILE_BREAK_SECONDS = 0.6;
export const SPRING_JUMP_MULTIPLIER = 1.6;
export const PLATFORM_MIN_WIDTH = 86;
export const PLATFORM_MAX_WIDTH = 210;
export const SPAWN_AHEAD = VIEW_HEIGHT * 0.9;
export const CULL_MARGIN = 48;

/** Camera follow keeps the player around this fraction up from the bottom. */
export const FOLLOW_ANCHOR = 0.5;
export const FOLLOW_SHARPNESS = 5;

/** Automatic upward slide starts after this many seconds, then ramps. */
export const SCROLL_DELAY = 4;
export const SCROLL_START_SPEED = 28;
export const SCROLL_ACCEL = 4.2;
export const SCROLL_MAX_SPEED = 230;

export const HEIGHT_SCORE_UNIT = 10;
export const PLATFORM_SCORE = 15;
export const COMBO_SKIP_MIN = 2;
export const COMBO_POINTS_PER_SKIP = 40;

/** Independent rolls, checked from rarest to most common. */
export const COIN_GOLD_CHANCE = 0.08;
export const COIN_SILVER_CHANCE = 0.2;
export const COIN_BRONZE_CHANCE = 0.44;
export const COIN_RADIUS = 10;
export const COIN_VALUES = { bronze: 1, silver: 5, gold: 10 } as const;

export const JUMP_UPGRADE_STEP = 32;
export const RUN_SPEED_UPGRADE_STEP = 30;
export const GROUND_ACCEL_UPGRADE_STEP = 90;
export const MAGNET_RADIUS_STEP = 88;
export const MAGNET_PULL_SPEED = 640;

export const UPGRADE_BASE_COST = { jump: 8, run: 10, magnet: 14 } as const;
export const UPGRADE_COST_SCALE = { jump: 1.75, run: 1.7, magnet: 1.85 } as const;
export const TELEPORT_COST = 100;
export const TELEPORT_DISTANCE = 2500;
export const TELEPORT_PAD_WIDTH = 168;
