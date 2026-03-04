import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { ScoreManager } from '../systems/ScoreManager';
import { AchievementManager } from '../systems/AchievementManager';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.player = null;
        this.isGameRunning = false;
        this.gameMode = 'FFA';
    }

    preload() {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(0, 0, 4, 4);
        graphics.generateTexture('particle', 4, 4);
    }

    create() {
        this.playerGroup = this.physics.add.group();
        this.allies = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.projectiles = this.physics.add.group();
        this.enemyProjectiles = this.physics.add.group();

        this.createArena();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,Q,E,R,ESC');

        this.events.on('enemyKilled', this.handleCharacterKilled, this);
        this.events.on('playerDied', this.handlePlayerDeath, this);

        // Collisions
        this.physics.add.collider(this.playerGroup, this.obstacles);
        this.physics.add.collider(this.allies, this.obstacles);
        this.physics.add.collider(this.enemies, this.obstacles);
        this.physics.add.collider(this.enemies, this.enemies);
        this.physics.add.collider(this.allies, this.allies);
        this.physics.add.collider(this.allies, this.enemies);

        // Overlaps
        this.physics.add.overlap(this.projectiles, this.enemies, this.handleHit, null, this);
        this.physics.add.overlap(this.enemyProjectiles, this.playerGroup, this.handlePlayerHit, null, this);
        this.physics.add.overlap(this.enemyProjectiles, this.allies, this.handleAllyHit, null, this);
        this.physics.add.overlap(this.enemyProjectiles, this.enemies, this.handleEnemyFF, null, this);

        this.physics.add.overlap(this.enemyProjectiles, this.obstacles, (p) => p.destroy());
        this.physics.add.overlap(this.projectiles, this.obstacles, (p) => p.destroy());

        this.input.keyboard.on('keydown-V', () => this.forceVictory());
    }

    createArena() {
        const arenaSize = 1200;
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const graphics = this.add.graphics();
        graphics.fillStyle(0x0a0a0a, 1);
        graphics.fillRect(centerX - arenaSize / 2, centerY - arenaSize / 2, arenaSize, arenaSize);
        graphics.lineStyle(2, 0x1a1a1a, 1);
        const tileSize = 100;
        for (let x = -arenaSize / 2; x <= arenaSize / 2; x += tileSize) {
            graphics.lineBetween(centerX + x, centerY - arenaSize / 2, centerX + x, centerY + arenaSize / 2);
        }
        for (let y = -arenaSize / 2; y <= arenaSize / 2; y += tileSize) {
            graphics.lineBetween(centerX - arenaSize / 2, centerY + y, centerX + arenaSize / 2, centerY + y);
        }
        graphics.lineStyle(10, 0x00ffff, 0.5);
        graphics.strokeRect(centerX - arenaSize / 2, centerY - arenaSize / 2, arenaSize, arenaSize);
        graphics.lineStyle(20, 0x00ffff, 0.1);
        graphics.strokeRect(centerX - arenaSize / 2 - 5, centerY - arenaSize / 2 - 5, arenaSize + 10, arenaSize + 10);

        this.physics.world.setBounds(centerX - arenaSize / 2, centerY - arenaSize / 2, arenaSize, arenaSize);
        this.physics.world.setBoundsCollision(true, true, true, true);

        this.obstacles = this.physics.add.staticGroup();
        const pillar = this.add.circle(centerX, centerY, 60, 0x000000, 0.9);
        pillar.setStrokeStyle(3, 0x333333);
        this.obstacles.add(pillar);
    }

    startGame(characterId, mode = 'FFA') {
        this.gameMode = mode;
        this.playerGroup.clear(true, true);
        this.allies.clear(true, true);
        this.enemies.clear(true, true);
        this.projectiles.clear(true, true);
        this.enemyProjectiles.clear(true, true);

        const selection = document.getElementById('character-selection');
        if (selection) selection.style.display = 'none';
        const hub = document.getElementById('hub-screen');
        if (hub) hub.style.display = 'none';

        this.physics.resume();
        const { width, height } = this.scale;

        this.player = new Player(this, width / 2, height / 2 + 200, characterId, {});
        this.playerGroup.add(this.player);
        this.player.body.setCollideWorldBounds(true);
        this.updateHUD();

        this.spawnTeams(characterId, mode);

        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        const arenaSize = 1200;
        this.cameras.main.setBounds(width / 2 - arenaSize / 2, height / 2 - arenaSize / 2, arenaSize, arenaSize);
        this.isGameRunning = true;
    }

    spawnTeams(playerChar, mode) {
        const allTypes = ['yammy', 'starrk', 'baraggan', 'halibel', 'ulquiorra', 'nnoitra', 'grimmjow', 'zommari', 'szayel', 'aaroniero'];
        const available = allTypes.filter(t => t !== playerChar);
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const spawnRadius = 450;

        if (mode === 'FFA') {
            available.forEach((type, index) => {
                const angle = (index / available.length) * Math.PI * 2;
                const enemy = new Enemy(this, centerX + Math.cos(angle) * spawnRadius, centerY + Math.sin(angle) * spawnRadius, type, false);
                this.enemies.add(enemy);
            });
        } else if (mode === '2x2') {
            const shuffled = Phaser.Utils.Array.Shuffle(available);
            const ally = new Enemy(this, this.player.x - 100, this.player.y, shuffled[0], true);
            this.allies.add(ally);
            for (let i = 1; i <= 2; i++) {
                const enemy = new Enemy(this, centerX, centerY - 300 + (i * 100), shuffled[i], false);
                this.enemies.add(enemy);
            }
        } else if (mode === '3x3') {
            const shuffled = Phaser.Utils.Array.Shuffle(available);
            for (let i = 0; i < 2; i++) {
                const ally = new Enemy(this, this.player.x - 100 + (i * 200), this.player.y, shuffled[i], true);
                this.allies.add(ally);
            }
            for (let i = 0; i < 3; i++) {
                const enemy = new Enemy(this, centerX - 100 + (i * 100), centerY - 300, shuffled[i + 2], false);
                this.enemies.add(enemy);
            }
        }
    }

    handleHit(projectile, enemy) {
        if (!projectile.active || !enemy.active) return;
        if (!projectile.hitTargets) projectile.hitTargets = new Set();
        if (projectile.hitTargets.has(enemy)) return;
        projectile.hitTargets.add(enemy);
        let damage = projectile.damage || 10;
        enemy.takeDamage(damage, projectile.owner);
        if (projectile.type !== 'Rectangle' && projectile.fillAlpha > 0.5) projectile.destroy();
    }

    handlePlayerHit(projectile, player) {
        if (!projectile.active || !player.active) return;
        player.takeDamage(projectile.damage || 5, projectile.owner);
        projectile.destroy();
    }

    handleAllyHit(projectile, ally) {
        if (!projectile.active || !ally.active) return;
        ally.takeDamage(projectile.damage || 5, projectile.owner);
        projectile.destroy();
    }

    handleEnemyFF(projectile, enemy) {
        if (!projectile.active || !enemy.active || projectile.owner === enemy) return;
        if (this.gameMode !== 'FFA') return;
        enemy.takeDamage((projectile.damage || 10) * 0.5, projectile.owner);
        projectile.destroy();
    }

    awardKill(characterId) {
        ScoreManager.addPoints(characterId, ScoreManager.KILL_POINTS);
        if (this.player && characterId === this.player.characterId) {
            AchievementManager.recordKill();
        }
        this.updateHUD();
    }

    updateHUD() {
        if (!this.player) return;
        const score = ScoreManager.getScore(this.player.characterId);
        const counter = document.getElementById('stack-value');
        if (counter) counter.innerText = score;
    }

    handleCharacterKilled() {
        if (!this.isGameRunning) return;

        const enemyCount = this.enemies.countActive();
        const allyCount = this.allies.countActive();
        const playerAlive = this.player && this.player.active;

        if (enemyCount === 0) {
            // Player's Team Wins
            this.time.delayedCall(500, () => this.endRound(true));
        } else if (!playerAlive && allyCount === 0) {
            // Player's Team Loses
            this.time.delayedCall(500, () => this.endRound(false));
        }
    }

    handlePlayerDeath() {
        this.handleCharacterKilled();
    }

    endRound(isVictory) {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();

        if (isVictory) {
            ScoreManager.addPoints(this.player.characterId, ScoreManager.WIN_POINTS);
            AchievementManager.recordWin();

            // Award points to surviving allies too? (Simulação competitiva)
            this.allies.getChildren().forEach(a => {
                if (a.active) ScoreManager.addPoints(a.characterId, ScoreManager.WIN_POINTS);
            });

            if (ScoreManager.getScore(this.player.characterId) >= ScoreManager.MATCH_WIN_THRESHOLD) {
                this.displayMatchFinished(this.player.characterId);
                return;
            }
            this.displayScoreboard('VITÓRIA!', '#00ffff');
        } else {
            // Award points to surviving enemies
            this.enemies.getChildren().forEach(e => {
                if (e.active) ScoreManager.addPoints(e.characterId, ScoreManager.WIN_POINTS);
            });
            this.displayScoreboard('DERROTA!', '#ff0000');
        }
    }

    forceVictory() {
        this.endRound(true);
    }

    displayScoreboard(title, color) {
        const { width, height } = this.scale;
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9).setInteractive();
        this.add.text(width / 2, 80, title, { fontSize: '48px', color: color, fontFamily: 'Space Grotesk' }).setOrigin(0.5);

        const scores = ScoreManager.getAllScores();
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

        sorted.forEach((e, i) => {
            const isPlayer = this.player && e[0] === this.player.characterId;
            const y = 180 + (i * 45);
            if (isPlayer) this.add.rectangle(width / 2, y, 500, 40, 0x00ffff, 0.1);
            this.add.text(width / 2 - 200, y, `${i + 1}. ${e[0].toUpperCase()}`, { fontSize: '24px', color: isPlayer ? '#00ffff' : '#fff' }).setOrigin(0, 0.5);
            this.add.text(width / 2 + 200, y, `${e[1]} PTS`, { fontSize: '24px', color: '#fff' }).setOrigin(1, 0.5);
        });

        const btn = this.add.container(width / 2, height - 80);
        const bg = this.add.rectangle(0, 0, 240, 50, 0x333333, 1).setStrokeStyle(2, 0xffffff);
        const txt = this.add.text(0, 0, 'CONTINUAR', { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
        btn.add([bg, txt]).setSize(240, 50).setInteractive({ useHandCursor: true }).on('pointerdown', () => { window.location.reload(); });
    }

    displayMatchFinished(winnerId) {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.95);
        const isPlayer = this.player && winnerId === this.player.characterId;
        this.add.text(width / 2, height / 2 - 100, isPlayer ? 'CAMPEÃO DA PARTIDA!' : 'PARTIDA ENCERRADA', { fontSize: '64px', color: isPlayer ? '#00ffff' : '#ff0000' }).setOrigin(0.5);
        this.add.text(width / 2, height / 2, `VENCEDOR: ${winnerId.toUpperCase()}`, { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
        const btn = this.add.text(width / 2, height / 2 + 100, 'VOLTAR AO HUB', { fontSize: '24px', backgroundColor: '#333', padding: 15 }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            ScoreManager.resetMatch(); window.location.reload();
        });
    }

    update() {
        if (!this.isGameRunning) return;
        if (this.keys.ESC.isDown) window.location.reload();
        if (!this.player || !this.player.active) {
            // Mesmo morto, a cena continua para ver os aliados lutarem
        } else {
            this.player.update(this.keys, this.input.activePointer);
        }

        [...this.allies.getChildren()].forEach(a => a.active && a.update());
        [...this.enemies.getChildren()].forEach(e => e.active && e.update());
    }
}
