import { VIEW_HEIGHT, VIEW_WIDTH } from './constants.js';
import { Game } from './game.js';
import { Keyboard } from './input.js';
import { startLoop } from './loop.js';
import { HtmlShop } from './shop.js';
const canvas = document.querySelector('canvas');
if (!canvas)
    throw new Error('Missing canvas element');
const ctx = canvas.getContext('2d');
if (!ctx)
    throw new Error('Canvas 2D context is unavailable');
const dpr = Math.min(2, window.devicePixelRatio || 1);
canvas.width = Math.floor(VIEW_WIDTH * dpr);
canvas.height = Math.floor(VIEW_HEIGHT * dpr);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
const shop = new HtmlShop();
const game = new Game(ctx, new Keyboard(), shop);
shop.bind({
    buy: (id) => game.buy(id),
    continue: () => game.beginNextLevel(),
});
startLoop((dt) => game.update(dt), () => game.draw());
//# sourceMappingURL=main.js.map