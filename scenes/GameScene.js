import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';
import { currentField, drawWaveBand } from './waterMath.js';

const WORLD_PLAY_WIDTH = 1200;
const WORLD_PLAY_HEIGHT = 3600;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.score = 0;
    this.depthProgress = 0;
    this.lives = 3;
    this.invulnerableTime = 0;
    this.isEnding = false;
    this.spawnPoint = { x: 120, y: 460 };
  }

  preload() {
    this.load.image('beachSurface', 'assets/backgrounds/beach_surface.png');
    this.load.image('underwaterShallow', 'assets/backgrounds/underwater_shallow.png');
    this.load.image('underwaterDeep', 'assets/backgrounds/underwater_deep.png');

    this.load.image('player', 'assets/sprites/player.png');
    this.load.image('platformRock', 'assets/sprites/platform_rock.png');
    this.load.image('bubbleCollectible', 'assets/sprites/bubble_collectible.png');
    this.load.image('waterOverlaySprite', 'assets/sprites/water_overlay.png');

    this.load.image('fish1', 'assets/sprites/fish1.png');
    this.load.image('fish2', 'assets/sprites/fish2.png');
    this.load.image('fish3', 'assets/sprites/fish3.png');
    this.load.image('fish4', 'assets/sprites/fish4.png');
    this.load.image('fish5', 'assets/sprites/fish5.png');

    this.load.image('trash1', 'assets/sprites/trash1.png');
    this.load.image('trash2', 'assets/sprites/trash2.png');
    this.load.image('trash3', 'assets/sprites/trash3.png');
    this.load.image('trash4', 'assets/sprites/trash4.png');
  }

  create() {
    this.cameras.main.fadeIn(460, 0, 0, 0);

    this.physics.world.gravity.y = 470;
    this.physics.world.setBounds(0, 0, WORLD_PLAY_WIDTH, WORLD_PLAY_HEIGHT);

    this.createParallaxBackground();
    this.createPlatforms();
    this.createPlayer();
    this.createTrashObstacles();
    this.createCollectibles();
    this.createEnemies();
    this.createFishLife();
    this.createBubbleEffects();
    this.createGoalZone();
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

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, 0, 40);
    this.cameras.main.setBounds(0, 0, WORLD_PLAY_WIDTH, WORLD_PLAY_HEIGHT);

    this.startUnderwaterAudio();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopUnderwaterAudio();
      document.dispatchEvent(new CustomEvent('risingtide:menu-state', { detail: { open: false } }));
    });
  }

  update(_, delta) {
    if (this.isEnding) return;

    const dt = delta / 1000;

    this.updateDepthByVerticalPosition();
    this.handlePlayerInput();
    this.applyCurrentToPlayer(dt);
    this.updateParallaxLayers();
    this.updateWaterMathOverlay();
    this.updateTrashDrift(dt);
    this.updateEnemyMotion(dt);
    this.updateFishMotion(dt);
    this.updateMoodByDepth();
    this.updateUnderwaterAudio();

    this.invulnerableTime = Math.max(0, this.invulnerableTime - dt);
    this.player.setAlpha(this.invulnerableTime > 0 ? 0.65 : 1);

    this.hudText.setText(`Score ${this.score}   Depth ${Math.floor(this.depthProgress * 100)}%   Lives ${this.lives}`);

    if (this.player.y > WORLD_PLAY_HEIGHT - 20) {
      this.damagePlayer(this.player.x, this.player.y - 30);
    }
  }

  createParallaxBackground() {
    this.farLayer = this.add.tileSprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 'beachSurface').setScrollFactor(0.06, 0.04);
    this.midLayer = this.add.tileSprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 'underwaterShallow').setScrollFactor(0.12, 0.12);
    this.nearLayer = this.add.tileSprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 'underwaterDeep').setScrollFactor(0.2, 0.22);

    this.waterTint = this.add.tileSprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 'waterOverlaySprite')
      .setScrollFactor(0)
      .setAlpha(0.22)
      .setDepth(60);

    this.depthOverlay = this.add.rectangle(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT, 0x081a28, 0)
      .setScrollFactor(0)
      .setDepth(70);

    this.waveMathA = this.add.graphics().setScrollFactor(0).setDepth(61);
    this.waveMathB = this.add.graphics().setScrollFactor(0).setDepth(62);
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();

    // Starting platform
    for (let i = 0; i < 5; i++) {
      const tile = this.platforms.create(90 + i * 64, 510, 'platformRock').setScale(2);
      tile.refreshBody();
    }

    // Descending path: deeper means tighter platform sizes and spacing.
    let y = 430;
    let x = 260;
    while (y < WORLD_PLAY_HEIGHT - 170) {
      const depthRatio = Phaser.Math.Clamp(y / WORLD_PLAY_HEIGHT, 0, 1);
      const tileCount = Math.max(2, 5 - Math.floor(depthRatio * 3));
      const jumpX = Phaser.Math.Between(-220, 220);
      x = Phaser.Math.Clamp(x + jumpX, 100, WORLD_PLAY_WIDTH - 220);
      const verticalStep = Phaser.Math.Between(120, 165) + Math.floor(depthRatio * 30);

      for (let i = 0; i < tileCount; i++) {
        const tile = this.platforms.create(x + i * 64, y, 'platformRock').setScale(2);
        tile.refreshBody();
      }

      y += verticalStep;
    }
  }

  createPlayer() {
    this.player = this.physics.add.sprite(this.spawnPoint.x, this.spawnPoint.y, 'player').setScale(2);
    this.player.setCollideWorldBounds(true);
    this.player.setSize(14, 14);
    this.player.body.setOffset(1, 1);
    this.player.body.setDragX(520);

    this.physics.add.collider(this.player, this.platforms);
  }

  createTrashObstacles() {
    const trashKeys = ['trash1', 'trash2', 'trash3', 'trash4'];

    this.trashGroup = this.physics.add.group({
      allowGravity: false,
      collideWorldBounds: true,
      bounceX: 1,
      bounceY: 1
    });

    for (let i = 0; i < 30; i++) {
      const key = trashKeys[i % trashKeys.length];
      const depthRatio = i / 29;
      const trash = this.trashGroup.create(
        Phaser.Math.Between(80, WORLD_PLAY_WIDTH - 80),
        Phaser.Math.Between(580, WORLD_PLAY_HEIGHT - 170),
        key
      ).setScale(1.7 + depthRatio * 0.2);

      trash.setVelocity(Phaser.Math.Between(-34, 34), Phaser.Math.Between(-24, 18));
      trash.setDrag(5, 4);
      trash.waveOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      trash.setCircle(6, 2, 2);
    }

    this.physics.add.overlap(this.player, this.trashGroup, this.handleTrashCollision, null, this);
  }

  createCollectibles() {
    this.collectibles = this.physics.add.group({ allowGravity: false, immovable: true });

    for (let i = 0; i < 40; i++) {
      const item = this.collectibles.create(
        Phaser.Math.Between(70, WORLD_PLAY_WIDTH - 70),
        Phaser.Math.Between(620, WORLD_PLAY_HEIGHT - 160),
        'bubbleCollectible'
      ).setScale(1.4);

      item.baseY = item.y;
      item.wobble = Phaser.Math.FloatBetween(0, Math.PI * 2);
      item.scoreValue = 8;
    }

    this.physics.add.overlap(this.player, this.collectibles, this.collectBubble, null, this);
  }

  createEnemies() {
    const fishKeys = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5'];

    this.enemies = this.physics.add.group({
      allowGravity: false,
      immovable: true
    });

    for (let i = 0; i < 14; i++) {
      const key = fishKeys[i % fishKeys.length];
      const y = Phaser.Math.Between(700, WORLD_PLAY_HEIGHT - 180);
      const enemy = this.enemies.create(
        Phaser.Math.Between(100, WORLD_PLAY_WIDTH - 100),
        y,
        key
      ).setScale(1.5).setTint(0x9cc7dd);

      enemy.patrolSpeed = Phaser.Math.Between(45, 95);
      enemy.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
      enemy.originY = y;
      enemy.waveOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      enemy.setFlipX(enemy.direction < 0);
    }

    this.physics.add.overlap(this.player, this.enemies, this.handleEnemyCollision, null, this);
  }

  createFishLife() {
    const fishKeys = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5'];
    this.fishGroup = this.add.group();

    for (let i = 0; i < 12; i++) {
      const fish = this.add.image(
        Phaser.Math.Between(90, WORLD_PLAY_WIDTH - 90),
        Phaser.Math.Between(560, WORLD_PLAY_HEIGHT - 90),
        fishKeys[i % fishKeys.length]
      ).setScale(1.15).setAlpha(0.55);

      fish.speed = Phaser.Math.FloatBetween(12, 24);
      fish.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
      fish.setFlipX(fish.direction < 0);
      fish.floatOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.fishGroup.add(fish);
    }
  }

  createBubbleEffects() {
    this.bubbleEmitter = this.add.particles(0, 0, 'bubbleCollectible', {
      x: { min: 0, max: WORLD_PLAY_WIDTH },
      y: WORLD_PLAY_HEIGHT + 8,
      speedY: { min: -55, max: -24 },
      speedX: { min: -8, max: 8 },
      frequency: 90,
      quantity: 1,
      lifespan: { min: 1400, max: 2600 },
      scale: { start: 1.05, end: 0.4 },
      alpha: { start: 0, end: 0.8 }
    });
  }

  createGoalZone() {
    this.goal = this.add.rectangle(WORLD_PLAY_WIDTH * 0.5, WORLD_PLAY_HEIGHT - 120, 320, 80, 0x53e0ff, 0.18);
    this.physics.add.existing(this.goal, true);

    this.goalLabel = this.add.text(WORLD_PLAY_WIDTH * 0.5, WORLD_PLAY_HEIGHT - 120, 'ABYSS FLOOR', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#c5f3ff',
      stroke: '#103244',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.physics.add.overlap(this.player, this.goal, () => this.winGame(), null, this);
  }

  createHud() {
    this.hudText = this.add.text(14, 14, 'Score 0   Depth 0%   Lives 3', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#effaff',
      stroke: '#0e2838',
      strokeThickness: 4
    }).setScrollFactor(0).setDepth(100);
  }

  updateDepthByVerticalPosition() {
    const travel = WORLD_PLAY_HEIGHT - GAME_HEIGHT;
    this.depthProgress = Phaser.Math.Clamp(this.cameras.main.scrollY / travel, 0, 1);
  }

  handlePlayerInput() {
    const leftPressed = this.controls.left.isDown || this.controls.a.isDown;
    const rightPressed = this.controls.right.isDown || this.controls.d.isDown;
    const jumpPressed = this.controls.up.isDown || this.controls.w.isDown || Phaser.Input.Keyboard.JustDown(this.controls.space);

    // Gets harder with depth: less horizontal control and weaker jump.
    const speed = Phaser.Math.Linear(180, 110, this.depthProgress);
    const jumpPower = Phaser.Math.Linear(-320, -235, this.depthProgress);

    if (leftPressed) {
      this.player.setVelocityX(-speed);
      this.player.setFlipX(true);
    } else if (rightPressed) {
      this.player.setVelocityX(speed);
      this.player.setFlipX(false);
    }

    if (jumpPressed && this.player.body.blocked.down) {
      this.player.setVelocityY(jumpPower);
      this.playPlink(280, 0.03);
    }

    this.player.setAngle(this.player.body.velocity.x * 0.012);
  }

  applyCurrentToPlayer(dt) {
    const flow = currentField(this.player.x, this.player.y, this.time.now * 0.001);

    // Deeper layers have stronger currents.
    const currentScale = Phaser.Math.Linear(0.012, 0.026, this.depthProgress);
    this.player.body.velocity.x += flow.x * currentScale * dt * 60;
    this.player.body.velocity.y += flow.y * currentScale * 0.8 * dt * 60;
  }

  updateParallaxLayers() {
    const cameraX = this.cameras.main.scrollX;
    const cameraY = this.cameras.main.scrollY;

    this.farLayer.tilePositionX = cameraX * 0.1;
    this.midLayer.tilePositionX = cameraX * 0.22;
    this.nearLayer.tilePositionX = cameraX * 0.4;

    this.farLayer.tilePositionY = cameraY * 0.06;
    this.midLayer.tilePositionY = cameraY * 0.14;
    this.nearLayer.tilePositionY = cameraY * 0.24;

    this.waterTint.tilePositionX = cameraX * 0.5;
    this.waterTint.tilePositionY = cameraY * 0.18;
  }

  updateWaterMathOverlay() {
    const time = this.time.now * 0.001;
    const baseA = 165 + this.depthProgress * 70;
    const baseB = 225 + this.depthProgress * 85;

    drawWaveBand(this.waveMathA, GAME_WIDTH, GAME_HEIGHT, time, {
      fillColor: 0x278fb8,
      fillAlpha: 0.12 + this.depthProgress * 0.1,
      lineColor: 0xa9eeff,
      lineAlpha: 0.55,
      lineWidth: 1,
      sampleStep: 10,
      waveConfig: {
        baseY: baseA,
        crestFrequency: 0.03,
        crestSpeed: 1.6,
        crestSharpness: 2.8,
        crestAmplitude: 4 + this.depthProgress * 2,
        terms: [
          { amplitude: 10 + this.depthProgress * 3, frequency: 0.014, speed: 1.1, phase: 0.5 },
          { amplitude: 6, frequency: 0.027, speed: -0.9, phase: 1.2 },
          { amplitude: 2, frequency: 0.049, speed: 2.0, phase: -0.4 }
        ]
      }
    });

    drawWaveBand(this.waveMathB, GAME_WIDTH, GAME_HEIGHT, time + 1.1, {
      fillColor: 0x1b6f95,
      fillAlpha: 0.09 + this.depthProgress * 0.08,
      lineColor: 0x7fd6f5,
      lineAlpha: 0.43,
      lineWidth: 1,
      sampleStep: 12,
      waveConfig: {
        baseY: baseB,
        crestFrequency: 0.021,
        crestSpeed: 1.1,
        crestSharpness: 2.2,
        crestAmplitude: 3 + this.depthProgress * 1.5,
        terms: [
          { amplitude: 8, frequency: 0.012, speed: 0.8, phase: 0.2 },
          { amplitude: 3 + this.depthProgress * 1.2, frequency: 0.024, speed: -1.2, phase: -0.6 }
        ]
      }
    });
  }

  updateTrashDrift(dt) {
    const time = this.time.now * 0.001;
    const deepFactor = Phaser.Math.Linear(1, 1.6, this.depthProgress);

    for (const trash of this.trashGroup.getChildren()) {
      const flow = currentField(trash.x, trash.y, time);
      trash.body.velocity.x += (Math.sin(time * 1.6 + trash.waveOffset) * 0.8 + flow.x * 0.035) * deepFactor;
      trash.body.velocity.y += (Math.cos(time * 1.9 + trash.waveOffset) * 0.5 + flow.y * 0.03) * deepFactor;
      trash.body.velocity.scale(1 - dt * 0.2);
    }

    for (const item of this.collectibles.getChildren()) {
      item.y = item.baseY + Math.sin(this.time.now * 0.004 + item.wobble) * 3;
      item.angle = Math.sin(this.time.now * 0.002 + item.wobble) * 6;
    }
  }

  updateEnemyMotion(dt) {
    for (const enemy of this.enemies.getChildren()) {
      enemy.x += enemy.patrolSpeed * enemy.direction * dt;
      enemy.y = enemy.originY + Math.sin(this.time.now * 0.003 + enemy.waveOffset) * 8;

      if (enemy.x < 70 || enemy.x > WORLD_PLAY_WIDTH - 70) {
        enemy.direction *= -1;
        enemy.setFlipX(enemy.direction < 0);
      }
    }
  }

  updateFishMotion(dt) {
    for (const fish of this.fishGroup.getChildren()) {
      fish.x += fish.speed * fish.direction * dt;
      fish.y += Math.sin(this.time.now * 0.002 + fish.floatOffset) * 0.08;

      if (fish.x < 60 || fish.x > WORLD_PLAY_WIDTH - 60) {
        fish.direction *= -1;
        fish.setFlipX(fish.direction < 0);
      }
    }
  }

  updateMoodByDepth() {
    this.depthOverlay.setAlpha(0.12 + this.depthProgress * 0.5);
    this.waterTint.setAlpha(0.22 + this.depthProgress * 0.28);

    const tintColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xffffff),
      Phaser.Display.Color.ValueToColor(0x6a9fbe),
      100,
      Math.floor(this.depthProgress * 100)
    );

    const tint = Phaser.Display.Color.GetColor(tintColor.r, tintColor.g, tintColor.b);
    this.farLayer.setTint(tint);
    this.midLayer.setTint(tint);
    this.nearLayer.setTint(tint);
  }

  handleTrashCollision(player, trash) {
    if (this.invulnerableTime > 0) return;

    const push = new Phaser.Math.Vector2(player.x - trash.x, player.y - trash.y).normalize().scale(120);
    player.body.velocity.x += push.x;
    player.body.velocity.y += push.y * 0.5;
    player.body.velocity.scale(0.8);

    this.playPlink(170, 0.04);
    this.damagePlayer(player.x, player.y);
  }

  handleEnemyCollision(player, enemy) {
    if (this.invulnerableTime > 0) return;

    const push = new Phaser.Math.Vector2(player.x - enemy.x, player.y - enemy.y).normalize().scale(180);
    player.body.velocity.x += push.x;
    player.body.velocity.y += push.y - 90;

    this.playPlink(140, 0.05);
    this.damagePlayer(player.x, player.y);
  }

  damagePlayer(respawnX, respawnY) {
    if (this.invulnerableTime > 0 || this.isEnding) return;

    this.lives -= 1;
    this.invulnerableTime = 1.2;

    if (this.lives <= 0) {
      this.failGame();
      return;
    }

    const fallbackX = Phaser.Math.Clamp(respawnX, 80, WORLD_PLAY_WIDTH - 80);
    const fallbackY = Math.max(220, respawnY - 120);

    this.player.setPosition(fallbackX, fallbackY);
    this.player.setVelocity(0, 0);
  }

  collectBubble(_, item) {
    item.disableBody(true, true);
    this.score += item.scoreValue;
    this.playPlink(510, 0.024);

    this.time.delayedCall(2200, () => {
      item.enableBody(
        true,
        Phaser.Math.Between(70, WORLD_PLAY_WIDTH - 70),
        Phaser.Math.Between(620, WORLD_PLAY_HEIGHT - 160),
        true,
        true
      );
      item.baseY = item.y;
      item.wobble = Phaser.Math.FloatBetween(0, Math.PI * 2);
    });
  }

  winGame() {
    if (this.isEnding) return;
    this.isEnding = true;

    this.playPlink(620, 0.035);
    this.showEndScreen({
      title: 'YOU REACHED\nTHE ABYSS FLOOR',
      subtitle: 'The water swallowed the world, but you made it down.',
      panelColor: 0x04131d,
      titleColor: '#d8f6ff',
      strokeColor: '#0d2a3a'
    });
  }

  failGame() {
    this.isEnding = true;

    this.showEndScreen({
      title: 'LOST IN THE TIDE',
      subtitle: 'The current pulled you under this run.',
      panelColor: 0x1a0608,
      titleColor: '#ffd3d3',
      strokeColor: '#3a1012'
    });
  }

  showEndScreen(config) {
    const centerX = this.cameras.main.scrollX + GAME_WIDTH * 0.5;
    const centerY = this.cameras.main.scrollY + GAME_HEIGHT * 0.5;

    const backDrop = this.add.rectangle(
      centerX,
      centerY,
      GAME_WIDTH,
      GAME_HEIGHT,
      config.panelColor,
      0
    ).setDepth(200);

    const title = this.add.text(centerX, centerY - 80, config.title, {
      fontFamily: 'monospace',
      fontSize: '36px',
      align: 'center',
      color: config.titleColor,
      stroke: config.strokeColor,
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(210).setAlpha(0);

    const subtitle = this.add.text(centerX, centerY + 6, config.subtitle, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#d9edf7',
      stroke: '#102734',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5).setDepth(210).setAlpha(0);

    const playAgainButton = this.add.text(centerX, centerY + 84, 'PLAY AGAIN (ENTER / R)', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#e7fdff',
      backgroundColor: '#1f5f7a',
      padding: { left: 12, right: 12, top: 8, bottom: 8 }
    }).setOrigin(0.5).setDepth(211).setAlpha(0).setInteractive({ useHandCursor: true });

    const menuButton = this.add.text(centerX, centerY + 132, 'BACK TO MENU (M)', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f4f8fb',
      backgroundColor: '#324656',
      padding: { left: 10, right: 10, top: 6, bottom: 6 }
    }).setOrigin(0.5).setDepth(211).setAlpha(0).setInteractive({ useHandCursor: true });

    const pulseTarget = { value: 0 };
    this.tweens.add({
      targets: backDrop,
      alpha: 0.72,
      duration: 900,
      ease: 'Sine.Out'
    });

    this.tweens.add({
      targets: [title, subtitle, playAgainButton, menuButton],
      alpha: 1,
      duration: 500,
      delay: 700,
      ease: 'Sine.Out'
    });

    this.tweens.add({
      targets: pulseTarget,
      value: 1,
      duration: 900,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        const colorLerp = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0x1f5f7a),
          Phaser.Display.Color.ValueToColor(0x3f95b7),
          100,
          Math.floor(pulseTarget.value * 100)
        );
        const colorHex = Phaser.Display.Color.RGBToString(colorLerp.r, colorLerp.g, colorLerp.b, 0, '#');
        playAgainButton.setStyle({ backgroundColor: colorHex });
      }
    });

    const cleanupAnd = (targetScene) => {
      if (this._endChoiceLocked) return;
      this._endChoiceLocked = true;
      this.cameras.main.fadeOut(700, 0, 0, 0);
      this.time.delayedCall(740, () => {
        this.scene.start(targetScene);
      });
    };

    playAgainButton.on('pointerdown', () => cleanupAnd('GameScene'));
    menuButton.on('pointerdown', () => cleanupAnd('StartMenuScene'));

    // Keep end screen longer before controls become active.
    this.time.delayedCall(1800, () => {
      this.input.keyboard.once('keydown-ENTER', () => cleanupAnd('GameScene'));
      this.input.keyboard.once('keydown-R', () => cleanupAnd('GameScene'));
      this.input.keyboard.once('keydown-M', () => cleanupAnd('StartMenuScene'));
    });
  }

  startUnderwaterAudio() {
    this.audioContext = this.sound.context;
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const buffer = this.createNoiseBuffer(this.audioContext, 3.2, 0.2);
    this.underSource = this.audioContext.createBufferSource();
    this.underSource.buffer = buffer;
    this.underSource.loop = true;

    this.underFilter = this.audioContext.createBiquadFilter();
    this.underFilter.type = 'lowpass';
    this.underFilter.frequency.value = 340;

    this.underGain = this.audioContext.createGain();
    this.underGain.gain.value = 0;

    this.underSource.connect(this.underFilter);
    this.underFilter.connect(this.underGain);
    this.underGain.connect(this.audioContext.destination);
    this.underSource.start();
  }

  updateUnderwaterAudio() {
    if (!this.underGain || !this.audioContext) return;
    const targetVolume = 0.04 + this.depthProgress * 0.1;
    this.underGain.gain.linearRampToValueAtTime(targetVolume, this.audioContext.currentTime + 0.08);
  }

  stopUnderwaterAudio() {
    if (this.underSource) {
      this.underSource.stop();
    }
  }

  playPlink(frequency, gainLevel) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = gainLevel;

    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    oscillator.start(now);
    oscillator.stop(now + 0.21);
  }

  createNoiseBuffer(ctx, seconds, intensity) {
    const totalSamples = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, totalSamples, ctx.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex++) {
      channel[sampleIndex] = (Math.random() * 2 - 1) * intensity;
    }

    return buffer;
  }
}
