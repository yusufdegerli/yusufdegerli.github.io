import {
  MAX_WEAPONS,
  STATE,
  WAVE_DURATION,
  formatTime,
  Game,
} from "./engine.js";
import { draw } from "./render.js";

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");
const game = new Game();

const hud = document.getElementById("hud");
const banner = document.getElementById("banner");
const screens = {
  start: document.getElementById("screen-start"),
  shop: document.getElementById("screen-shop"),
  gameover: document.getElementById("screen-over"),
};

const startButton = document.getElementById("btn-start");
const retryButton = document.getElementById("btn-retry");
const menuButton = document.getElementById("btn-menu");
const nextButton = document.getElementById("btn-next");
const shopOffers = document.getElementById("shop-offers");
const shopCurrency = document.getElementById("shop-currency");

class Input {
  constructor() {
    this.down = new Set();
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "a" || key === "s" || key === "d") {
        this.down.add(key);
        event.preventDefault();
      }
    });
    window.addEventListener("keyup", (event) => {
      this.down.delete(event.key.toLowerCase());
    });
    window.addEventListener("blur", () => this.down.clear());
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.down.has("a")) x -= 1;
    if (this.down.has("d")) x += 1;
    if (this.down.has("w")) y -= 1;
    if (this.down.has("s")) y += 1;
    return { x, y };
  }
}

const input = new Input();
let seenState = "";
let seenShopRevision = -1;

startButton.addEventListener("click", () => game.startRun());
retryButton.addEventListener("click", () => game.startRun());
menuButton.addEventListener("click", () => game.newRun());
nextButton.addEventListener("click", () => game.nextWave());

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const bitmapW = Math.floor(width * dpr);
  const bitmapH = Math.floor(height * dpr);
  if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
    canvas.width = bitmapW;
    canvas.height = bitmapH;
  }
  game.setView(width, height);
  return dpr;
}

function renderSlots(container, weapons, showCooldown) {
  container.replaceChildren();
  for (let i = 0; i < MAX_WEAPONS; i += 1) {
    const weapon = weapons[i];
    const slot = document.createElement("div");
    slot.className = "slot";
    if (!weapon) {
      slot.classList.add("empty");
      container.appendChild(slot);
      continue;
    }
    slot.title = weapon.name;
    if (weapon.swing) slot.classList.add("active");
    const icon = document.createElement("span");
    icon.className = `icon icon-${weapon.id}`;
    slot.appendChild(icon);
    if (showCooldown) {
      const cover = document.createElement("span");
      cover.className = "slot-cd";
      const denom = weapon.readyIn || weapon.cooldown;
      const ratio = weapon.swing
        ? 0
        : Math.max(0, Math.min(1, weapon.timer / denom));
      cover.style.height = `${ratio * 100}%`;
      slot.appendChild(cover);
    }
    container.appendChild(slot);
  }
}

function syncHud() {
  const player = game.player;
  document.getElementById("wave-num").textContent = String(game.wave);
  const timer = document.getElementById("timer");
  timer.textContent = formatTime(game.timeLeft);
  timer.classList.toggle("urgent", game.timeLeft <= 5);
  document.getElementById("timer-fill").style.width = `${
    (game.timeLeft / WAVE_DURATION) * 100
  }%`;
  document.getElementById("currency").textContent = String(player.currency);
  document.getElementById("level-label").textContent = `Lv ${player.level}`;
  document.getElementById("xp-fill").style.width = `${
    (player.xp / player.xpToNext) * 100
  }%`;
  document.getElementById("stat-max").textContent = String(player.maxHealth);
  document.getElementById("stat-hp").textContent = String(Math.ceil(player.health));
  document.getElementById("stat-speed").textContent = String(Math.round(player.speed));
  document.getElementById("stat-dmg").textContent = player.damageMultiplier.toFixed(2);
  document.getElementById("stat-radius").textContent = String(
    Math.round(player.collectionRadius),
  );
  document.getElementById("stat-aspd").textContent = String(player.attackSpeed);
  document.getElementById("stat-regen").textContent = String(player.regen);
  document.getElementById("stat-steal").textContent = `${player.lifeSteal}%`;
  document.getElementById("stat-armor").textContent = String(player.armor);
  document.getElementById("stat-wave-heal").textContent = `${Math.round(player.waveHeal * 100)}%`;
  renderSlots(document.getElementById("weapon-bar"), player.weapons, true);

  if (game.bannerTime > 0) {
    banner.classList.remove("hidden");
    banner.textContent = game.bannerText;
    banner.style.color = game.bannerColor;
  } else {
    banner.classList.add("hidden");
  }
}

