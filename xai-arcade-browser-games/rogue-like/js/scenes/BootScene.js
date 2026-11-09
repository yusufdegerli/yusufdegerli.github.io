export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const bar = this.add.rectangle(640, 360, 240, 8, 0x2a1c16).setOrigin(0.5);
    const fill = this.add.rectangle(520, 360, 0, 8, 0x8a3030).setOrigin(0, 0.5);
    this.load.on("progress", (p) => {
      fill.width = 240 * p;
    });

    const p = "assets/sprites/player";
    this.load.image("player-idle", `${p}/idle.png`);
    this.load.image("player-run0", `${p}/run0.png`);
    this.load.image("player-run1", `${p}/run1.png`);
    this.load.image("player-run2", `${p}/run2.png`);
    this.load.image("player-run3", `${p}/run3.png`);
    this.load.image("player-jump", `${p}/jump.png`);
    this.load.image("player-dash", `${p}/dash.png`);
    this.load.image("player-slam", `${p}/slam.png`);
    this.load.image("player-charge", `${p}/charge.png`);
    this.load.image("player-heavy", `${p}/heavy.png`);
    this.load.image("player-attack", `${p}/attack.png`);
    this.load.image("player-block", `${p}/block.png`);
    this.load.image("player-hurt", `${p}/hurt.png`);

    const e = "assets/sprites/enemies";
    this.load.image("ghoul-idle", `${e}/ghoul_idle.png`);
    this.load.image("ghoul-windup", `${e}/ghoul_windup.png`);
    this.load.image("ghoul-strike", `${e}/ghoul_strike.png`);
    this.load.image("hound-idle", `${e}/hound_idle.png`);
    this.load.image("hound-windup", `${e}/hound_windup.png`);
    this.load.image("hound-strike", `${e}/hound_strike.png`);
    this.load.image("wight-idle", `${e}/wight_idle.png`);
    this.load.image("wight-windup", `${e}/wight_windup.png`);
    this.load.image("wight-strike", `${e}/wight_strike.png`);

    this.load.image("tile-flag", "assets/tiles/flagstone.png");
    this.load.image("tile-wall", "assets/tiles/wall.png");
    this.load.image("tile-bridge", "assets/tiles/bridge.png");
    this.load.image("tile-gate", "assets/tiles/gate.png");
    this.load.image("bg-far", "assets/bg/far.png");
    this.load.image("bg-mid", "assets/bg/mid.png");
    this.load.image("ui-panel", "assets/ui/panel.png");
    this.load.image("fx-slash", "assets/fx/slash.png");
    this.load.image("fx-dust", "assets/fx/dust.png");
    this.load.image("fx-ember", "assets/fx/ember.png");
    this.load.image("fx-spark", "assets/fx/spark.png");
    this.load.image("fx-shock", "assets/fx/shock.png");
    this.load.image("prop-chest", "assets/props/chest_shut.png");
    this.load.image("prop-chest-open", "assets/props/chest_open.png");
    this.load.image("prop-coin", "assets/props/coin.png");
    this.load.image("prop-keeper", "assets/props/keeper.png");
  }

  create() {
    this.anims.create({
      key: "player-run",
      frames: [
        { key: "player-run0" },
        { key: "player-run1" },
        { key: "player-run2" },
        { key: "player-run3" },
      ],
      frameRate: 11,
      repeat: -1,
    });
    this.anims.create({
      key: "player-idle-anim",
      frames: [{ key: "player-idle" }],
      frameRate: 1,
    });
    this.makeHazardTextures();
    this.scene.start("MenuScene");
  }

  makeHazardTextures() {
    const spike = this.make.graphics({ add: false });
    spike.fillStyle(0x6a6a72, 1);
    spike.fillTriangle(8, 16, 0, 16, 4, 0);
    spike.fillStyle(0xc8c8d0, 1);
    spike.fillTriangle(6, 16, 2, 16, 4, 3);
    spike.generateTexture("tex-spike", 8, 16);
    spike.destroy();

    const pad = this.make.graphics({ add: false });
    pad.fillStyle(0x1a4030, 1);
    pad.fillRect(0, 8, 32, 8);
    pad.fillStyle(0x3cb87a, 1);
    pad.fillCircle(16, 7, 11);
    pad.fillStyle(0x8aefb0, 1);
    pad.fillCircle(16, 6, 5);
    pad.generateTexture("tex-bounce", 32, 16);
    pad.destroy();

    const wood = this.make.graphics({ add: false });
    wood.fillStyle(0x5a3a22, 1);
    wood.fillRect(0, 0, 64, 16);
    wood.fillStyle(0x7a5230, 1);
    wood.fillRect(0, 2, 64, 5);
    wood.fillStyle(0x3a2414, 1);
    wood.fillRect(0, 10, 64, 2);
    wood.fillStyle(0x8a6440, 1);
    wood.fillRect(8, 0, 2, 16);
    wood.fillRect(40, 0, 2, 16);
    wood.generateTexture("tex-wood", 64, 16);
    wood.destroy();

    const bolt = this.make.graphics({ add: false });
    bolt.fillStyle(0x9ae8f0, 1);
    bolt.fillTriangle(18, 4, 0, 1, 0, 7);
    bolt.fillStyle(0xe8ffff, 1);
    bolt.fillRect(2, 3, 10, 2);
    bolt.generateTexture("fx-bolt", 18, 8);
    bolt.destroy();

    const shot = this.make.graphics({ add: false });
    shot.fillStyle(0xe07040, 1);
    shot.fillCircle(6, 6, 6);
    shot.fillStyle(0xffc090, 1);
    shot.fillCircle(5, 5, 3);
    shot.generateTexture("fx-shot", 12, 12);
    shot.destroy();

    const orb = this.make.graphics({ add: false });
    orb.fillStyle(0x8040c0, 1);
    orb.fillCircle(7, 7, 7);
    orb.fillStyle(0xd8a0ff, 1);
    orb.fillCircle(6, 5, 3);
    orb.generateTexture("fx-orb", 14, 14);
    orb.destroy();

    const sword = this.make.graphics({ add: false });
    sword.fillStyle(0xe8dcc0, 1);
    sword.fillRect(10, 2, 4, 18);
    sword.fillStyle(0x8a6a40, 1);
    sword.fillRect(8, 16, 8, 3);
    sword.fillStyle(0x5a3a22, 1);
    sword.fillRect(10, 19, 4, 5);
    sword.generateTexture("wep-sword", 24, 26);
    sword.destroy();

    const dagger = this.make.graphics({ add: false });
    dagger.fillStyle(0xc8f0ff, 1);
    dagger.fillTriangle(8, 1, 5, 14, 11, 14);
    dagger.fillStyle(0x4a6080, 1);
    dagger.fillRect(5, 14, 6, 2);
    dagger.fillStyle(0x2a3040, 1);
    dagger.fillRect(7, 16, 2, 6);
    dagger.generateTexture("wep-dagger", 16, 24);
    dagger.destroy();

    const hammer = this.make.graphics({ add: false });
    hammer.fillStyle(0x6a6868, 1);
    hammer.fillRect(2, 1, 18, 10);
    hammer.fillStyle(0x9a9890, 1);
    hammer.fillRect(3, 2, 16, 4);
    hammer.fillStyle(0x6a4a28, 1);
    hammer.fillRect(9, 10, 4, 14);
    hammer.generateTexture("wep-hammer", 22, 26);
    hammer.destroy();

    const bow = this.make.graphics({ add: false });
    bow.lineStyle(3, 0xc8b080, 1);
    bow.beginPath();
    bow.arc(6, 13, 12, -1.2, 1.2, false);
    bow.strokePath();
    bow.lineStyle(1, 0xe8e0d0, 1);
    bow.lineBetween(6, 2, 6, 24);
    bow.generateTexture("wep-bow", 20, 26);
    bow.destroy();

    const plate = this.make.graphics({ add: false });
    plate.fillStyle(0x3a3830, 1);
    plate.fillCircle(20, 8, 16);
    plate.fillStyle(0x6a6860, 1);
    plate.fillCircle(20, 7, 11);
    plate.fillStyle(0xb8a060, 1);
    plate.fillCircle(20, 7, 4);
    plate.generateTexture("prop-plate", 40, 16);
    plate.destroy();

    const sw = this.make.graphics({ add: false });
    sw.fillStyle(0x4a3020, 1);
    sw.fillRect(6, 18, 12, 8);
    sw.fillStyle(0xc04028, 1);
    sw.fillRect(10, 2, 4, 18);
    sw.fillStyle(0xe8c040, 1);
    sw.fillCircle(12, 3, 4);
    sw.generateTexture("prop-switch", 24, 28);
    sw.destroy();

    const door = this.make.graphics({ add: false });
    door.fillStyle(0x2a1810, 1);
    door.fillRect(0, 0, 28, 64);
    door.fillStyle(0x5a3a22, 1);
    for (let y = 4; y < 60; y += 8) door.fillRect(3, y, 22, 3);
    door.fillStyle(0xc8a050, 1);
    door.fillRect(0, 0, 28, 3);
    door.fillRect(10, 28, 8, 8);
    door.generateTexture("prop-door", 28, 64);
    door.destroy();
  }
}
