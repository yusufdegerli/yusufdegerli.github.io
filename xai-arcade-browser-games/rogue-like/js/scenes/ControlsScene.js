import { GAME_WIDTH, GAME_HEIGHT } from "../config.js";
import { audio } from "../audio.js";

export class ControlsScene extends Phaser.Scene {
  constructor() {
    super("ControlsScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#070708");
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x070708, 1).setOrigin(0);

    this.add
      .text(GAME_WIDTH / 2, 80, "CONTROLS", {
        fontFamily: "Oswald",
        fontSize: "48px",
        color: "#e6d8c4",
      })
      .setOrigin(0.5);

    const body =
      "A / D  or  ARROWS          Move\n" +
      "SPACE / W / UP             Jump  (double jump)\n" +
      "SHIFT                      Dash thrust\n" +
      "J / Z                      Strike   —  hold 1s for heavy\n" +
      "S + J  in air              Aerial slam\n" +
      "K / X                      Block / parry\n" +
      "L / C                      Dodge\n" +
      "Q  or  RIGHT MOUSE         Grapple  (A/D swing, S slacken)\n" +
      "F                          Ashbolt  (energy)\n" +
      "E                          Interact  (shop, chests)\n" +
      "ESC                        Pause\n\n" +
      "Enemies telegraph. Parry the pale flash.\n" +
      "Coins buy upgrades. Chests hide weapons.\n" +
      "Locked doors need a plate and a switch in other rooms.";

    this.add
      .text(GAME_WIDTH / 2, 360, body, {
        fontFamily: "Share Tech Mono",
        fontSize: "18px",
        color: "#b4aaa0",
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    const bg = this.add.rectangle(GAME_WIDTH / 2, 640, 240, 50, 0x1a1410, 0.92).setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(2, 0x8a6a38);
    this.add
      .text(GAME_WIDTH / 2, 640, "BACK", {
        fontFamily: "Oswald",
        fontSize: "24px",
        color: "#e8d8b0",
      })
      .setOrigin(0.5);
    bg.on("pointerdown", () => {
      audio.ui();
      this.scene.start("MenuScene");
    });
  }
}
