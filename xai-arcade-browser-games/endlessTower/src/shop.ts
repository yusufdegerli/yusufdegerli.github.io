import { UPGRADE_IDS, type UpgradeId, type Upgrades, type Wallet } from './upgrades.js';

export interface ShopListing {
  id: UpgradeId;
  name: string;
  detail: string;
  cost: number;
  rank: number;
  affordable: boolean;
}

export interface ShopInfo {
  levelCleared: number;
  nextLevel: number;
  balance: number;
  listings: ShopListing[];
}

export interface ShopController {
  open(info: ShopInfo): void;
  close(): void;
  sync(info: ShopInfo): void;
}

export interface ShopActions {
  buy(id: UpgradeId): void;
  continue(): void;
}

export function shopInfo(levelCleared: number, wallet: Wallet, upgrades: Upgrades): ShopInfo {
  return {
    levelCleared,
    nextLevel: levelCleared + 1,
    balance: wallet.balance,
    listings: UPGRADE_IDS.map((id) => ({
      id,
      name: upgrades.name(id),
      detail: upgrades.detail(id),
      cost: upgrades.cost(id),
      rank: upgrades.ranks[id],
      affordable: wallet.balance >= upgrades.cost(id),
    })),
  };
}

export class NullShop implements ShopController {
  opened = false;
  info: ShopInfo | null = null;

  open(info: ShopInfo): void {
    this.opened = true;
    this.info = info;
  }

  close(): void {
    this.opened = false;
  }

  sync(info: ShopInfo): void {
    this.info = info;
  }
}

/** HTML overlay. The canvas never draws this menu. */
export class HtmlShop implements ShopController {
  private actions: ShopActions | null = null;
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly next: HTMLElement;
  private readonly balance: HTMLElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly rows: Record<UpgradeId, { detail: HTMLElement; button: HTMLButtonElement; rank: HTMLElement }>;

  constructor() {
    this.root = must('shop');
    this.title = must('shop-title');
    this.next = must('shop-next');
    this.balance = must('shop-balance');
    this.continueButton = must('shop-continue');
    this.rows = {
      jump: this.row('jump'),
      run: this.row('run'),
      magnet: this.row('magnet'),
      teleport: this.row('teleport'),
    };

    this.continueButton.addEventListener('click', () => this.actions?.continue());
    for (const id of UPGRADE_IDS) {
      this.rows[id].button.addEventListener('click', () => this.actions?.buy(id));
    }
  }

  bind(actions: ShopActions): void {
    this.actions = actions;
  }

  open(info: ShopInfo): void {
    this.apply(info);
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }

  sync(info: ShopInfo): void {
    this.apply(info);
  }

  private apply(info: ShopInfo): void {
    this.title.textContent = `Level ${info.levelCleared} complete`;
    this.next.textContent = `Continue from this height. Level ${info.nextLevel} raises the floor faster and narrows new platforms.`;
    this.balance.textContent = String(info.balance);
    this.continueButton.textContent = 'Continue';
    for (const listing of info.listings) {
      const row = this.rows[listing.id];
      row.detail.textContent = listing.detail;
      row.rank.textContent = listing.rank === 0 ? 'Not owned' : `Owned ×${listing.rank}`;
      row.button.textContent = `Buy · ${listing.cost}`;
      row.button.disabled = !listing.affordable;
    }
  }

  private row(id: UpgradeId): { detail: HTMLElement; button: HTMLButtonElement; rank: HTMLElement } {
    return {
      detail: must(`detail-${id}`),
      button: must(`buy-${id}`),
      rank: must(`rank-${id}`),
    };
  }
}

function must<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}
