import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { StackManager } from './systems/StackManager';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [GameScene]
};

const game = new Phaser.Game(config);

// Update UI initial state
document.getElementById('stack-value').innerText = StackManager.getStacks();

// Listen for character selection from UI
window.addEventListener('charSelected', (e) => {
  const scene = game.scene.getScene('GameScene');
  if (scene) {
    scene.startGame(e.detail);
  }
});

export default game;
