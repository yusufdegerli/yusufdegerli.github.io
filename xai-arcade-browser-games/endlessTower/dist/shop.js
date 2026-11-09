import { UPGRADE_IDS } from './upgrades.js';
export function shopInfo(levelCleared, wallet, upgrades) {
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
export class NullShop {
    opened = false;
    info = null;
    open(info) {
        this.opened = true;
        this.info = info;
    }
    close() {
        this.opened = false;
    }
    sync(info) {
        this.info = info;
    }
}
/** HTML overlay. The canvas never draws this menu. */
export class HtmlShop {
    actions = null;
    root;
    title;
    next;
    balance;
    continueButton;
    rows;
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
    bind(actions) {
        this.actions = actions;
    }
    open(info) {
        this.apply(info);
        this.root.hidden = false;
    }
    close() {
        this.root.hidden = true;
    }
    sync(info) {
        this.apply(info);
    }
    apply(info) {
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
    row(id) {
        return {
            detail: must(`detail-${id}`),
            button: must(`buy-${id}`),
            rank: must(`rank-${id}`),
        };
    }
}
function must(id) {
    const node = document.getElementById(id);
    if (!node)
        throw new Error(`Missing #${id}`);
    return node;
}
//# sourceMappingURL=shop.js.map