import { GAME_HEIGHT, GAME_WIDTH, WORLD_WIDTH } from './constants.js';

export class PlatformerScene extends Phaser.Scene {
  constructor() {
    super('PlatformerScene');
    this.score = 0;
    this.depthProgress = 0;
  }

  preload() {
    // Replace these placeholder assets with your production art using the same filenames.
    this.load.image('bgBeach', 'assets/backgrounds/bg_beach.png');
    this.load.image('bgShallow', 'assets/backgrounds/bg_shallow.png');
    this.load.image('bgDeep', 'assets/backgrounds/bg_deep.png');
    this.load.image('waterOverlay', 'assets/backgrounds/water_overlay.png');

    this.load.image('player', 'assets/sprites/player.png');
    this.load.image('trash', 'assets/sprites/trash.png');
    this.load.image('platform', 'assets/sprites/platform_rock.png');
    this.load.image('bubble', 'assets/sprites/bubble.png');
    this.load.image('coin', 'assets/sprites/coin.png');
    this.load.image('creature', 'assets/sprites/creature.png');
  }

  create() {
    this.cameras.main.fadeIn(450, 0, 0, 0);
    this.physics.world.gravity.y = 630;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.createParallaxBackground();
    this.createLevelGeometry();
    this.createPlayer();
    this.createObstacles();
    this.createCollectibles();
    this.createSeaCreatures();
    this.createEffects();
    this.createHud();

    this.controls = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE
    });

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, 0, 18);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.startGameAudio();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopGameAudio();
      document.dispatchEvent(new CustomEvent('risingtide:menu-state', { detail: { open: false } }));
    });
  }

  update(_, delta) {
    const dt = delta / 1000;

    this.handlePlayerMovement();
    this.updateParallax();
    this.updateTrashDrift(dt);
    this.updateCreatures(dt);
    this.updateDepthMood();
    this.updateGameAudio();

    this.hudText.setText(`Score ${this.score}   Depth ${Math.floor(this.depthProgress * 100)}%`);

    if (this.player.y > GAME_HEIGHT + 40) {
      this.respawnPlayer();
    }
  }

  createParallaxBackground() {
    this.bgBeach = this.add.tileSprite(GAME_WIDTH * 0.5, 100, GAME_WIDTH, 200, 'bgBeach').setScrollFactor(0.08, 0);
    this.bgShallow = this.add.tileSprite(GAME_WIDTH * 0.5, 265, GAME_WIDTH, 210, 'bgShallow').setScrollFactor(0.22, 0);
    this.bgDeep = this.add.tileSprite(GAME_WIDTH * 0.5, 430, GAME_WIDTH, 220, 'bgDeep').setScrollFactor(0.42, 0);

    this.waterTint = this.add.tileSprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 'waterOverlay')
      .setScrollFactor(0)
      .setAlpha(0.24);

    this.depthOverlay = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x0a1d2c, 0)
      .setScrollFactor(0)
      .setDepth(50);
  }

  createLevelGeometry() {
    this.platforms = this.physics.add.staticGroup();

    const segments = [
      { x: 160, y: 510, width: 260 },
      { x: 450, y: 470, width: 190 },
      { x: 720, y: 510, width: 250 },
      { x: 1010, y: 455, width: 170 },
      { x: 1240, y: 505, width: 210 },
      { x: 1540, y: 480, width: 220 },
      { x: 1860, y: 430, width: 170 },
      { x: 2080, y: 500, width: 230 },
      { x: 2380, y: 450, width: 190 },
      { x: 2620, y: 510, width: 210 },
      { x: 2920, y: 470, width: 220 },
      { x: 3220, y: 510, width: 260 }
    ];

    for (const segment of segments) {
      const tileCount = Math.round(segment.width / 64);
      for (let i = 0; i < tileCount; i++) {
        const tile = this.platforms.create(segment.x + i * 64, segment.y, 'platform').setScale(2);
        tile.refreshBody();
      }
    }
  }

  createPlayer() {
    this.player = this.physics.add.sprite(90, 420, 'player').setScale(2);
    this.player.setCollideWorldBounds(true);
    this.player.setSize(14, 14);
    this.player.body.setOffset(1, 1);

    this.physics.add.collider(this.player, this.platforms);
  }

  createObstacles() {
    this.trashGroup = this.physics.add.group({
      allowGravity: false,
      collideWorldBounds: true,
      bounceX: 1,
      bounceY: 1
    });

    for (let i = 0; i < 18; i++) {
      const trash = this.trashGroup.create(
        Phaser.Math.Between(200, WORLD_WIDTH - 140),
        Phaser.Math.Between(140, GAME_HEIGHT - 120),
        'trash'
      ).setScale(1.7);

      trash.setVelocity(Phaser.Math.Between(-22, 22), Phaser.Math.Between(-14, 14));
      trash.setDrag(4, 4);
      trash.waveOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      trash.setCircle(6, 2, 2);
    }

    this.physics.add.overlap(this.player, this.trashGroup, this.bumpIntoTrash, null, this);
  }

  createCollectibles() {
    this.collectibles = this.physics.add.group({ allowGravity: false, immovable: true });

    for (let i = 0; i < 24; i++) {
      const key = i % 3 === 0 ? 'bubble' : 'coin';
      const item = this.collectibles.create(
        Phaser.Math.Between(180, WORLD_WIDTH - 70),
        Phaser.Math.Between(140, GAME_HEIGHT - 130),
        key
      ).setScale(key === 'coin' ? 1.7 : 1.5);

      item.baseY = item.y;
      item.wobble = Phaser.Math.FloatBetween(0, Math.PI * 2);
      item.scoreValue = key === 'coin' ? 15 : 10;
    }

    this.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
  }

  createSeaCreatures() {
    this.creatures = this.add.group();

    for (let i = 0; i < 6; i++) {
      const fish = this.add.image(
        Phaser.Math.Between(200, WORLD_WIDTH - 50),
        Phaser.Math.Between(130, GAME_HEIGHT - 90),
        'creature'
      ).setScale(1.4);
      fish.speed = Phaser.Math.FloatBetween(16, 28);
      fish.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
      fish.setFlipX(fish.direction < 0);
      fish.floatOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.creatures.add(fish);
    }
  }

  createEffects() {
    this.bubbleEmitter = this.add.particles(0, 0, 'bubble', {
      x: { min: 0, max: WORLD_WIDTH },
      y: GAME_HEIGHT + 8,
      speedY: { min: -52, max: -20 },
      speedX: { min: -8, max: 8 },
      frequency: 120,
      quantity: 1,
      lifespan: { min: 1200, max: 2500 },
      scale: { start: 1.1, end: 0.45 },
      alpha: { start: 0, end: 0.8 }
    });
  }

  createHud() {
    this.hudText = this.add.text(14, 14, 'Score 0   Depth 0%', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f0faff',
      stroke: '#0d2a3c',
      strokeThickness: 4
    }).setScrollFactor(0).setDepth(100);
  }

  handlePlayerMovement() {
    const leftPressed = this.controls.left.isDown || this.controls.a.isDown;
    const rightPressed = this.controls.right.isDown || this.controls.d.isDown;
    const jumpPressed = this.controls.up.isDown || this.controls.w.isDown || Phaser.Input.Keyboard.JustDown(this.controls.space);

    const moveSpeed = 175;

    if (leftPressed) {
      this.player.setVelocityX(-moveSpeed);
      this.player.setFlipX(true);
    } else if (rightPressed) {
      this.player.setVelocityX(moveSpeed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(this.player.body.velocity.x * 0.9);
    }

    if (jumpPressed && this.player.body.blocked.down) {
      this.player.setVelocityY(-345);
      this.playBubbleSfx(310, 0.03);
    }

    this.player.setAngle(this.player.body.velocity.x * 0.01);
  }

  updateParallax() {
    const cameraX = this.cameras.main.scrollX;
    this.bgBeach.tilePositionX = cameraX * 0.12;
    this.bgShallow.tilePositionX = cameraX * 0.25;
    this.bgDeep.tilePositionX = cameraX * 0.48;
    this.waterTint.tilePositionX = cameraX * 0.6;
  }

  updateTrashDrift(dt) {
    for (const trash of this.trashGroup.getChildren()) {
      trash.body.velocity.x += Math.sin(this.time.now * 0.0016 + trash.waveOffset) * 0.6;
      trash.body.velocity.y += Math.cos(this.time.now * 0.0019 + trash.waveOffset) * 0.5;
      trash.body.velocity.scale(1 - dt * 0.2);
    }

    for (const item of this.collectibles.getChildren()) {
      item.y = item.baseY + Math.sin(this.time.now * 0.004 + item.wobble) * 3;
      item.angle = Math.sin(this.time.now * 0.002 + item.wobble) * 6;
    }
  }

  updateCreatures(dt) {
    for (const fish of this.creatures.getChildren()) {
      fish.x += fish.speed * fish.direction * dt;
      fish.y += Math.sin(this.time.now * 0.002 + fish.floatOffset) * 0.09;

      if (fish.x < 100 || fish.x > WORLD_WIDTH - 80) {
        fish.direction *= -1;
        fish.setFlipX(fish.direction < 0);
      }
    }
  }

  updateDepthMood() {
    const cameraX = this.cameras.main.scrollX;
    this.depthProgress = Phaser.Math.Clamp(cameraX / (WORLD_WIDTH - GAME_WIDTH), 0, 1);

    this.depthOverlay.setAlpha(0.1 + this.depthProgress * 0.42);
    this.waterTint.setAlpha(0.24 + this.depthProgress * 0.24);

    const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xffffff),
      Phaser.Display.Color.ValueToColor(0x82b9d8),
      100,
      Math.floor(this.depthProgress * 100)
    );
    const tintInt = Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b);

    this.bgBeach.setTint(tintInt);
    this.bgShallow.setTint(tintInt);
    this.bgDeep.setTint(tintInt);
  }

  bumpIntoTrash(player, trash) {
    const push = new Phaser.Math.Vector2(player.x - trash.x, player.y - trash.y).normalize().scale(130);
    player.body.velocity.x += push.x;
    player.body.velocity.y += push.y * 0.5;
    player.body.velocity.scale(0.75);

    this.playBubbleSfx(150, 0.04);
  }

  collectItem(_, item) {
    item.disableBody(true, true);
    this.score += item.scoreValue;
    this.playBubbleSfx(560, 0.025);

    this.time.delayedCall(1900, () => {
      item.enableBody(
        true,
        Phaser.Math.Between(180, WORLD_WIDTH - 70),
        Phaser.Math.Between(140, GAME_HEIGHT - 130),
        true,
        true
      );
      item.baseY = item.y;
      item.wobble = Phaser.Math.FloatBetween(0, Math.PI * 2);
    });
  }

  respawnPlayer() {
    this.player.setPosition(this.cameras.main.scrollX + 120, 250);
    this.player.setVelocity(0, 0);
  }

  startGameAudio() {
    this.audioContext = this.sound.context;
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const buffer = this.createNoiseBuffer(this.audioContext, 3.4, 0.21);
    this.underSource = this.audioContext.createBufferSource();
    this.underSource.buffer = buffer;
    this.underSource.loop = true;

    this.underFilter = this.audioContext.createBiquadFilter();
    this.underFilter.type = 'lowpass';
    this.underFilter.frequency.value = 320;

    this.underGain = this.audioContext.createGain();
    this.underGain.gain.value = 0;

    this.underSource.connect(this.underFilter);
    this.underFilter.connect(this.underGain);
    this.underGain.connect(this.audioContext.destination);

    this.underSource.start();
  }

  updateGameAudio() {
    if (!this.underGain || !this.audioContext) return;
    const target = 0.05 + this.depthProgress * 0.08;
    this.underGain.gain.linearRampToValueAtTime(target, this.audioContext.currentTime + 0.08);
  }

  stopGameAudio() {
    if (this.underSource) {
      this.underSource.stop();
    }
  }

  playBubbleSfx(frequency, gainLevel) {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = gainLevel;

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    const t = this.audioContext.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    osc.start(t);
    osc.stop(t + 0.21);
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
}
