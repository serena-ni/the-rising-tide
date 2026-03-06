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
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.wasGrounded = false;
    this.lastLandingFxTime = -9999;
    this.lowLifeHudPulse = 0;
    this.cameraZoomTween = null;
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

    this.physics.world.gravity.y = 390;
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

    this.mobileInput = { left: false, right: false, jumpHeld: false, jumpQueued: false };
    this.isTouchUi = this.sys.game.device.input.touch || window.innerWidth <= 920;
    if (this.isTouchUi) {
      this.createMobileControls();
    }

    this.cameras.main.startFollow(this.player, true, 0.11, 0.11, 0, 40);
    this.cameras.main.setBounds(0, 0, WORLD_PLAY_WIDTH, WORLD_PLAY_HEIGHT);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setDeadzone(130, 86);

    this.startUnderwaterAudio();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopUnderwaterAudio();
      document.dispatchEvent(new CustomEvent('risingtide:menu-state', { detail: { open: false } }));
      document.dispatchEvent(new CustomEvent('risingtide:end-state', { detail: { open: false } }));
    });
  }

  update(_, delta) {
    if (this.isEnding) return;

    const dt = delta / 1000;
    const isGrounded = this.player.body.blocked.down || this.player.body.touching.down;

    if (isGrounded) {
      if (!this.wasGrounded && this.player.body.velocity.y > 100) {
        this.onPlayerLanded();
      }
      this.coyoteTimer = 0.14;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

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
    this.updateHudPulse(dt);
    this.wasGrounded = isGrounded;

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
    this.tierYs = [];
    this.tierMeta = [];
    this.interTierBands = [];

    // Procedural tier prototype:
    // - varied anchors, widths and spacing to avoid predictable left-right cadence
    // - occasional split tiers for route choice
    // - reusable inter-tier metadata for hazard and collectible placement
    const tileSize = 64;
    const tierCount = 20;
    const tierStartY = 520;
    const laneAnchors = [52, 236, 430, 626];

    let currentY = tierStartY;
    let prevLane = 0;

    const chooseLane = (tierIndex) => {
      if (tierIndex === 0) return 0;

      const laneChoices = [0, 1, 2, 3].filter((lane) => lane !== prevLane);
      if (Math.random() < 0.35) {
        const step = Phaser.Math.Clamp(prevLane + Phaser.Math.Between(-1, 1), 0, 3);
        if (step !== prevLane) return step;
      }
      return Phaser.Utils.Array.GetRandom(laneChoices);
    };

    const placeSegment = (startX, tierY, tileCount, holeIndex = -1, holeLength = 0) => {
      for (let tileIndex = 0; tileIndex < tileCount; tileIndex++) {
        if (holeIndex >= 0 && tileIndex >= holeIndex && tileIndex < holeIndex + holeLength) {
          continue;
        }

        const tile = this.platforms.create(startX + tileIndex * tileSize, tierY, 'platformRock').setScale(2);
        tile.refreshBody();
      }
    };

    for (let tierIndex = 0; tierIndex < tierCount; tierIndex++) {
      const lane = chooseLane(tierIndex);
      prevLane = lane;

      const baseTiles = Phaser.Math.Between(6, 9);
      const tierWidth = baseTiles * tileSize;
      const tierY = currentY;
      const laneJitter = Phaser.Math.Between(-26, 26);
      const startX = Phaser.Math.Clamp(laneAnchors[lane] + laneJitter, 44, WORLD_PLAY_WIDTH - tierWidth - 44);
      const makeSplitTier = tierIndex > 2 && tierIndex < tierCount - 2 && Math.random() < 0.32;

      this.tierYs.push(tierY);
      this.tierMeta.push({ y: tierY, x: startX, width: tierWidth, lane });

      if (makeSplitTier && baseTiles >= 7) {
        const leftCount = Phaser.Math.Between(2, 3);
        const gapTiles = Phaser.Math.Between(2, 3);
        const rightCount = Phaser.Math.Between(2, 3);
        placeSegment(startX, tierY, leftCount);

        const rightStartX = startX + (leftCount + gapTiles) * tileSize;
        placeSegment(rightStartX, tierY, rightCount);
      } else if (baseTiles >= 7 && Math.random() < 0.22) {
        const holeIndex = Phaser.Math.Between(2, baseTiles - 3);
        const holeLength = Phaser.Math.Between(1, 2);
        placeSegment(startX, tierY, baseTiles, holeIndex, holeLength);
      } else {
        placeSegment(startX, tierY, baseTiles);
      }

      currentY += Phaser.Math.Between(118, 150);
    }

    for (let bandIndex = 0; bandIndex < this.tierMeta.length - 1; bandIndex++) {
      const currentTier = this.tierMeta[bandIndex];
      const nextTier = this.tierMeta[bandIndex + 1];
      const currentCenterX = currentTier.x + currentTier.width * 0.5;
      const nextCenterX = nextTier.x + nextTier.width * 0.5;

      this.interTierBands.push({
        top: currentTier.y + 22,
        bottom: nextTier.y - 30,
        centerX: Phaser.Math.Clamp((currentCenterX + nextCenterX) * 0.5, 90, WORLD_PLAY_WIDTH - 90),
        depthRatio: bandIndex / Math.max(1, this.tierMeta.length - 2)
      });
    }
  }

  createPlayer() {
    this.player = this.physics.add.sprite(this.spawnPoint.x, this.spawnPoint.y, 'player').setScale(2);
    this.player.setCollideWorldBounds(true);
    this.player.setSize(14, 14);
    this.player.body.setOffset(1, 1);
    this.player.body.setDragX(560);
    this.player.body.setMaxVelocity(260, 560);

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

    for (let bandIndex = 0; bandIndex < this.interTierBands.length; bandIndex++) {
      const band = this.interTierBands[bandIndex];
      const trashInBand = Phaser.Math.Between(1, band.depthRatio > 0.55 ? 3 : 2);

      for (let i = 0; i < trashInBand; i++) {
        const key = trashKeys[(bandIndex + i) % trashKeys.length];
        const spawnX = Phaser.Math.Clamp(
          band.centerX + Phaser.Math.Between(-250, 250),
          80,
          WORLD_PLAY_WIDTH - 80
        );

        const trash = this.trashGroup.create(
          spawnX,
          Phaser.Math.Between(band.top, band.bottom),
          key
        ).setScale(1.62 + band.depthRatio * 0.28);

        trash.setVelocity(
          Phaser.Math.Between(-28, 28) + band.depthRatio * Phaser.Math.Between(-14, 14),
          Phaser.Math.Between(-20, 14)
        );
        trash.setDrag(6, 5);
        trash.waveOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
        trash.setCircle(6, 2, 2);
      }
    }

    this.physics.add.overlap(this.player, this.trashGroup, this.handleTrashCollision, null, this);
  }

  createCollectibles() {
    this.collectibles = this.physics.add.group({ allowGravity: false, immovable: true });

    for (let bandIndex = 0; bandIndex < this.interTierBands.length; bandIndex++) {
      const band = this.interTierBands[bandIndex];
      const collectibleCount = Phaser.Math.Between(1, band.depthRatio < 0.45 ? 3 : 2);

      for (let i = 0; i < collectibleCount; i++) {
        const spawnX = Phaser.Math.Clamp(
          band.centerX + Phaser.Math.Between(-300, 300),
          70,
          WORLD_PLAY_WIDTH - 70
        );

        const item = this.collectibles.create(
          spawnX,
          Phaser.Math.Between(band.top + 6, band.bottom - 6),
          'bubbleCollectible'
        ).setScale(1.35 + (1 - band.depthRatio) * 0.16);

        item.baseY = item.y;
        item.wobble = Phaser.Math.FloatBetween(0, Math.PI * 2);
        item.scoreValue = band.depthRatio > 0.7 ? 10 : 8;
      }
    }

    this.physics.add.overlap(this.player, this.collectibles, this.collectBubble, null, this);
  }

  createEnemies() {
    const fishKeys = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5'];

    this.enemies = this.physics.add.group({
      allowGravity: false,
      immovable: true
    });

    for (let bandIndex = 1; bandIndex < this.interTierBands.length; bandIndex++) {
      const band = this.interTierBands[bandIndex];
      const spawnChance = Phaser.Math.Linear(0.38, 0.82, band.depthRatio);
      if (Math.random() > spawnChance) continue;

      const enemyCount = Math.random() < 0.22 && band.depthRatio > 0.55 ? 2 : 1;

      for (let i = 0; i < enemyCount; i++) {
        const key = fishKeys[(bandIndex + i) % fishKeys.length];
        const y = Phaser.Math.Between(band.top + 8, band.bottom - 8);
        const enemy = this.enemies.create(
          Phaser.Math.Clamp(band.centerX + Phaser.Math.Between(-240, 240), 100, WORLD_PLAY_WIDTH - 100),
          y,
          key
        ).setScale(1.42 + band.depthRatio * 0.14).setTint(0x8ea3ad);

        enemy.patrolSpeed = Phaser.Math.Between(48, 86) + band.depthRatio * 18;
        enemy.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
        enemy.originY = y;
        enemy.waveOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
        enemy.setFlipX(enemy.direction < 0);
      }
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

    this.landingEmitter = this.add.particles(0, 0, 'bubbleCollectible', {
      speed: { min: 45, max: 140 },
      angle: { min: 250, max: 290 },
      gravityY: 160,
      lifespan: { min: 260, max: 520 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.85, end: 0 },
      quantity: 8,
      emitting: false
    });

    this.pickupEmitter = this.add.particles(0, 0, 'bubbleCollectible', {
      speed: { min: 30, max: 120 },
      angle: { min: 200, max: 340 },
      gravityY: 45,
      lifespan: { min: 300, max: 520 },
      scale: { start: 1.15, end: 0 },
      alpha: { start: 0.92, end: 0 },
      quantity: 10,
      emitting: false
    });
  }

  createGoalZone() {
    this.goal = this.add.rectangle(WORLD_PLAY_WIDTH * 0.5, WORLD_PLAY_HEIGHT - 120, 320, 80, 0x53e0ff, 0.18);
    this.physics.add.existing(this.goal, true);

    this.goalLabel = this.add.text(WORLD_PLAY_WIDTH * 0.5, WORLD_PLAY_HEIGHT - 120, 'ABYSS FLOOR', {
      fontFamily: 'Silkscreen, monospace',
      fontSize: '16px',
      color: '#D8E3E7',
      stroke: '#2d424c',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.physics.add.overlap(this.player, this.goal, () => this.winGame(), null, this);
  }

  createHud() {
    this.hudText = this.add.text(14, 14, 'Score 0   Depth 0%   Lives 3', {
      fontFamily: 'Silkscreen, monospace',
      fontSize: '18px',
      color: '#C0D6E4',
      stroke: '#253a45',
      strokeThickness: 4
    }).setScrollFactor(0).setDepth(100);
  }

  updateDepthByVerticalPosition() {
    const travel = WORLD_PLAY_HEIGHT - GAME_HEIGHT;
    this.depthProgress = Phaser.Math.Clamp(this.cameras.main.scrollY / travel, 0, 1);
  }

  handlePlayerInput() {
    const leftPressed = this.controls.left.isDown || this.controls.a.isDown || this.mobileInput.left;
    const rightPressed = this.controls.right.isDown || this.controls.d.isDown || this.mobileInput.right;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.controls.up)
      || Phaser.Input.Keyboard.JustDown(this.controls.w)
      || Phaser.Input.Keyboard.JustDown(this.controls.space)
      || this.mobileInput.jumpQueued;
    const jumpHeld = this.controls.up.isDown || this.controls.w.isDown || this.controls.space.isDown || this.mobileInput.jumpHeld;

    this.mobileInput.jumpQueued = false;

    const speed = Phaser.Math.Linear(180, 130, this.depthProgress);
    const jumpPower = Phaser.Math.Linear(-314, -248, this.depthProgress);
    const accel = speed * 7.6;

    if (leftPressed) {
      this.player.setAccelerationX(-accel);
      this.player.setFlipX(true);
    } else if (rightPressed) {
      this.player.setAccelerationX(accel);
      this.player.setFlipX(false);
    } else {
      this.player.setAccelerationX(0);
    }

    if (jumpPressed) {
      this.jumpBufferTimer = 0.14;
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.player.setVelocityY(jumpPower);
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.playPlink(280, 0.03);
      this.tweens.add({
        targets: this.player,
        scaleX: 1.82,
        scaleY: 2.16,
        duration: 80,
        yoyo: true,
        ease: 'Sine.Out'
      });
    }

    if (!jumpHeld && this.player.body.velocity.y < -50) {
      this.player.body.velocity.y += 11;
    }

    this.player.setAngle(Phaser.Math.Clamp(this.player.body.velocity.x * 0.018, -12, 12));
  }

  createMobileControls() {
    const baseY = GAME_HEIGHT - 66;
    const leftX = 78;
    const rightX = 162;
    const jumpX = GAME_WIDTH - 84;

    this.mobileControls = this.add.container(0, 0).setScrollFactor(0).setDepth(170);

    const makeButton = (x, y, label, key) => {
      const buttonBg = this.add.circle(x, y, 36, 0x4a6570, 0.52).setStrokeStyle(3, 0xC0D6E4, 0.7);
      const buttonLabel = this.add.text(x, y, label, {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '18px',
        color: '#EAF8FF'
      }).setOrigin(0.5);

      buttonBg.setInteractive({ useHandCursor: true });

      const setPressed = (pressed) => {
        this.mobileInput[key] = pressed;
        buttonBg.setFillStyle(pressed ? 0x6FA0B0 : 0x4a6570, pressed ? 0.72 : 0.52);
        buttonLabel.setScale(pressed ? 0.93 : 1);
      };

      buttonBg.on('pointerdown', () => setPressed(true));
      buttonBg.on('pointerup', () => setPressed(false));
      buttonBg.on('pointerout', () => setPressed(false));
      buttonBg.on('pointerupoutside', () => setPressed(false));

      this.mobileControls.add([buttonBg, buttonLabel]);
    };

    makeButton(leftX, baseY, '◄', 'left');
    makeButton(rightX, baseY, '►', 'right');

    const jumpBg = this.add.circle(jumpX, baseY, 36, 0x4a6570, 0.52).setStrokeStyle(3, 0xC0D6E4, 0.7);
    const jumpLabel = this.add.text(jumpX, baseY, '▲', {
      fontFamily: 'Silkscreen, monospace',
      fontSize: '18px',
      color: '#EAF8FF'
    }).setOrigin(0.5);

    jumpBg.setInteractive({ useHandCursor: true });

    const setJumpState = (pressed) => {
      this.mobileInput.jumpHeld = pressed;
      if (pressed) {
        this.mobileInput.jumpQueued = true;
      }
      jumpBg.setFillStyle(pressed ? 0x6FA0B0 : 0x4a6570, pressed ? 0.72 : 0.52);
      jumpLabel.setScale(pressed ? 0.93 : 1);
    };

    jumpBg.on('pointerdown', () => setJumpState(true));
    jumpBg.on('pointerup', () => setJumpState(false));
    jumpBg.on('pointerout', () => setJumpState(false));
    jumpBg.on('pointerupoutside', () => setJumpState(false));

    this.mobileControls.add([jumpBg, jumpLabel]);
  }

  onPlayerLanded() {
    if (this.isEnding) return;

    const now = this.time.now;
    if (now - this.lastLandingFxTime < 120) return;
    this.lastLandingFxTime = now;

    if (this.landingEmitter) {
      this.landingEmitter.explode(8, this.player.x, this.player.y + 12);
    }

    this.playPlink(220, 0.014);
    this.cameras.main.shake(60, 0.0012);

    this.tweens.killTweensOf(this.player);
    this.player.setScale(2.14, 1.84);
    this.tweens.add({
      targets: this.player,
      scaleX: 2,
      scaleY: 2,
      duration: 130,
      ease: 'Quad.Out'
    });
  }

  updateHudPulse(dt) {
    if (this.lives > 1) {
      this.lowLifeHudPulse = 0;
      this.hudText.setScale(1);
      return;
    }

    this.lowLifeHudPulse += dt * 8;
    const scale = 1 + Math.sin(this.lowLifeHudPulse) * 0.045;
    this.hudText.setScale(scale);
  }

  applyCurrentToPlayer(dt) {
    const flow = currentField(this.player.x, this.player.y, this.time.now * 0.001);

    const currentScale = Phaser.Math.Linear(0.011, 0.022, this.depthProgress);
    this.player.body.velocity.x += flow.x * currentScale * dt * 60;
    this.player.body.velocity.y += flow.y * currentScale * 0.8 * dt * 60;
    this.player.body.velocity.x = Phaser.Math.Clamp(this.player.body.velocity.x, -260, 260);
    this.player.body.velocity.y = Phaser.Math.Clamp(this.player.body.velocity.y, -560, 620);
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
      fillColor: 0x3b5a66,
      fillAlpha: 0.12 + this.depthProgress * 0.1,
      lineColor: 0xc0d6e4,
      lineAlpha: 0.48,
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
      fillColor: 0x2c4a58,
      fillAlpha: 0.09 + this.depthProgress * 0.08,
      lineColor: 0xa7bcc8,
      lineAlpha: 0.38,
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
      Phaser.Display.Color.ValueToColor(0x7d939f),
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
    this.cameras.main.shake(110, 0.0032);
    this.cameras.main.flash(90, 110, 138, 150, true);
    this.damagePlayer(player.x, player.y);
  }

  handleEnemyCollision(player, enemy) {
    if (this.invulnerableTime > 0) return;

    const push = new Phaser.Math.Vector2(player.x - enemy.x, player.y - enemy.y).normalize().scale(180);
    player.body.velocity.x += push.x;
    player.body.velocity.y += push.y - 90;

    this.playPlink(140, 0.05);
    this.cameras.main.shake(130, 0.0038);
    this.cameras.main.flash(110, 118, 150, 165, true);
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
    const collectX = item.x;
    const collectY = item.y;

    item.disableBody(true, true);
    this.score += item.scoreValue;
    this.playPlink(500 + Phaser.Math.Between(-40, 70), 0.024);

    if (this.pickupEmitter) {
      this.pickupEmitter.explode(10, collectX, collectY);
    }

    const popup = this.add.text(collectX, collectY - 10, `+${item.scoreValue}`, {
      fontFamily: 'Silkscreen, monospace',
      fontSize: '14px',
      color: '#D8F6FF',
      stroke: '#2d424c',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(140);

    this.tweens.add({
      targets: popup,
      y: popup.y - 24,
      alpha: 0,
      duration: 340,
      ease: 'Sine.Out',
      onComplete: () => popup.destroy()
    });

    this.pulseCameraZoom(0.018, 90);

    this.time.delayedCall(2200, () => {
      const respawnBand = Phaser.Utils.Array.GetRandom(this.interTierBands);
      item.enableBody(
        true,
        Phaser.Math.Clamp(respawnBand.centerX + Phaser.Math.Between(-320, 320), 70, WORLD_PLAY_WIDTH - 70),
        Phaser.Math.Between(respawnBand.top + 6, respawnBand.bottom - 6),
        true,
        true
      );
      item.baseY = item.y;
      item.wobble = Phaser.Math.FloatBetween(0, Math.PI * 2);
    });
  }

  winGame() {
    if (this.isEnding) return;
    this.playPlink(620, 0.035);
    this.showEndScreen({
      title: 'YOU REACHED\nTHE ABYSS FLOOR',
      subtitle: 'The water swallowed the world, but you made it down.'
    });
  }

  failGame() {
    if (this.isEnding) return;
    this.isEnding = true;

    this.showEndScreen({
      title: 'LOST IN THE TIDE',
      subtitle: 'The current pulled you under this run.'
    });
  }

  showEndScreen(config) {
    if (this._endOverlayShown) return;
    this._endOverlayShown = true;

    this.isEnding = true;
    this.player.setAccelerationX(0);
    this.player.setVelocity(0, 0);

    if (this.cameraZoomTween) {
      this.cameraZoomTween.stop();
      this.cameraZoomTween = null;
    }
    this.cameras.main.setZoom(1);

    this.physics.world.pause();
    this.stopUnderwaterAudio();

    if (this.mobileControls) {
      this.mobileInput.left = false;
      this.mobileInput.right = false;
      this.mobileInput.jumpHeld = false;
      this.mobileInput.jumpQueued = false;
      this.mobileControls.setVisible(false);
    }

    document.dispatchEvent(new CustomEvent('risingtide:end-state', {
      detail: {
        open: true,
        title: config.title,
        subtitle: config.subtitle
      }
    }));
  }

  pulseCameraZoom(amount, duration) {
    if (this.isEnding) return;

    const camera = this.cameras.main;
    if (this.cameraZoomTween) {
      this.cameraZoomTween.stop();
      this.cameraZoomTween = null;
    }

    this.cameraZoomTween = this.tweens.add({
      targets: camera,
      zoom: 1 + amount,
      duration,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => {
        camera.setZoom(1);
        this.cameraZoomTween = null;
      }
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
