import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BootScene } from "./scenes/BootScene.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { ControlsScene } from "./scenes/ControlsScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { GameOverScene } from "./scenes/GameOverScene.js";

let started = false;
function startGame() {
  if (started) return;
  started = true;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#070708",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 1680 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, ControlsScene, GameScene, GameOverScene],
  });
  window.game = game;

  window.addEventListener("blur", () => {
    if (game.sound) game.sound.pauseAll();
  });
}

const fonts = document.fonts?.ready;
if (fonts) {
  const fallback = setTimeout(startGame, 1600);
  fonts.then(() => {
    clearTimeout(fallback);
    startGame();
  });
} else {
  startGame();
}
