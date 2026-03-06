import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';

export class OpeningArtScene extends Phaser.Scene {
  constructor() {
    super('OpeningArtScene');
    this.exiting = false;
  }

  preload() {
    this.load.image('bgBeach', 'assets/backgrounds/bg_beach.png');
    this.load.image('bgShallow', 'assets/backgrounds/underwater_shallow.png');
    this.load.image('waterOverlay', 'assets/backgrounds/water_overlay.png');
    this.load.image('bubble', 'assets/sprites/bubble.png');
    this.load.image('creature', 'assets/sprites/creature.png');
  }

  create() {
    this.cameras.main.fadeIn(520, 0, 0, 0);

    this.beach = this.add.tileSprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 'bgBeach');
    this.shallowBand = this.add.tileSprite(GAME_WIDTH * 0.5, 300, GAME_WIDTH, 180, 'bgShallow').setAlpha(0.55);

    this.waveOverlay = this.add.tileSprite(GAME_WIDTH * 0.5, 276, GAME_WIDTH, 120, 'waterOverlay').setAlpha(0.28);

    this.clouds = [];
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.rectangle(
        Phaser.Math.Between(80, GAME_WIDTH - 80),
        Phaser.Math.Between(48, 120),
        Phaser.Math.Between(80, 130),
        Phaser.Math.Between(16, 24),
        0xe8f8ff,
        0.88
      );
      cloud.speed = Phaser.Math.FloatBetween(8, 16);
      cloud.wobble = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.clouds.push(cloud);
    }

    this.birds = [];
    for (let i = 0; i < 3; i++) {
      const bird = this.add.image(
        Phaser.Math.Between(120, GAME_WIDTH - 120),
        Phaser.Math.Between(54, 138),
        'creature'
      ).setScale(1).setAlpha(0.82).setTint(0xdff5ff);
      bird.flightSpeed = Phaser.Math.FloatBetween(14, 24);
      bird.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
      bird.setFlipX(bird.direction < 0);
      bird.wobble = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.birds.push(bird);
    }

    this.surfaceBubbles = this.add.particles(0, 0, 'bubble', {
      x: { min: 20, max: GAME_WIDTH - 20 },
      y: GAME_HEIGHT + 8,
      speedY: { min: -46, max: -18 },
      speedX: { min: -5, max: 5 },
      lifespan: { min: 1400, max: 2400 },
      frequency: 180,
      quantity: 1,
      scale: { start: 1.1, end: 0.4 },
      alpha: { start: 0, end: 0.6 }
    });

    this.tintOverlay = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x2b9dc8, 0);
    this.darkOverlay = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x071826, 0);

    this.add.text(GAME_WIDTH * 0.5, 92, 'THE RISING TIDE', {
      fontFamily: 'monospace',
      fontSize: '44px',
      color: '#eaf9ff',
      stroke: '#103345',
      strokeThickness: 6,
      align: 'center'
    }).setOrigin(0.5);

    this.prompt = this.add.text(GAME_WIDTH * 0.5, GAME_HEIGHT - 54, 'Press Any Key to Continue', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#d6f2ff',
      stroke: '#0c2838',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.startSurfaceAudio();

    this.input.keyboard.once('keydown', () => this.exitToMenu());
    this.input.once('pointerdown', () => this.exitToMenu());
    this.time.delayedCall(3600, () => this.exitToMenu());
  }

  update(_, delta) {
    const dt = delta / 1000;

    this.beach.tilePositionX += 0.02;
    this.shallowBand.tilePositionX += 0.09;
    this.waveOverlay.tilePositionX += 0.24;

    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      cloud.y += Math.sin(this.time.now * 0.001 + cloud.wobble) * 0.04;
      if (cloud.x - cloud.width * 0.5 > GAME_WIDTH + 8) {
        cloud.x = -cloud.width;
        cloud.y = Phaser.Math.Between(48, 124);
      }
    }

    for (const bird of this.birds) {
      bird.x += bird.flightSpeed * bird.direction * dt;
      bird.y += Math.sin(this.time.now * 0.004 + bird.wobble) * 0.18;
      if (bird.x < -32 || bird.x > GAME_WIDTH + 32) {
        bird.direction *= -1;
        bird.setFlipX(bird.direction < 0);
      }
    }

    this.prompt.setAlpha(0.6 + Math.sin(this.time.now * 0.006) * 0.4);
  }

  startSurfaceAudio() {
    this.audioContext = this.sound.context;
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const buffer = this.createNoiseBuffer(this.audioContext, 2.6, 0.18);
    this.surfaceSource = this.audioContext.createBufferSource();
    this.surfaceSource.buffer = buffer;
    this.surfaceSource.loop = true;

    this.surfaceFilter = this.audioContext.createBiquadFilter();
    this.surfaceFilter.type = 'highpass';
    this.surfaceFilter.frequency.value = 760;

    this.surfaceGain = this.audioContext.createGain();
    this.surfaceGain.gain.value = 0.08;

    this.surfaceSource.connect(this.surfaceFilter);
    this.surfaceFilter.connect(this.surfaceGain);
    this.surfaceGain.connect(this.audioContext.destination);
    this.surfaceSource.start();
  }

  createNoiseBuffer(ctx, seconds, intensity) {
    const count = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, count, ctx.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < count; i++) {
      channel[i] = (Math.random() * 2 - 1) * intensity;
    }

    return buffer;
  }

  exitToMenu() {
    if (this.exiting) return;
    this.exiting = true;

    this.tweens.add({ targets: this.tintOverlay, alpha: 0.2, duration: 320, ease: 'Sine.Out' });
    this.tweens.add({ targets: this.darkOverlay, alpha: 0.38, duration: 420, ease: 'Sine.Out' });

    this.cameras.main.fadeOut(520, 0, 0, 0);
    this.time.delayedCall(540, () => {
      if (this.surfaceSource) {
        this.surfaceSource.stop();
      }
      this.scene.start('StartMenuScene');
    });
  }
}
