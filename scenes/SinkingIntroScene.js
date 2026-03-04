import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';

const ASSET_PATHS = {
  bgBeach: 'assets/backgrounds/bg_beach.png',
  bgShallow: 'assets/backgrounds/bg_shallow.png',
  bgDeep: 'assets/backgrounds/bg_deep.png',
  waterOverlay: 'assets/backgrounds/water_overlay.png',
  player: 'assets/sprites/player.png',
  trash: 'assets/sprites/trash.png',
  bubble: 'assets/sprites/bubble.png'
};

export class SinkingIntroScene extends Phaser.Scene {
  constructor() {
    super('SinkingIntroScene');
    this.introProgress = 0;
    this.started = false;
  }

  preload() {
    this.load.image('bgBeach', ASSET_PATHS.bgBeach);
    this.load.image('bgShallow', ASSET_PATHS.bgShallow);
    this.load.image('bgDeep', ASSET_PATHS.bgDeep);
    this.load.image('waterOverlay', ASSET_PATHS.waterOverlay);
    this.load.image('player', ASSET_PATHS.player);
    this.load.image('trash', ASSET_PATHS.trash);
    this.load.image('bubble', ASSET_PATHS.bubble);
  }

  create() {
    this.cameras.main.fadeIn(600, 0, 0, 0);

    this.skyLayer = this.add.tileSprite(GAME_WIDTH * 0.5, 110, GAME_WIDTH, 220, 'bgBeach');
    this.shallowLayer = this.add.tileSprite(GAME_WIDTH * 0.5, 265, GAME_WIDTH, 190, 'bgShallow');
    this.deepLayer = this.add.tileSprite(GAME_WIDTH * 0.5, 430, GAME_WIDTH, 220, 'bgDeep').setAlpha(0.3);

    this.player = this.add.image(GAME_WIDTH * 0.5, 135, 'player').setScale(2);

    this.trashSprites = [];
    for (let i = 0; i < 8; i++) {
      const debris = this.add.image(
        Phaser.Math.Between(40, GAME_WIDTH - 40),
        Phaser.Math.Between(GAME_HEIGHT + 20, GAME_HEIGHT + 220),
        'trash'
      ).setScale(1.8);
      debris.floatOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      debris.baseX = debris.x;
      this.trashSprites.push(debris);
    }

    this.waterMask = this.add.tileSprite(GAME_WIDTH * 0.5, GAME_HEIGHT + 120, GAME_WIDTH, GAME_HEIGHT, 'waterOverlay').setAlpha(0.35);
    this.darkOverlay = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x0a1d2b, 0);

    this.bubbles = this.add.particles(0, 0, 'bubble', {
      x: { min: 10, max: GAME_WIDTH - 10 },
      y: GAME_HEIGHT + 8,
      speedY: { min: -60, max: -20 },
      speedX: { min: -8, max: 8 },
      lifespan: { min: 1400, max: 2600 },
      frequency: 140,
      quantity: 1,
      scale: { start: 1.3, end: 0.4 },
      alpha: { start: 0, end: 0.85 }
    });

    this.skipText = this.add.text(16, 14, 'Press SPACE to skip intro', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d7f3ff',
      stroke: '#0b1d2c',
      strokeThickness: 4
    }).setDepth(10);

    this.add.text(16, 34, 'The Rising Tide', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#bee9ff',
      stroke: '#0b1d2c',
      strokeThickness: 4
    }).setDepth(10);

    this.input.keyboard.once('keydown-SPACE', () => this.finishIntro());
    this.time.delayedCall(100, () => this.startAmbientIntro());
    this.time.delayedCall(6800, () => this.finishIntro());
    this.started = true;
  }

  update(_, delta) {
    if (!this.started) return;

    const dt = delta / 1000;
    this.introProgress = Phaser.Math.Clamp(this.introProgress + dt / 6.8, 0, 1);

    this.skyLayer.tilePositionX += 0.05;
    this.shallowLayer.tilePositionX += 0.12;
    this.deepLayer.tilePositionX += 0.18;

    this.player.y = Phaser.Math.Linear(135, 386, Phaser.Math.Easing.Sine.InOut(this.introProgress));
    this.player.x = GAME_WIDTH * 0.5 + Math.sin(this.time.now * 0.0025) * 12;

    this.waterMask.y = Phaser.Math.Linear(GAME_HEIGHT + 120, GAME_HEIGHT * 0.52, this.introProgress);
    this.waterMask.tilePositionX += 0.25;

    this.darkOverlay.setAlpha(Phaser.Math.Easing.Quadratic.In(this.introProgress) * 0.55);
    this.deepLayer.setAlpha(0.3 + this.introProgress * 0.65);

    for (const debris of this.trashSprites) {
      debris.y -= 22 * dt;
      debris.x = debris.baseX + Math.sin(this.time.now * 0.0018 + debris.floatOffset) * 14;

      if (debris.y < -20) {
        debris.y = Phaser.Math.Between(GAME_HEIGHT + 20, GAME_HEIGHT + 140);
      }
    }

    this.updateAmbientIntro();
  }

  startAmbientIntro() {
    this.audioContext = this.sound.context;
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const noiseBuffer = this.createNoiseBuffer(this.audioContext, 2.2, 0.2);
    this.introSource = this.audioContext.createBufferSource();
    this.introSource.buffer = noiseBuffer;
    this.introSource.loop = true;

    this.introFilter = this.audioContext.createBiquadFilter();
    this.introFilter.type = 'highpass';
    this.introFilter.frequency.value = 920;

    this.introGain = this.audioContext.createGain();
    this.introGain.gain.value = 0;

    this.introSource.connect(this.introFilter);
    this.introFilter.connect(this.introGain);
    this.introGain.connect(this.audioContext.destination);
    this.introSource.start();
  }

  updateAmbientIntro() {
    if (!this.introGain || !this.audioContext) return;
    const volume = Phaser.Math.Clamp(0.1 - this.introProgress * 0.08, 0.02, 0.1);
    this.introGain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.08);
  }

  createNoiseBuffer(ctx, seconds, intensity) {
    const totalSamples = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, totalSamples, ctx.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < totalSamples; i++) {
      channel[i] = (Math.random() * 2 - 1) * intensity;
    }

    return buffer;
  }

  finishIntro() {
    if (!this.scene.isActive()) return;

    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(620, () => {
      if (this.introSource) {
        this.introSource.stop();
      }
      this.scene.start('StartMenuScene');
    });
  }
}
