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
                const angle = (i / 2) * Math.PI;
                const enemy = new Enemy(this, centerX + Math.cos(angle) * spawnRadius, centerY + Math.sin(angle) * spawnRadius, shuffled[i], false);
                this.enemies.add(enemy);
            }
        } else if (mode === '3x3') {
            const shuffled = Phaser.Utils.Array.Shuffle(available);
            for (let i = 0; i < 2; i++) {
                const ally = new Enemy(this, this.player.x - 100 + (i * 200), this.player.y, shuffled[i], true);
                this.allies.add(ally);
            }
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const enemy = new Enemy(this, centerX + Math.cos(angle) * spawnRadius, centerY + Math.sin(angle) * spawnRadius, shuffled[i + 2], false);
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

        // Small delay to ensure Phaser has updated group lists
        this.time.delayedCall(100, () => {
            const enemiesLeft = this.enemies.getChildren().filter(e => e.active).length;
            const alliesLeft = this.allies.getChildren().filter(a => a.active).length;
            const playerAlive = this.player && this.player.active;

            if (enemiesLeft === 0) {
                this.endRound(true);
            } else if (!playerAlive && alliesLeft === 0) {
                this.endRound(false);
            }
        });
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

            // Winners in group modes also gain points
            if (this.gameMode !== 'FFA') {
                this.allies.getChildren().forEach(a => {
                    if (a.active) ScoreManager.addPoints(a.characterId, ScoreManager.WIN_POINTS);
                });
            }

            if (ScoreManager.getScore(this.player.characterId) >= ScoreManager.MATCH_WIN_THRESHOLD) {
                this.displayMatchFinished(this.player.characterId);
            } else {
                this.displayOverlayScreen('VITÓRIA!', '#00ffff');
            }
        } else {
            // Award points to surviving enemies
            this.enemies.getChildren().forEach(e => {
                if (e.active) ScoreManager.addPoints(e.characterId, ScoreManager.WIN_POINTS);
            });
            this.displayOverlayScreen('DERROTA!', '#ff0000');
        }
    }

    forceVictory() {
        this.endRound(true);
    }

    displayOverlayScreen(title, color) {
        const { width, height } = this.scale;

        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85).setScrollFactor(0).setDepth(100);

        this.add.text(width / 2, height / 2 - 150, title, {
            fontSize: '100px', color: color, fontFamily: 'Space Grotesk', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

        const scoreContainer = this.add.container(width / 2, height / 2 + 50).setScrollFactor(0).setDepth(101);
        const scores = ScoreManager.getAllScores();
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

        sorted.forEach((e, i) => {
            const isPlayer = this.player && e[0] === this.player.characterId;
            const y = (i * 35) - 100;
            if (isPlayer) {
                scoreContainer.add(this.add.rectangle(0, y, 600, 30, 0x00ffff, 0.15));
            }
            scoreContainer.add(this.add.text(-250, y, `${i + 1}. ${e[0].toUpperCase()}`, {
                fontSize: '20px', color: isPlayer ? '#00ffff' : '#ffffff', fontFamily: 'Outfit'
            }).setOrigin(0, 0.5));
            scoreContainer.add(this.add.text(250, y, `${e[1]} PTS`, {
                fontSize: '20px', color: '#ffffff', fontFamily: 'Space Grotesk'
            }).setOrigin(1, 0.5));
        });

        const btnContainer = this.add.container(width / 2, height - 80).setScrollFactor(0).setDepth(102);

        const btnNext = this.add.text(-120, 0, 'PRÓXIMA RODADA', {
            fontSize: '24px', color: '#00ffff', fontFamily: 'Outfit', backgroundColor: '#333', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const btnLobby = this.add.text(120, 0, 'SAIR PARA O MENU', {
            fontSize: '20px', color: '#ffffff', fontFamily: 'Outfit', backgroundColor: '#552222', padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btnContainer.add([btnNext, btnLobby]);

        const nextRound = () => {
            const charId = this.player.characterId;
            const mode = this.gameMode;
            this.scene.restart();
            this.events.once('create', () => this.startGame(charId, mode));
        };

        btnNext.on('pointerdown', nextRound);
        btnLobby.on('pointerdown', () => window.location.reload());
        this.input.keyboard.once('keydown-SPACE', nextRound);
    }

    displayMatchFinished(winnerId) {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.95).setScrollFactor(0).setDepth(200);
        const isPlayer = this.player && winnerId === this.player.characterId;

        this.add.text(width / 2, height / 2 - 100, isPlayer ? 'CAMPEÃO DA PARTIDA!' : 'PARTIDA ENCERRADA', {
            fontSize: '80px', color: isPlayer ? '#00ffff' : '#ff0000', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        this.add.text(width / 2, height / 2, `VENCEDOR FINAL: ${winnerId.toUpperCase()}`, {
            fontSize: '32px', color: '#fff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        const btn = this.add.text(width / 2, height / 2 + 150, 'VOLTAR AO MENU', {
            fontSize: '28px', backgroundColor: '#333', padding: 20, color: '#fff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            ScoreManager.resetMatch(); window.location.reload();
        });
    }

    update() {
        if (!this.isGameRunning) return;
        if (this.keys.ESC.isDown) window.location.reload();

        if (this.player && this.player.active) {
            this.player.update(this.keys, this.input.activePointer);
        }

        [...this.allies.getChildren()].forEach(a => a.active && a.update());
        [...this.enemies.getChildren()].forEach(e => e.active && e.update());
    }
}
