import {
  GROUND_ACCEL,
  GROUND_ACCEL_UPGRADE_STEP,
  JUMP_SPEED,
  JUMP_UPGRADE_STEP,
  MAGNET_RADIUS_STEP,
  MAX_RUN_SPEED,
  RUN_SPEED_UPGRADE_STEP,
  TELEPORT_COST,
  TELEPORT_DISTANCE,
  UPGRADE_BASE_COST,
  UPGRADE_COST_SCALE,
} from './constants.js';
import type { PlayerStats } from './types.js';

export type UpgradeId = 'jump' | 'run' | 'magnet' | 'teleport';

export const UPGRADE_IDS: readonly UpgradeId[] = ['jump', 'run', 'magnet', 'teleport'];

export class Wallet {
  balance = 0;

  add(amount: number): void {
    this.balance += amount;
  }
}

export class Upgrades {
  readonly ranks: Record<UpgradeId, number> = { jump: 0, run: 0, magnet: 0, teleport: 0 };

  cost(id: UpgradeId): number {
    if (id === 'teleport') return TELEPORT_COST;
    return Math.round(UPGRADE_BASE_COST[id] * UPGRADE_COST_SCALE[id] ** this.ranks[id]);
  }

  purchase(id: UpgradeId, wallet: Wallet): boolean {
    const price = this.cost(id);
    if (wallet.balance < price) return false;
    wallet.balance -= price;
    this.ranks[id] += 1;
    return true;
  }

  stats(): PlayerStats {
    return {
      jumpSpeed: JUMP_SPEED + this.ranks.jump * JUMP_UPGRADE_STEP,
      maxRunSpeed: MAX_RUN_SPEED + this.ranks.run * RUN_SPEED_UPGRADE_STEP,
      groundAccel: GROUND_ACCEL + this.ranks.run * GROUND_ACCEL_UPGRADE_STEP,
      magnetRadius: this.ranks.magnet * MAGNET_RADIUS_STEP,
    };
  }

  name(id: UpgradeId): string {
    if (id === 'jump') return 'Higher jump';
    if (id === 'run') return 'Faster run';
    if (id === 'magnet') return 'Coin magnet';
    return 'Quantum Teleporter';
  }

  detail(id: UpgradeId): string {
    const stats = this.stats();
    if (id === 'jump') {
      return `Jump speed ${Math.round(stats.jumpSpeed)} → ${Math.round(stats.jumpSpeed + JUMP_UPGRADE_STEP)}`;
    }
    if (id === 'run') {
      return `Top speed ${Math.round(stats.maxRunSpeed)} → ${Math.round(stats.maxRunSpeed + RUN_SPEED_UPGRADE_STEP)}, ground accel ${Math.round(stats.groundAccel)} → ${Math.round(stats.groundAccel + GROUND_ACCEL_UPGRADE_STEP)}`;
    }
    if (id === 'magnet') {
      const next = stats.magnetRadius + MAGNET_RADIUS_STEP;
      return stats.magnetRadius === 0
        ? `Pull coins within ${MAGNET_RADIUS_STEP}px`
        : `Pull radius ${Math.round(stats.magnetRadius)} → ${Math.round(next)}`;
    }
    return `Instant +${TELEPORT_DISTANCE}px. Keeps horizontal speed and lands on a new platform.`;
  }
}
