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
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
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

const dispatchUiState = () => {
  document.dispatchEvent(new CustomEvent('risingtide:end-state', { detail: { open: false } }));
  document.dispatchEvent(new CustomEvent('risingtide:menu-state', { detail: { open: false } }));
};

window.risingTideStartGame = function risingTideStartGame() {
  dispatchUiState();

  const menuScene = game.scene.getScene(SCENES.menu);
  if (!menuScene) return;

  if (menuScene.scene.isActive()) {
    menuScene.transitionToGame();
  } else {
    game.scene.start(SCENES.game);
  }
};

window.risingTideRestartGame = function risingTideRestartGame() {
  dispatchUiState();

  if (game.scene.isActive(SCENES.game) || game.scene.isPaused(SCENES.game)) {
    game.scene.stop(SCENES.game);
  }

  game.scene.start(SCENES.game);
};

window.risingTideBackToMenu = function risingTideBackToMenu() {
  dispatchUiState();

  if (game.scene.isActive(SCENES.game) || game.scene.isPaused(SCENES.game)) {
    game.scene.stop(SCENES.game);
  }

  if (!game.scene.isActive(SCENES.menu)) {
    game.scene.start(SCENES.menu);
  }
};
