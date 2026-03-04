import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';
import { drawWaveBand } from './waterMath.js';

export class StartMenuScene extends Phaser.Scene {
  constructor() {
    super('StartMenuScene');
    this.uiEventName = 'risingtide:menu-state';
  }

  preload() {
    // Keep filenames stable so final pixel-art can be dropped in directly.
    this.load.image('underwaterShallow', 'assets/backgrounds/underwater_shallow.png');
    this.load.image('underwaterDeep', 'assets/backgrounds/underwater_deep.png');
    this.load.image('waterOverlaySprite', 'assets/sprites/water_overlay.png');

    this.load.image('trash1', 'assets/sprites/trash1.png');
    this.load.image('trash2', 'assets/sprites/trash2.png');
    this.load.image('trash3', 'assets/sprites/trash3.png');
    this.load.image('trash4', 'assets/sprites/trash4.png');

    this.load.image('bubbleCollectible', 'assets/sprites/bubble_collectible.png');
    this.load.image('fish1', 'assets/sprites/fish1.png');
    this.load.image('fish2', 'assets/sprites/fish2.png');
    this.load.image('fish3', 'assets/sprites/fish3.png');
    this.load.image('fish4', 'assets/sprites/fish4.png');
    this.load.image('fish5', 'assets/sprites/fish5.png');
  }

  create() {
    this.cameras.main.fadeIn(450, 0, 0, 0);

    this.bgShallow = this.add.tileSprite(GAME_WIDTH * 0.5, 170, GAME_WIDTH, 300, 'underwaterShallow');
    this.bgDeep = this.add.tileSprite(GAME_WIDTH * 0.5, 410, GAME_WIDTH, 260, 'underwaterDeep');
    this.bgDeep.setTint(0x7eaec9);

    this.waterOverlay = this.add.tileSprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 'waterOverlaySprite').setAlpha(0.33);
    this.darkOverlay = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x0b1f31, 0.42);

    this.waveBandA = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.waveBandB = this.add.graphics().setScrollFactor(0).setDepth(21);

    const trashKeys = ['trash1', 'trash2', 'trash3', 'trash4'];
    this.decorTrash = [];
    for (let i = 0; i < 12; i++) {
      const key = trashKeys[i % trashKeys.length];
      const sprite = this.add.image(
        Phaser.Math.Between(20, GAME_WIDTH - 20),
        Phaser.Math.Between(180, GAME_HEIGHT + 60),
        key
      ).setScale(1.7).setAlpha(0.7);
      sprite.floatOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.decorTrash.push(sprite);
    }

    const fishKeys = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5'];
    this.creatures = [];
    for (let i = 0; i < 4; i++) {
      const key = fishKeys[i % fishKeys.length];
      const fish = this.add.image(
        Phaser.Math.Between(100, GAME_WIDTH - 100),
        Phaser.Math.Between(220, GAME_HEIGHT - 90),
        key
      ).setScale(1.5);
      fish.speed = Phaser.Math.FloatBetween(16, 34);
      fish.dir = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
      fish.setFlipX(fish.dir < 0);
      this.creatures.push(fish);
    }

    this.bubbles = this.add.particles(0, 0, 'bubbleCollectible', {
      x: { min: 10, max: GAME_WIDTH - 10 },
      y: GAME_HEIGHT + 10,
      speedY: { min: -42, max: -18 },
      speedX: { min: -5, max: 5 },
      lifespan: { min: 1800, max: 2800 },
      frequency: 190,
      quantity: 1,
      scale: { start: 1.2, end: 0.5 },
      alpha: { start: 0, end: 0.72 }
    });

    document.dispatchEvent(new CustomEvent(this.uiEventName, { detail: { open: true } }));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.dispatchEvent(new CustomEvent(this.uiEventName, { detail: { open: false } }));
    });
  }

  update(_, delta) {
    const dt = delta / 1000;

    this.bgShallow.tilePositionX += 0.2;
    this.bgDeep.tilePositionX += 0.32;
    this.waterOverlay.tilePositionX += 0.24;

    const time = this.time.now * 0.001;
    drawWaveBand(this.waveBandA, GAME_WIDTH, GAME_HEIGHT, time, {
      fillColor: 0x2eaed7,
      fillAlpha: 0.12,
      lineColor: 0xcaf8ff,
      lineAlpha: 0.58,
      lineWidth: 2,
      sampleStep: 10,
      waveConfig: {
        baseY: 180,
        crestFrequency: 0.03,
        crestSpeed: 1.7,
        crestSharpness: 2.8,
        crestAmplitude: 4,
        terms: [
          { amplitude: 8, frequency: 0.013, speed: 1.15, phase: 0.3 },
          { amplitude: 5, frequency: 0.029, speed: -0.95, phase: 1.6 }
        ]
      }
    });

    drawWaveBand(this.waveBandB, GAME_WIDTH, GAME_HEIGHT, time + 0.7, {
      fillColor: 0x1d84ac,
      fillAlpha: 0.08,
      lineColor: 0x8bddff,
      lineAlpha: 0.45,
      lineWidth: 1,
      sampleStep: 12,
      waveConfig: {
        baseY: 220,
        crestFrequency: 0.02,
        crestSpeed: 1.1,
        crestSharpness: 2.1,
        crestAmplitude: 3,
        terms: [
          { amplitude: 6, frequency: 0.011, speed: 0.8, phase: 0.9 },
          { amplitude: 3, frequency: 0.025, speed: -1.1, phase: -0.2 }
        ]
      }
    });

    for (const sprite of this.decorTrash) {
      sprite.y -= 8 * dt;
      sprite.x += Math.sin(this.time.now * 0.0014 + sprite.floatOffset) * 0.2;
      if (sprite.y < -18) {
        sprite.y = Phaser.Math.Between(GAME_HEIGHT + 10, GAME_HEIGHT + 130);
      }
    }

    for (const fish of this.creatures) {
      fish.x += fish.speed * fish.dir * dt;
      fish.y += Math.sin(this.time.now * 0.003 + fish.x * 0.02) * 0.08;

      if (fish.x < -40 || fish.x > GAME_WIDTH + 40) {
        fish.dir *= -1;
        fish.setFlipX(fish.dir < 0);
      }
    }
  }

  transitionToGame() {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(520, () => {
      this.scene.start('GameScene');
    });
  }
}
