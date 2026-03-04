import { IntroScene } from './scenes/IntroScene.js';
import { StartMenuScene } from './scenes/StartMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GAME_HEIGHT, GAME_WIDTH } from './scenes/constants.js';

const SCENES = {
  intro: 'IntroScene',
  menu: 'StartMenuScene',
  game: 'GameScene'
};

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#0d2230',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [IntroScene, StartMenuScene, GameScene]
};

const game = new Phaser.Game(config);
window.risingTideGame = game;

window.risingTideStartGame = function risingTideStartGame() {
  const menuScene = game.scene.getScene(SCENES.menu);
  if (!menuScene) return;

  if (menuScene.scene.isActive()) {
    menuScene.transitionToGame();
  } else {
    game.scene.start(SCENES.game);
  }
};

window.risingTideBackToMenu = function risingTideBackToMenu() {
  if (game.scene.isActive(SCENES.game) || game.scene.isPaused(SCENES.game)) {
    game.scene.stop(SCENES.game);
  }

  if (!game.scene.isActive(SCENES.menu)) {
    game.scene.start(SCENES.menu);
  }
};
