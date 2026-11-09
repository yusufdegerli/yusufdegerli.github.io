export type GameStatus = 'playing' | 'Stop' | 'Game Over';

export type CoinKind = 'bronze' | 'silver' | 'gold';

export interface Coin {
  id: number;
  x: number;
  y: number;
  kind: CoinKind;
  value: number;
  radius: number;
}

/** Live movement stats. Upgrades change these; the base constants stay fixed. */
export interface PlayerStats {
  jumpSpeed: number;
  maxRunSpeed: number;
  groundAccel: number;
  magnetRadius: number;
}

export type PlatformKind = 'normal' | 'fragile' | 'spring';

export interface Platform {
  id: number;
  /** Spawn order. Ground is 0. Later platforms always sit higher. */
  index: number;
  x: number;
  /** World Y of the top surface. World +Y is up. */
  y: number;
  width: number;
  height: number;
  ground: boolean;
  /** Landing slab placed under a quantum teleport. */
  anchor: boolean;
  /** Extra-wide platform that opens the shop once the player stands on it. */
  shop: boolean;
  kind: PlatformKind;
  /** Seconds since the player started standing on a fragile platform. */
  crumble: number | null;
}

export interface Controls {
  readonly left: boolean;
  readonly right: boolean;
  /** Edge-triggered. Returns true once per Space press. */
  consumeJump(): boolean;
  consumeRestart(): boolean;
}
