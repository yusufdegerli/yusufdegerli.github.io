import { GAME_WIDTH, GAME_HEIGHT, START_AGE } from "../config.js";
import { audio } from "../audio.js";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#070708");
    this.drawBackdrop();

    this.add
      .text(GAME_WIDTH / 2, 168, "ASHEN YEARS", {
        fontFamily: "Oswald",
        fontSize: "86px",
        color: "#e6d8c4",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 236, "EVERY DEATH STEALS TIME", {
        fontFamily: "Share Tech Mono",
        fontSize: "16px",
        color: "#8a6a50",
      })
      .setOrigin(0.5);

    this.makeButton(GAME_WIDTH / 2, 380, "START GAME", () => this.start());
    this.makeButton(GAME_WIDTH / 2, 470, "CONTROLS", () => {
      audio.ui();
      this.scene.start("ControlsScene");
    });

    this.add
      .text(GAME_WIDTH / 2, 620, "A NEW PIT IS CARVED FOR EVERY RUN", {
        fontFamily: "Share Tech Mono",
        fontSize: "14px",
        color: "#6a6258",
      })
      .setOrigin(0.5);

    // Keyboard start, matching the GameOver screen (Enter / Space / J).
    this.starting = false;
    const kb = this.input.keyboard;
    ["keydown-ENTER", "keydown-SPACE", "keydown-J"].forEach((evt) => kb.once(evt, () => this.start()));

    if (new URLSearchParams(window.location.search).has("play")) {
      this.time.delayedCall(80, () => this.start(true));
    }
  }

  makeButton(x, y, label, onClick) {
    const bg = this.add.rectangle(x, y, 280, 56, 0x1a1410, 0.92).setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(2, 0x8a6a38);
    const txt = this.add
      .text(x, y, label, {
        fontFamily: "Oswald",
        fontSize: "26px",
        color: "#e8d8b0",
      })
      .setOrigin(0.5);
    bg.on("pointerover", () => bg.setFillStyle(0x2a2014, 1));
    bg.on("pointerout", () => bg.setFillStyle(0x1a1410, 0.92));
    bg.on("pointerdown", onClick);
    return { bg, txt };
  }

  start(skipFade = false) {
    if (this.starting) return; // click + key in the same moment must not start twice
    this.starting = true;
    audio.resume();
    audio.ui();
    this.registry.set("age", START_AGE);
    this.registry.set("kills", 0);
    this.registry.set("parries", 0);
    this.registry.set("coins", 0);
    this.registry.set("won", false);
    if (skipFade) {
      this.scene.start("GameScene");
      return;
    }
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(280, () => this.scene.start("GameScene"));
  }

  drawBackdrop() {
    const g = this.add.graphics();
    g.fillStyle(0x0b0b0d, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 18; i++) {
      const x = 40 + i * 72;
      const h = 180 + ((i * 97) % 260);
      g.fillStyle(0x101014, 1);
      g.fillRect(x, GAME_HEIGHT - 80 - h, 48, h);
    }
    g.fillStyle(0x121214, 1);
    g.fillRect(0, GAME_HEIGHT - 80, GAME_WIDTH, 80);
    g.fillStyle(0x3a2018, 0.35);
    g.fillRect(0, GAME_HEIGHT - 82, GAME_WIDTH, 3);
  }
}
