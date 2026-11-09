import { FRAGILE_BREAK_SECONDS, PLAYER_HEIGHT, PLAYER_WIDTH, VIEW_HEIGHT, VIEW_WIDTH } from './constants.js';
import { clamp, lerp } from './math.js';
/** Primary input is a finger (phones, tablets): show touch hints instead of keys. */
const TOUCH_UI = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
export class Renderer {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    draw(snapshot) {
        this.drawSky(snapshot.cameraBottom);
        this.drawGoal(snapshot.targetHeight, snapshot.cameraBottom);
        for (const platform of snapshot.platforms) {
            this.drawPlatform(platform, snapshot.cameraBottom);
        }
        for (const coin of snapshot.coins)
            this.drawCoin(coin, snapshot.cameraBottom);
        this.drawMagnet(snapshot);
        if (snapshot.ghost)
            this.drawGhost(snapshot.ghost, snapshot.cameraBottom);
        this.drawPlayer(snapshot.player, snapshot.cameraBottom);
        if (snapshot.scrolling)
            this.drawDangerEdge(snapshot.scrollSpeed);
        this.drawHud(snapshot);
        if (snapshot.status === 'Game Over')
            this.drawGameOver(snapshot);
    }
    drawSky(cameraBottom) {
        const { ctx } = this;
        const altitude = clamp(cameraBottom / 9000, 0, 1);
        const top = mix(hex('#16324f'), hex('#140818'), altitude);
        const bottom = mix(hex('#6ea0c4'), hex('#4a2a62'), altitude);
        const bands = 18;
        for (let i = 0; i < bands; i++) {
            ctx.fillStyle = css(mix(top, bottom, i / (bands - 1)));
            const y = Math.floor((VIEW_HEIGHT * i) / bands);
            const h = Math.ceil(VIEW_HEIGHT / bands) + 1;
            ctx.fillRect(0, y, VIEW_WIDTH, h);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        const parallax = cameraBottom * 0.15;
        for (let i = 0; i < 7; i++) {
            const cx = ((i * 97 + 40) % (VIEW_WIDTH + 80)) - 40;
            const cy = ((i * 130 - parallax) % (VIEW_HEIGHT + 60) + (VIEW_HEIGHT + 60)) % (VIEW_HEIGHT + 60) - 30;
            ctx.fillRect(cx, cy, 54 + (i % 3) * 16, 10);
            ctx.fillRect(cx + 14, cy - 8, 28, 10);
        }
    }
    drawPlatform(platform, cameraBottom) {
        const { ctx } = this;
        const top = worldToScreenY(platform.y, cameraBottom);
        if (top > VIEW_HEIGHT || top + platform.height < 0)
            return;
        if (platform.ground) {
            ctx.fillStyle = '#3e5a40';
            ctx.fillRect(platform.x, top, platform.width, platform.height);
            ctx.fillStyle = '#7dba78';
            ctx.fillRect(platform.x, top, platform.width, 8);
            return;
        }
        if (platform.shop) {
            ctx.fillStyle = '#6e4b32';
            ctx.fillRect(platform.x, top, platform.width, platform.height);
            ctx.fillStyle = '#e7c27a';
            ctx.fillRect(platform.x, top, platform.width, 4);
            ctx.fillStyle = '#3d2a1c';
            ctx.fillRect(platform.x, top + platform.height - 3, platform.width, 3);
            this.drawShopTent(platform, cameraBottom);
            return;
        }
        if (platform.anchor) {
            ctx.fillStyle = '#3d2a78';
            ctx.fillRect(platform.x, top, platform.width, platform.height);
            ctx.fillStyle = '#b9a6ff';
            ctx.fillRect(platform.x, top, platform.width, 4);
            ctx.fillStyle = '#6d5cff';
            ctx.fillRect(platform.x, top + platform.height - 3, platform.width, 3);
            return;
        }
        const stress = platform.kind === 'fragile' ? clamp((platform.crumble ?? 0) / FRAGILE_BREAK_SECONDS, 0, 1) : 0;
        const shake = stress === 0 ? 0 : Math.sin(stress * 46) * (2 + stress * 7);
        const left = platform.x + shake;
        if (platform.kind === 'fragile') {
            ctx.fillStyle = stress === 0 ? '#c47a62' : mixCss('#c47a62', '#e23b32', stress);
            ctx.fillRect(left, top, platform.width, platform.height);
            ctx.fillStyle = stress === 0 ? '#f0b59a' : mixCss('#f0b59a', '#ffd0c4', stress);
            ctx.fillRect(left, top, platform.width, 4);
            ctx.fillStyle = '#6a3228';
            ctx.fillRect(left + 6, top + 7, Math.max(8, platform.width * 0.35), 2);
            ctx.fillRect(left + platform.width * 0.45, top + 8, Math.max(6, platform.width * 0.2), 2);
            return;
        }
        if (platform.kind === 'spring') {
            ctx.fillStyle = '#2f9e62';
            ctx.fillRect(platform.x, top, platform.width, platform.height);
            ctx.fillStyle = '#b6f5c8';
            ctx.fillRect(platform.x, top, platform.width, 4);
            ctx.fillStyle = '#e8fff0';
            const arrowX = platform.x + platform.width / 2;
            ctx.beginPath();
            ctx.moveTo(arrowX, top - 14);
            ctx.lineTo(arrowX - 8, top - 4);
            ctx.lineTo(arrowX + 8, top - 4);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(arrowX - 2, top - 4, 4, 6);
            return;
        }
        ctx.fillStyle = '#c4a574';
        ctx.fillRect(platform.x, top, platform.width, platform.height);
        ctx.fillStyle = '#f0e2c4';
        ctx.fillRect(platform.x, top, platform.width, 4);
        ctx.fillStyle = '#8d6b3f';
        ctx.fillRect(platform.x, top + platform.height - 3, platform.width, 3);
    }
    drawShopTent(platform, cameraBottom) {
        const { ctx } = this;
        const base = worldToScreenY(platform.y, cameraBottom);
        const left = platform.x + 28;
        ctx.fillStyle = '#8e3548';
        ctx.fillRect(left, base - 42, 36, 42);
        ctx.fillStyle = '#f0d78c';
        ctx.beginPath();
        ctx.moveTo(left - 12, base - 38);
        ctx.lineTo(left + 18, base - 68);
        ctx.lineTo(left + 48, base - 38);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2b1c16';
        ctx.fillRect(left + 12, base - 22, 12, 22);
        ctx.fillStyle = '#d24b4b';
        ctx.fillRect(left + 34, base - 74, 3, 16);
        ctx.fillRect(left + 34, base - 74, 14, 8);
    }
    drawGhost(ghost, cameraBottom) {
        const { ctx } = this;
        const screenTop = worldToScreenY(ghost.y + PLAYER_HEIGHT, cameraBottom);
        if (screenTop > VIEW_HEIGHT || screenTop + PLAYER_HEIGHT < 0)
            return;
        ctx.save();
        ctx.globalAlpha = 0.38;
        ctx.translate(ghost.x + PLAYER_WIDTH / 2, screenTop + PLAYER_HEIGHT / 2);
        ctx.fillStyle = '#9ad7ff';
        ctx.fillRect(-PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT);
        ctx.fillStyle = '#e7f7ff';
        ctx.fillRect(-PLAYER_WIDTH / 2 + 6, -PLAYER_HEIGHT / 2 + 6, PLAYER_WIDTH - 12, 16);
        ctx.fillStyle = '#16324f';
        const eyeX = ghost.facing === 1 ? 4 : -10;
        ctx.fillRect(eyeX, -PLAYER_HEIGHT / 2 + 11, 4, 4);
        ctx.fillRect(eyeX + 8, -PLAYER_HEIGHT / 2 + 11, 4, 4);
        ctx.restore();
    }
    drawPlayer(player, cameraBottom) {
        const { ctx } = this;
        const screenTop = worldToScreenY(player.y + player.height, cameraBottom);
        const tilt = clamp(player.vx / 360, -1, 1) * 0.28;
        const stretch = clamp(player.vy / 900, -0.25, 0.35);
        ctx.save();
        ctx.translate(player.x + player.width / 2, screenTop + player.height / 2);
        ctx.rotate(tilt);
        ctx.scale(1 - stretch * 0.35, 1 + stretch);
        ctx.fillStyle = '#ff6b4a';
        ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
        ctx.fillStyle = '#ffd7bf';
        ctx.fillRect(-player.width / 2 + 6, -player.height / 2 + 6, player.width - 12, 16);
        ctx.fillStyle = '#24180f';
        const eyeX = player.facing === 1 ? 4 : -10;
        ctx.fillRect(eyeX, -player.height / 2 + 11, 4, 4);
        ctx.fillRect(eyeX + 8, -player.height / 2 + 11, 4, 4);
        ctx.restore();
    }
    drawDangerEdge(scrollSpeed) {
        const { ctx } = this;
        const alpha = clamp(scrollSpeed / 180, 0.25, 0.7);
        ctx.fillStyle = `rgba(255, 70, 50, ${alpha * 0.35})`;
        ctx.fillRect(0, VIEW_HEIGHT - 18, VIEW_WIDTH, 18);
        ctx.fillStyle = `rgba(255, 120, 80, ${alpha})`;
        ctx.fillRect(0, VIEW_HEIGHT - 4, VIEW_WIDTH, 4);
    }
    drawHud(snapshot) {
        const { ctx } = this;
        ctx.fillStyle = '#f7f4ea';
        ctx.font = '700 28px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(snapshot.score), 16, 14);
        ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(247,244,234,0.8)';
        ctx.fillText(`level ${snapshot.level}  ·  ${Math.floor(snapshot.maxHeight)} / ${Math.floor(snapshot.targetHeight)}`, 16, 46);
        ctx.textAlign = 'right';
        ctx.fillText(`coins ${snapshot.coinsBalance}`, VIEW_WIDTH - 16, 18);
        ctx.textAlign = 'left';
        if (snapshot.combo > 0) {
            ctx.fillStyle = '#ffe08a';
            ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif';
            ctx.fillText(`COMBO x${snapshot.combo}`, 16, 70);
        }
        if (snapshot.popup) {
            ctx.fillStyle = '#ffe08a';
            ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(snapshot.popup, VIEW_WIDTH / 2, 110);
        }
        if (snapshot.elapsed < 4 && snapshot.status === 'playing') {
            ctx.fillStyle = 'rgba(247,244,234,0.9)';
            ctx.font = '600 16px ui-sans-serif, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(TOUCH_UI ? 'Hold sides to run    Tap middle to jump' : 'Arrows move    Space jumps', VIEW_WIDTH / 2, VIEW_HEIGHT - 84);
            ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
            ctx.fillText('Bronze 1   ·   Silver 5   ·   Gold 10', VIEW_WIDTH / 2, VIEW_HEIGHT - 60);
        }
    }
    drawGameOver(snapshot) {
        const { ctx } = this;
        ctx.fillStyle = 'rgba(8, 6, 16, 0.72)';
        ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f7f4ea';
        ctx.font = '700 48px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText('Game Over', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 90);
        ctx.font = '600 22px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(`Score ${snapshot.score}`, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 28);
        ctx.font = '500 16px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(247,244,234,0.85)';
        ctx.fillText(`Level ${snapshot.level}`, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 8);
        ctx.fillText(`Platforms ${snapshot.platformsLanded}`, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 32);
        ctx.fillText(`Best combo x${snapshot.bestCombo}`, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 56);
        ctx.fillStyle = '#ffe08a';
        ctx.font = '600 16px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(TOUCH_UI ? 'Tap to retry' : 'Space or R to retry', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 110);
    }
    drawGoal(targetHeight, cameraBottom) {
        const { ctx } = this;
        const y = worldToScreenY(targetHeight, cameraBottom);
        if (y < -8 || y > VIEW_HEIGHT + 8)
            return;
        ctx.fillStyle = 'rgba(255, 224, 138, 0.95)';
        ctx.fillRect(0, y, VIEW_WIDTH, 3);
        ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('GOAL', VIEW_WIDTH - 10, y - 2);
    }
    drawCoin(coin, cameraBottom) {
        const { ctx } = this;
        const sy = worldToScreenY(coin.y, cameraBottom);
        if (sy < -20 || sy > VIEW_HEIGHT + 20)
            return;
        const fill = coin.kind === 'gold' ? '#ffd15a' : coin.kind === 'silver' ? '#e7eef5' : '#e29a4a';
        const rim = coin.kind === 'gold' ? '#a87412' : coin.kind === 'silver' ? '#7d8b9c' : '#8a5424';
        ctx.beginPath();
        ctx.fillStyle = rim;
        ctx.arc(coin.x, sy, coin.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = fill;
        ctx.arc(coin.x, sy, coin.radius - 3, 0, Math.PI * 2);
        ctx.fill();
    }
    drawMagnet(snapshot) {
        if (snapshot.magnetRadius <= 0)
            return;
        const { ctx } = this;
        const player = snapshot.player;
        const cx = player.x + player.width / 2;
        const cy = worldToScreenY(player.y + player.height / 2, snapshot.cameraBottom);
        ctx.beginPath();
        ctx.arc(cx, cy, snapshot.magnetRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 209, 90, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
function worldToScreenY(worldY, cameraBottom) {
    return VIEW_HEIGHT - (worldY - cameraBottom);
}
function mix(from, to, t) {
    const u = clamp(t, 0, 1);
    return [
        Math.round(lerp(from[0], to[0], u)),
        Math.round(lerp(from[1], to[1], u)),
        Math.round(lerp(from[2], to[2], u)),
    ];
}
function css(color) {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}
function mixCss(from, to, t) {
    return css(mix(hex(from), hex(to), t));
}
function hex(color) {
    const value = Number.parseInt(color.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
//# sourceMappingURL=renderer.js.map