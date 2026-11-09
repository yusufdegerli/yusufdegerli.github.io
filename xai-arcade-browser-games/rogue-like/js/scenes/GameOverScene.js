import { GAME_WIDTH, GAME_HEIGHT, START_AGE } from "../config.js";
import { audio } from "../audio.js";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  create() {
    const age = this.registry.get("age") ?? START_AGE;
    const kills = this.registry.get("kills") ?? 0;
    const parries = this.registry.get("parries") ?? 0;
    const won = this.registry.get("won") === true;

    this.cameras.main.setBackgroundColor("#050506");
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050506, 1).setOrigin(0);

    const title = won ? "YOU WALKED OUT" : "THE YEARS RAN OUT";
    this.add
      .text(GAME_WIDTH / 2, 180, title, {
        fontFamily: "Oswald",
        fontSize: "64px",
        color: won ? "#d8c8a0" : "#c05040",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const sub = won
      ? `You reached the gate at age ${age}. The pit did not keep you.`
      : `Age ${age}. The body would not stand again.`;

    this.add
      .text(GAME_WIDTH / 2, 260, sub, {
        fontFamily: "Oswald",
        fontSize: "22px",
        color: "#9a9084",
      })
      .setOrigin(0.5);

    const coins = this.registry.get("coins") ?? 0;
    const stats = `YEARS SPENT   ${age - START_AGE}        KILLS   ${kills}        PARRIES   ${parries}        COINS   ${coins}`;
    this.add
      .text(GAME_WIDTH / 2, 360, stats, {
        fontFamily: "Share Tech Mono",
        fontSize: "18px",
        color: "#8a7a68",
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(GAME_WIDTH / 2, 520, "PRESS  ENTER  TO  BEGIN  AGAIN  AT  20", {
        fontFamily: "Oswald",
        fontSize: "22px",
        color: "#d8b060",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard.once("keydown-ENTER", () => this.restart());
    this.input.keyboard.once("keydown-SPACE", () => this.restart());
    this.input.keyboard.once("keydown-J", () => this.restart());
    this.input.once("pointerdown", () => this.restart());
  }

  restart() {
    audio.resume();
    audio.ui();
    this.registry.set("age", START_AGE);
    this.registry.set("kills", 0);
    this.registry.set("parries", 0);
    this.registry.set("won", false);
    this.cameras.main.fadeOut(240, 0, 0, 0);
    this.time.delayedCall(240, () => this.scene.start("GameScene"));
  }
}
