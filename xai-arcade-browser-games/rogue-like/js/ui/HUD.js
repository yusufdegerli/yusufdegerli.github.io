import { DEATH_AGE, COMBAT } from "../config.js";

const UI_DEPTH = 2000;

export class HUD {
  constructor(scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(UI_DEPTH);

    this.panel = drawIronFrame(scene, 16, 14, 368, 118);
    this.atkPanel = drawIronFrame(scene, GAME_ATK_X(), 14, 176, 96);

    this.ageLabel = uiText(scene, 34, 24, "AGE", 13, "#8a7a68");
    this.ageValue = uiText(scene, 34, 38, "20", 36, "#e8dcc8");
    this.yearsLeft = uiText(scene, 118, 56, "60 YRS LEFT", 12, "#8a7060", "Share Tech Mono");

    this.hpLabel = uiText(scene, 220, 24, "VITALITY", 13, "#8a7a68");
    this.hpBack = scene.add.rectangle(220, 46, 140, 12, 0x1a1210).setOrigin(0, 0);
    this.hpFill = scene.add.rectangle(220, 46, 140, 12, 0x9a2a28).setOrigin(0, 0);
    this.hpText = uiText(scene, 220, 62, "100 / 100", 12, "#c8b8a4", "Share Tech Mono");

    this.soulLabel = uiText(scene, 220, 80, "ASHBOLT", 11, "#6a7a88");
    this.soulBack = scene.add.rectangle(220, 96, 140, 10, 0x12181c).setOrigin(0, 0);
    this.soulFill = scene.add.rectangle(220, 96, 140, 10, 0x3aa0b8).setOrigin(0, 0);
    this.soulText = uiText(scene, 220, 108, "F  —  READY", 11, "#8ab0b8", "Share Tech Mono");

    this.atkLabel = uiText(scene, GAME_ATK_X() + 16, 24, "ATTACK", 13, "#8a7a68");
    this.atkValue = uiText(scene, GAME_ATK_X() + 16, 42, "12", 36, "#d8b060");
    this.atkHint = uiText(scene, GAME_ATK_X() + 16, 82, "BONE SWORD", 12, "#c8b070", "Share Tech Mono");
    this.coinText = uiText(scene, 34, 108, "0 c", 14, "#e8c040", "Share Tech Mono");

    this.hintBar = scene.add.rectangle(640, 706, 1280, 28, 0x050506, 0.82).setScrollFactor(0).setDepth(UI_DEPTH);
    this.hint = scene.add
      .text(640, 706, "A/D MOVE   SPACE JUMP   SHIFT DASH   Q / RMB GRAPPLE   J STRIKE   S+J SLAM   F ASHBOLT   K PARRY", {
        fontFamily: "Share Tech Mono",
        fontSize: "13px",
        color: "#c8c0b0",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 1);

    this.banner = scene.add
      .text(640, 150, "", {
        fontFamily: "Oswald",
        fontSize: "42px",
        color: "#f0e0c0",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 2)
      .setAlpha(0);

    this.chargeBack = scene.add.rectangle(118, 112, 80, 4, 0x1a1210).setOrigin(0, 0);
    this.chargeFill = scene.add.rectangle(118, 112, 0, 4, 0xd48a20).setOrigin(0, 0);

    this.root.add([
      this.panel,
      this.atkPanel,
      this.ageLabel,
      this.ageValue,
      this.yearsLeft,
      this.hpLabel,
      this.hpBack,
      this.hpFill,
      this.hpText,
      this.soulLabel,
      this.soulBack,
      this.soulFill,
      this.soulText,
      this.atkLabel,
      this.atkValue,
      this.atkHint,
      this.coinText,
      this.chargeBack,
      this.chargeFill,
    ]);
    this.root.iterate((child) => {
      if (child && child.setScrollFactor) child.setScrollFactor(0);
    });
  }

  update(player) {
    this.ageValue.setText(String(player.age));
    const left = Math.max(0, DEATH_AGE - player.age);
    this.yearsLeft.setText(left === 0 ? "LAST LIFE" : `${left} YRS LEFT`);
    this.yearsLeft.setColor(left <= 10 ? "#c05040" : "#8a7060");
    this.ageValue.setColor(player.age >= DEATH_AGE ? "#c05040" : "#e8dcc8");

    const ratio = Phaser.Math.Clamp(player.hp / player.hpMax, 0, 1);
    this.hpFill.width = 140 * ratio;
    const col = ratio > 0.5 ? 0x8a3030 : ratio > 0.25 ? 0xb84820 : 0xd02020;
    this.hpFill.setFillStyle(col);
    this.hpText.setText(`${player.hp} / ${player.hpMax}`);
    this.atkValue.setText(String(player.atk));
    this.atkHint.setText(player.wep?.name || "BONE SWORD");
    this.coinText.setText(`${player.coins || 0} c`);

    const emax = player.energyMax || COMBAT.specialMax;
    const er = Phaser.Math.Clamp((player.energy || 0) / emax, 0, 1);
    this.soulFill.width = 140 * er;
    this.soulFill.setFillStyle((player.energy || 0) >= COMBAT.specialCost ? 0x3aa0b8 : 0x2a4a52);
    const ready = (player.energy || 0) >= COMBAT.specialCost;
    this.soulText.setText(ready ? "F  —  READY" : "F  —  CHARGING");
    this.soulText.setColor(ready ? "#9ad4dc" : "#6a8084");

    if (player.charging) {
      const p = Phaser.Math.Clamp((player.now() - player.chargeStart) / 1000, 0, 1);
      this.chargeFill.width = 80 * p;
      this.chargeFill.setFillStyle(p >= 1 ? 0xf0d070 : 0xd48a20);
      this.chargeBack.setVisible(true);
      this.chargeFill.setVisible(true);
    } else {
      this.chargeBack.setVisible(false);
      this.chargeFill.setVisible(false);
    }
  }

  flashBanner(text, color = "#f0e0c0") {
    this.banner.setText(text);
    this.banner.setColor(color);
    this.scene.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(1);
    this.banner.setScale(1.08);
    this.scene.tweens.add({
      targets: this.banner,
      alpha: 0,
      scale: 1,
      duration: 900,
      delay: 450,
      ease: "Quad.easeIn",
    });
  }
}

function uiText(scene, x, y, str, size, color, font = "Oswald") {
  return scene.add.text(x, y, str, { fontFamily: font, fontSize: `${size}px`, color }).setOrigin(0, 0);
}

function GAME_ATK_X() {
  return 1280 - 18 - 176;
}

function drawIronFrame(scene, x, y, w, h) {
  const g = scene.add.graphics();
  g.fillStyle(0x100e10, 0.9);
  g.fillRect(x, y, w, h);
  g.lineStyle(3, 0x2a2018, 1);
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.lineStyle(1, 0x6a4a30, 1);
  g.strokeRect(x + 4, y + 4, w - 8, h - 8);
  g.fillStyle(0xc8b070, 1);
  const bone = (bx, by, horz) => {
    if (horz) g.fillRect(bx, by, 14, 3);
    else g.fillRect(bx, by, 3, 14);
  };
  bone(x + 3, y + 3, true);
  bone(x + 3, y + 3, false);
  bone(x + w - 17, y + 3, true);
  bone(x + w - 6, y + 3, false);
  bone(x + 3, y + h - 6, true);
  bone(x + 3, y + h - 17, false);
  bone(x + w - 17, y + h - 6, true);
  bone(x + w - 6, y + h - 17, false);
  return g;
}
