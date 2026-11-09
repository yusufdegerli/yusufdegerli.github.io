import { COIN_BRONZE_CHANCE, COIN_GOLD_CHANCE, COIN_RADIUS, COIN_SILVER_CHANCE, COIN_VALUES, MAGNET_PULL_SPEED, } from './constants.js';
/** `roll` is in [0, 1). Gold is tested first so it stays the rare drop. */
export function pickCoinKind(roll) {
    if (roll < COIN_GOLD_CHANCE)
        return 'gold';
    if (roll < COIN_GOLD_CHANCE + COIN_SILVER_CHANCE)
        return 'silver';
    if (roll < COIN_GOLD_CHANCE + COIN_SILVER_CHANCE + COIN_BRONZE_CHANCE)
        return 'bronze';
    return null;
}
export function makeCoin(id, platformX, platformWidth, platformTop, roll) {
    const kind = pickCoinKind(roll);
    if (!kind)
        return null;
    const radius = COIN_RADIUS;
    const pad = radius + 2;
    if (platformWidth <= pad * 2)
        return null;
    const span = platformWidth - pad * 2;
    return {
        id,
        x: platformX + pad + Math.random() * span,
        y: platformTop + 24,
        kind,
        value: COIN_VALUES[kind],
        radius,
    };
}
export function pullCoins(coins, host, radius, dt) {
    if (radius <= 0)
        return;
    const cx = host.x + host.width / 2;
    const cy = host.y + host.height / 2;
    const reach = radius * radius;
    for (const coin of coins) {
        const dx = cx - coin.x;
        const dy = cy - coin.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > reach || dist2 === 0)
            continue;
        const dist = Math.sqrt(dist2);
        const step = Math.min(MAGNET_PULL_SPEED * dt, dist);
        coin.x += (dx / dist) * step;
        coin.y += (dy / dist) * step;
    }
}
/** Removes overlapping coins and returns the sum of their values. */
export function collectCoins(coins, host) {
    let gained = 0;
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        if (!overlaps(host, coin))
            continue;
        gained += coin.value;
        coins.splice(i, 1);
    }
    return gained;
}
function overlaps(host, coin) {
    const closestX = Math.max(host.x, Math.min(coin.x, host.x + host.width));
    const closestY = Math.max(host.y, Math.min(coin.y, host.y + host.height));
    const dx = coin.x - closestX;
    const dy = coin.y - closestY;
    return dx * dx + dy * dy <= coin.radius * coin.radius;
}
//# sourceMappingURL=coins.js.map