function syncGameOver() {
  document.getElementById("over-wave").textContent = String(game.wave);
  document.getElementById("over-level").textContent = String(game.player.level);
  document.getElementById("over-kills").textContent = String(game.kills);
  document.getElementById("over-currency").textContent = String(game.player.currency);
}

function renderShopStats() {
  const player = game.player;
  const root = document.getElementById("shop-stats");
  const rows = [
    ["Max Health", player.maxHealth],
    ["Current Health", Math.ceil(player.health)],
    ["Movement Speed", Math.round(player.speed)],
    ["Damage Multiplier", player.damageMultiplier.toFixed(2)],
    ["Collection Radius", Math.round(player.collectionRadius)],
    ["Attack Speed", player.attackSpeed],
    ["Health Regeneration", player.regen],
    ["Life Steal", `${player.lifeSteal}%`],
    ["Armor", player.armor],
    ["Wave Heal", `${Math.round(player.waveHeal * 100)}%`],
  ];
  root.replaceChildren();
  for (const [label, value] of rows) {
    const item = document.createElement("span");
    item.textContent = `${label} ${value}`;
    root.appendChild(item);
  }
}

function buildShop() {
  const player = game.player;
  document.getElementById("shop-wave").textContent =
    `Wave ${game.wave} cleared. The next wave heals 20% of max health, then sends more enemies with more health.`;
  shopCurrency.textContent = String(player.currency);
  document.getElementById("shop-loadout").textContent =
    `${player.weapons.length}/${MAX_WEAPONS} weapons equipped`;
  renderShopStats();
  renderSlots(document.getElementById("shop-weapons"), player.weapons, false);

  shopOffers.replaceChildren();
  game.offers.forEach((offer, index) => {
    const card = document.createElement("article");
    card.className = "offer";
    card.style.setProperty("--accent", offer.accent);
    if (offer.sold) card.classList.add("sold");

    const tag = document.createElement("p");
    tag.className = "offer-tag";
    tag.textContent = offer.tag;

    const title = document.createElement("h3");
    title.textContent = offer.title;

    const detail = document.createElement("p");
    detail.className = "offer-detail";
    detail.textContent = offer.detail;

    const cost = document.createElement("p");
    cost.className = "offer-cost";
    const gem = document.createElement("span");
    gem.className = "gem-icon";
    const amount = document.createElement("span");
    amount.textContent = String(offer.cost);
    cost.append(gem, amount);

    const button = document.createElement("button");
    button.type = "button";
    const slotsFull = offer.requiresSlot && player.weapons.length >= MAX_WEAPONS;
    const afford = player.currency >= offer.cost;
    if (offer.sold) {
      button.textContent = "Purchased";
      button.disabled = true;
    } else if (slotsFull) {
      button.textContent = "Slots full";
      button.disabled = true;
    } else if (!afford) {
      button.textContent = "Not enough currency";
      button.disabled = true;
    } else {
      button.textContent = "Buy";
      button.addEventListener("click", () => {
        const result = game.purchase(index);
        if (!result.ok && result.reason === "money") {
          shopCurrency.parentElement.classList.remove("shake");
          void shopCurrency.parentElement.offsetWidth;
          shopCurrency.parentElement.classList.add("shake");
        }
      });
    }

    card.append(tag, title, detail, cost, button);
    shopOffers.appendChild(card);
  });
}

function syncScreens() {
  const entered = game.state !== seenState;
  seenState = game.state;
  screens.start.classList.toggle("hidden", game.state !== STATE.START);
  screens.shop.classList.toggle("hidden", game.state !== STATE.SHOP);
  screens.gameover.classList.toggle("hidden", game.state !== STATE.GAME_OVER);
  hud.classList.toggle("hidden", game.state !== STATE.PLAYING);

  if (game.state === STATE.PLAYING) syncHud();
  else banner.classList.add("hidden");
  if (game.state === STATE.GAME_OVER) syncGameOver();
  if (game.state === STATE.SHOP && game.shopRevision !== seenShopRevision) {
    seenShopRevision = game.shopRevision;
    buildShop();
  }

  if (!entered) return;
  if (game.state === STATE.START) startButton.focus();
  if (game.state === STATE.GAME_OVER) retryButton.focus();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const dpr = fitCanvas();
  game.update(dt, input.axis());
  draw(ctx, game, dpr, now);
  syncScreens();
  requestAnimationFrame(frame);
}

requestAnimationFrame((now) => {
  last = now;
  requestAnimationFrame(frame);
});
