import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';
import { drawWaveBand } from './waterMath.js';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
    this.exiting = false;
    this.hasStartedSink = false;
    this.sinkProgress = 0;
  }

  preload() {
    this.load.image('beachSurface', 'assets/backgrounds/beach_surface.png');
    this.load.image('underwaterShallow', 'assets/backgrounds/underwater_shallow.png');
    this.load.image('underwaterDeep', 'assets/backgrounds/underwater_deep.png');
    this.load.image('waterOverlaySprite', 'assets/sprites/water_overlay.png');
    this.load.image('player', 'assets/sprites/player.png');

    this.load.image('fish1', 'assets/sprites/fish1.png');
    this.load.image('fish2', 'assets/sprites/fish2.png');
    this.load.image('fish3', 'assets/sprites/fish3.png');
    this.load.image('fish4', 'assets/sprites/fish4.png');
    this.load.image('fish5', 'assets/sprites/fish5.png');
    this.load.image('bubbleCollectible', 'assets/sprites/bubble_collectible.png');

    this.load.image('trash1', 'assets/sprites/trash1.png');
    this.load.image('trash2', 'assets/sprites/trash2.png');
    this.load.image('trash3', 'assets/sprites/trash3.png');
    this.load.image('trash4', 'assets/sprites/trash4.png');

    this.load.audio('waterBgm', 'assets/water.mp3');
  }

  create() {
    this.cameras.main.fadeIn(520, 0, 0, 0);

    const introWorldHeight = 1040;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, introWorldHeight);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, introWorldHeight);
    this.cameras.main.setScroll(0, 0);

    this.beach = this.add.tileSprite(GAME_WIDTH * 0.5, 270, GAME_WIDTH, GAME_HEIGHT, 'beachSurface');
    this.shallowBand = this.add.tileSprite(GAME_WIDTH * 0.5, 360, GAME_WIDTH, 180, 'underwaterShallow').setAlpha(0.32);
    this.waveOverlay = this.add.tileSprite(GAME_WIDTH * 0.5, 326, GAME_WIDTH, 130, 'waterOverlaySprite').setAlpha(0.12);

    this.surfaceWaveBand = this.add.graphics().setDepth(30);
    this.secondaryWaveBand = this.add.graphics().setDepth(31);

    this.underwaterLayer = this.add.tileSprite(GAME_WIDTH * 0.5, 740, GAME_WIDTH, 360, 'underwaterShallow').setAlpha(0.85);
    this.deepLayer = this.add.tileSprite(GAME_WIDTH * 0.5, 920, GAME_WIDTH, 320, 'underwaterDeep').setAlpha(0.95);
    this.transitionOverlay = this.add.rectangle(GAME_WIDTH * 0.5, 520, GAME_WIDTH, 34, 0xb8c8ce, 0.24);
    this.pollutionOverlay = this.add.rectangle(GAME_WIDTH * 0.5, 790, GAME_WIDTH, 520, 0x2b3f47, 0.1);

    this.clouds = [];
    for (let index = 0; index < 4; index++) {
      const cloud = this.add.rectangle(
        Phaser.Math.Between(70, GAME_WIDTH - 70),
        Phaser.Math.Between(45, 118),
        Phaser.Math.Between(90, 150),
        Phaser.Math.Between(16, 26),
        0xeaf8ff,
        0.85
      );
      cloud.speed = Phaser.Math.FloatBetween(8, 15);
      cloud.offset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.clouds.push(cloud);
    }

    this.playerVisual = this.add.image(GAME_WIDTH * 0.5, 310, 'player').setScale(2);

    const fishKeys = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5'];

    this.surfaceFish = [];
    for (let index = 0; index < 6; index++) {
      const key = fishKeys[index % fishKeys.length];
      const fish = this.add.image(
        Phaser.Math.Between(70, GAME_WIDTH - 70),
        Phaser.Math.Between(215, 285),
        key
      ).setScale(1.2);
      fish.speed = Phaser.Math.FloatBetween(12, 26);
      fish.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
      fish.setFlipX(fish.direction < 0);
      fish.offset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.surfaceFish.push(fish);
    }

    this.underwaterFish = [];
    for (let index = 0; index < 7; index++) {
      const key = fishKeys[index % fishKeys.length];
      const fish = this.add.image(
        Phaser.Math.Between(80, GAME_WIDTH - 80),
        Phaser.Math.Between(650, 980),
        key
      ).setScale(1.1).setTint(0x8dc5df).setAlpha(0.85);
      fish.speed = Phaser.Math.FloatBetween(10, 24);
      fish.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
      fish.setFlipX(fish.direction < 0);
      fish.offset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.underwaterFish.push(fish);
    }

    const trashKeys = ['trash1', 'trash2', 'trash3', 'trash4'];
    this.trashField = [];
    for (let index = 0; index < 16; index++) {
      const key = trashKeys[index % trashKeys.length];
      const trash = this.add.image(
        Phaser.Math.Between(30, GAME_WIDTH - 30),
        Phaser.Math.Between(610, 1010),
        key
      ).setScale(1.75).setAlpha(0.35);
      trash.floatOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.trashField.push(trash);
    }

    this.bubbles = this.add.particles(0, 0, 'bubbleCollectible', {
      x: { min: 10, max: GAME_WIDTH - 10 },
      y: { min: 560, max: 1020 },
      speedY: { min: -42, max: -18 },
      speedX: { min: -4, max: 4 },
      lifespan: { min: 1300, max: 2200 },
      frequency: 180,
      quantity: 1,
      scale: { start: 1.1, end: 0.35 },
      alpha: { start: 0, end: 0.65 }
    });

    this.tintOverlay = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x6d8f9e, 0)
      .setScrollFactor(0)
      .setDepth(80);

    this.darkOverlay = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x1f3138, 0)
      .setScrollFactor(0)
      .setDepth(81);

    // Silkscreen font is used for in-canvas retro/pixel text. Swap here if desired.
    this.titleText = this.add.text(GAME_WIDTH * 0.5, 88, 'THE RISING TIDE', {
      fontFamily: 'Silkscreen, monospace',
      fontSize: '44px',
      color: '#F0E5D8',
      stroke: '#4c5960',
      strokeThickness: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(90);

    this.prompt = this.add.text(GAME_WIDTH * 0.5, GAME_HEIGHT - 52, 'Press Any Key to Continue', {
      fontFamily: 'Silkscreen, monospace',
      fontSize: '17px',
      color: '#D8CBB3',
      stroke: '#4a555a',
      strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(90);

    this.subtitle = this.add.text(GAME_WIDTH * 0.5, GAME_HEIGHT - 28, 'A calm shore hides a darker world below.', {
      fontFamily: 'Silkscreen, monospace',
      fontSize: '12px',
      color: '#E0E0E0',
      stroke: '#46545a',
      strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(90);

    this.startSurfaceAudio();

    this.input.keyboard.once('keydown', () => this.exitToMenu());
    this.input.once('pointerdown', () => this.exitToMenu());

    // First linger on the pretty beach, then sink under the water.
    this.time.delayedCall(1600, () => this.startSinkSequence());
    this.time.delayedCall(6400, () => this.exitToMenu());
  }

  update(_, delta) {
    const dt = delta / 1000;

    this.beach.tilePositionX += 0.025;
    this.shallowBand.tilePositionX += 0.08;
    this.waveOverlay.tilePositionX += 0.22;
    this.underwaterLayer.tilePositionX += 0.11;
    this.deepLayer.tilePositionX += 0.18;

    const time = this.time.now * 0.001;
    const waterlineY = 286 + (this.hasStartedSink ? this.cameras.main.scrollY * 0.08 : 0);

    this.surfaceWaveBand.setPosition(0, 0);
    drawWaveBand(this.surfaceWaveBand, GAME_WIDTH, 560, time, {
      fillColor: 0x7fa3b2,
      fillAlpha: 0.16,
      lineColor: 0xd8e3e7,
      lineAlpha: 0.62,
      lineWidth: 2,
      sampleStep: 8,
      waveConfig: {
        baseY: waterlineY,
        crestFrequency: 0.032,
        crestSpeed: 1.9,
        crestSharpness: 3.2,
        crestAmplitude: 5,
        terms: [
          { amplitude: 10, frequency: 0.015, speed: 1.25, phase: 0.2 },
          { amplitude: 6, frequency: 0.028, speed: -0.85, phase: 1.4 },
          { amplitude: 3, frequency: 0.051, speed: 2.1, phase: -0.6 }
        ]
      }
    });

    drawWaveBand(this.secondaryWaveBand, GAME_WIDTH, 560, time + 0.9, {
      fillColor: 0x5d7a88,
      fillAlpha: 0.09,
      lineColor: 0xc0d6e4,
      lineAlpha: 0.44,
      lineWidth: 1,
      sampleStep: 10,
      waveConfig: {
        baseY: waterlineY + 24,
        crestFrequency: 0.022,
        crestSpeed: 1.4,
        crestSharpness: 2.4,
        crestAmplitude: 3,
        terms: [
          { amplitude: 7, frequency: 0.012, speed: 0.9, phase: 0.8 },
          { amplitude: 4, frequency: 0.024, speed: -1.2, phase: -0.3 }
        ]
      }
    });

    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      cloud.y += Math.sin(this.time.now * 0.001 + cloud.offset) * 0.04;
      if (cloud.x - cloud.width * 0.5 > GAME_WIDTH + 10) {
        cloud.x = -cloud.width;
        cloud.y = Phaser.Math.Between(45, 120);
      }
    }

    for (const fish of this.surfaceFish) {
      fish.x += fish.speed * fish.direction * dt;
      fish.y += Math.sin(this.time.now * 0.004 + fish.offset) * 0.2;
      if (fish.x < -24 || fish.x > GAME_WIDTH + 24) {
        fish.direction *= -1;
        fish.setFlipX(fish.direction < 0);
      }
    }

    for (const fish of this.underwaterFish) {
      fish.x += fish.speed * fish.direction * dt;
      fish.y += Math.sin(this.time.now * 0.003 + fish.offset) * 0.16;
      if (fish.x < -20 || fish.x > GAME_WIDTH + 20) {
        fish.direction *= -1;
        fish.setFlipX(fish.direction < 0);
      }
    }

    for (const trash of this.trashField) {
      trash.x += Math.sin(this.time.now * 0.0015 + trash.floatOffset) * 0.22;
      trash.y += Math.cos(this.time.now * 0.0012 + trash.floatOffset) * 0.08;
    }

    if (!this.hasStartedSink) {
      this.playerVisual.y = 310 + Math.sin(this.time.now * 0.003) * 3;
      this.titleText.y = 88 + Math.sin(this.time.now * 0.0018) * 1.5;
    } else {
      const cameraY = this.cameras.main.scrollY;
      this.playerVisual.y = 310 + cameraY + Math.sin(this.time.now * 0.004) * 2;
      this.sinkProgress = Phaser.Math.Clamp(cameraY / 300, 0, 1);

      for (const trash of this.trashField) {
        trash.setAlpha(0.35 + this.sinkProgress * 0.55);
      }

      this.pollutionOverlay.setAlpha(0.08 + this.sinkProgress * 0.33);
      this.tintOverlay.setAlpha(this.sinkProgress * 0.2);
      this.darkOverlay.setAlpha(this.sinkProgress * 0.34);
      this.subtitle.setText('Sinking... pollution and debris emerge in the tide.');
    }

    this.prompt.setAlpha(0.58 + Math.sin(this.time.now * 0.006) * 0.38);
  }

  startSinkSequence() {
    if (this.hasStartedSink || this.exiting) return;
    this.hasStartedSink = true;

    this.tweens.add({
      targets: this.cameras.main,
      scrollY: 300,
      duration: 3200,
      ease: 'Sine.InOut'
    });
  }

  startSurfaceAudio() {
    this.audioContext = this.sound.context;
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.surfaceMusic = this.sound.get('waterBgm') || this.sound.add('waterBgm', {
      loop: true,
      volume: 0.08
    });

    this.surfaceMusic.setVolume(0.08);
    if (!this.surfaceMusic.isPlaying) {
      this.surfaceMusic.play();
    }
  }

  exitToMenu() {
    if (this.exiting) return;
    this.exiting = true;

    this.tweens.add({ targets: this.tintOverlay, alpha: 0.28, duration: 300, ease: 'Sine.Out' });
    this.tweens.add({ targets: this.darkOverlay, alpha: 0.42, duration: 420, ease: 'Sine.Out' });
    this.cameras.main.fadeOut(520, 0, 0, 0);

    this.time.delayedCall(540, () => {
      this.scene.start('StartMenuScene');
    });
  }
}
