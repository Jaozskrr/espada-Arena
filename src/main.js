import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { ScoreManager } from './systems/ScoreManager';
import { AchievementManager } from './systems/AchievementManager';

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

// Achievements Logic
window.addEventListener('updateAchievements', () => {
  const ach = AchievementManager.getAchievements();
  const list = document.getElementById('achievements-list');
  if (list) {
    list.innerHTML = `
      <div class="ach-item ${ach.winMatch >= 1 ? 'complete' : ''}">
        Vencer uma partida (${ach.winMatch}/1)
      </div>
      <div class="ach-item ${ach.kills >= 5 ? 'complete' : ''}">
        Eliminar Inimigos (${ach.kills}/5)
      </div>
      <div class="ach-item ${ach.useResurrection >= 1 ? 'complete' : ''}">
        Usar a Ressurreição em uma partida (${ach.useResurrection}/1)
      </div>
    `;
  }
});

// Initial HUD
const value = document.getElementById('stack-value');
if (value) value.innerText = '0';

// Listen for selection
window.addEventListener('charSelected', (e) => {
  const scene = game.scene.getScene('GameScene');
  if (scene) {
    scene.startGame(e.detail.characterId, e.detail.mode);
  }
});

export default game;
