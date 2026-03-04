import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { StackManager } from '../systems/StackManager';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.player = null;
        this.isGameRunning = false;
    }

    preload() {
        // Textura básica para partículas
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(0, 0, 4, 4);
        graphics.generateTexture('particle', 4, 4);
    }

    create() {
        // Grupos Físicos Permanentes (Cria uma vez e reutiliza)
        this.playerGroup = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.projectiles = this.physics.add.group();
        this.enemyProjectiles = this.physics.add.group();

        // Arena
        this.createArena();

        // Inputs
        this.keys = this.input.keyboard.addKeys('W,A,S,D,Q,E,R,ESC');

        // Eventos
        this.events.on('startGame', this.startGame, this);
        this.events.on('enemyKilled', this.checkVictory, this);
        this.events.on('playerDied', this.handlePlayerDeath, this);

        // Colisões Permanentes entre Grupos
        this.physics.add.collider(this.playerGroup, this.obstacles);
        this.physics.add.collider(this.enemies, this.obstacles);
        this.physics.add.collider(this.enemies, this.enemies); // Inimigos colidem entre si

        // Overlaps Permanentes (O Phaser gerencia os membros internos automaticamente)
        this.physics.add.overlap(this.projectiles, this.enemies, this.handleHit, null, this);
        this.physics.add.overlap(this.enemyProjectiles, this.playerGroup, this.handlePlayerHit, null, this);

        // FFA: Inimigos podem ser atingidos por outros projéteis de inimigos
        this.physics.add.overlap(this.enemyProjectiles, this.enemies, this.handleEnemyFF, null, this);

        this.physics.add.overlap(this.enemyProjectiles, this.obstacles, (p) => p.destroy());
        this.physics.add.overlap(this.projectiles, this.obstacles, (p) => p.destroy());

        // Debug: Tecla V para vitória instantânea
        this.input.keyboard.on('keydown-V', () => this.forceVictory());
    }

    createArena() {
        const arenaSize = 1200; // Increased from 800
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // Ground Pattern
        const graphics = this.add.graphics();

        // Main Dark Ground
        graphics.fillStyle(0x111111, 1);
        graphics.fillRect(centerX - arenaSize / 2, centerY - arenaSize / 2, arenaSize, arenaSize);

        // Grid/Tile Detail
        graphics.lineStyle(2, 0x222222, 1);
        const tileSize = 100;
        for (let x = -arenaSize / 2; x <= arenaSize / 2; x += tileSize) {
            graphics.lineBetween(centerX + x, centerY - arenaSize / 2, centerX + x, centerY + arenaSize / 2);
        }
        for (let y = -arenaSize / 2; y <= arenaSize / 2; y += tileSize) {
            graphics.lineBetween(centerX - arenaSize / 2, centerY + y, centerX + arenaSize / 2, centerY + y);
        }

        // Arena Border Glow
        graphics.lineStyle(6, 0x00ffff, 0.3);
        graphics.strokeRect(centerX - arenaSize / 2, centerY - arenaSize / 2, arenaSize, arenaSize);

        // Physics World Bounds
        this.physics.world.setBounds(centerX - arenaSize / 2, centerY - arenaSize / 2, arenaSize, arenaSize);

        // Static Obstacles (Detailed)
        this.obstacles = this.physics.add.staticGroup();

        // Central Pillar
        const pillar = this.add.circle(centerX, centerY, 60, 0x000000, 0.9);
        pillar.setStrokeStyle(3, 0x333333);
        this.obstacles.add(pillar);

        // Corner Pillars
        const cornerDist = 350;
        const cornerPos = [
            { x: centerX - cornerDist, y: centerY - cornerDist },
            { x: centerX + cornerDist, y: centerY - cornerDist },
            { x: centerX - cornerDist, y: centerY + cornerDist },
            { x: centerX + cornerDist, y: centerY + cornerDist }
        ];

        cornerPos.forEach(pos => {
            const p = this.add.circle(pos.x, pos.y, 40, 0x000000, 0.8);
            p.setStrokeStyle(2, 0x222222);
            this.obstacles.add(p);
        });
    }

    startGame(characterId) {
        // RESET TOTAL: Limpa os membros dos grupos, mas mantém os grupos e colisores vivos
        this.playerGroup.clear(true, true);
        this.enemies.clear(true, true);
        this.projectiles.clear(true, true);
        this.enemyProjectiles.clear(true, true);

        // Explicitly hide selection UI
        const selection = document.getElementById('character-selection');
        if (selection) selection.style.display = 'none';

        this.physics.resume(); // Ensure physics is running

        const { width, height } = this.scale;
        const bonuses = StackManager.getBonuses();

        // Criar Novo Player
        this.player = new Player(this, width / 2, height / 2 + 200, characterId, bonuses);
        this.playerGroup.add(this.player);

        // Spawn Enemies
        this.spawnEnemies();

        // Camera Follow
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        const arenaSize = 1200;
        this.cameras.main.setBounds(width / 2 - arenaSize / 2, height / 2 - arenaSize / 2, arenaSize, arenaSize);

        this.isGameRunning = true;
    }

    spawnEnemies() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const spawnRadius = 450;

        const allTypes = [
            'yammy', 'starrk', 'baraggan', 'halibel', 'ulquiorra',
            'nnoitra', 'grimmjow', 'zommari', 'szayel', 'aaroniero'
        ];

        // Filter out player's character to avoid duplication if desired, or keep all for chaos
        const enemyTypes = allTypes.filter(t => t !== this.player.characterId);

        enemyTypes.forEach((type, index) => {
            const angle = (index / enemyTypes.length) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * spawnRadius;
            const y = centerY + Math.sin(angle) * spawnRadius;

            const enemy = new Enemy(this, x, y, type);
            this.enemies.add(enemy);
            enemy.body.setCollideWorldBounds(true);
        });
    }

    handleHit(projectile, enemy) {
        if (!projectile.active || !enemy.active) return;
        enemy.takeDamage(projectile.damage || 10);
        if (projectile.fillAlpha > 0.5) projectile.destroy();
    }

    handlePlayerHit(projectile, player) {
        if (!projectile.active || !player.active) return;
        player.takeDamage(projectile.damage || 5);
        projectile.destroy();
    }

    handleEnemyFF(projectile, enemy) {
        if (!projectile.active || !enemy.active) return;
        // Impedir que o inimigo se acerte (usando ownerID)
        if (projectile.owner === enemy) return;

        enemy.takeDamage((projectile.damage || 10) * 0.5); // Dano reduzido entre eles
        projectile.destroy();
    }

    handlePlayerDeath() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;

        // Stop all physics
        this.physics.pause();
        this.cameras.main.shake(300, 0.03);

        this.displayEndScreen('DERROTA', '#ff0000');
    }

    checkVictory() {
        if (!this.isGameRunning) return;

        const activeCount = this.enemies.countActive();
        if (activeCount === 0) {
            console.log("Vitória detectada! Iniciando forceVictory...");
            this.time.delayedCall(500, () => this.forceVictory());
        }
    }

    forceVictory() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();

        const newStacks = StackManager.addStack(this.player.characterId);
        const counter = document.getElementById('stack-value');
        if (counter) counter.innerText = newStacks;

        // Update R-hint
        const rHint = document.getElementById('r-hint');
        if (rHint && newStacks >= 10) {
            rHint.innerHTML = 'Resurrección: <b style="color: #ffaa00">R (PRONTO PARA LIBERAR)</b>';
        }

        if (newStacks >= 20) {
            this.displayGameOver(newStacks);
            return;
        }

        this.displayEndScreen('VITÓRIA!', '#00ffff');
    }

    displayEndScreen(title, color) {
        const { width, height } = this.scale;

        // Overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

        const mainTxt = this.add.text(width / 2, height / 2 - 50, title, {
            fontSize: '80px',
            color: color,
            fontFamily: 'Space Grotesk',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtext depending on win/loss
        const subTxt = this.add.text(width / 2, height / 2 + 30,
            title === 'VITÓRIA!' ? 'A força dos Espada cresce...' : 'Sua alma retornará à Hueco Mundo.', {
            fontSize: '20px', color: '#ffffff', opacity: 0.8
        }).setOrigin(0.5);

        const btn = this.add.container(width / 2, height / 2 + 120);
        const btnBg = this.add.rectangle(0, 0, 240, 50, 0x333333, 1).setStrokeStyle(2, 0xffffff);
        const btnTxt = this.add.text(0, 0, 'CONTINUAR', {
            fontSize: '20px', color: '#ffffff', fontWeight: 'bold'
        }).setOrigin(0.5);

        btn.add([btnBg, btnTxt]);
        btn.setSize(240, 50);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btnBg.setFillStyle(0x555555));
        btn.on('pointerout', () => btnBg.setFillStyle(0x333333));

        btn.on('pointerdown', () => {
            overlay.destroy();
            mainTxt.destroy();
            subTxt.destroy();
            btn.destroy();

            if (title === 'VITÓRIA!') {
                this.startGame(this.player.characterId);
            } else {
                document.getElementById('character-selection').style.display = 'flex';
            }
        });
    }

    displayGameOver(score) {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.95);

        this.add.text(width / 2, height / 2 - 220, 'CAMPEÃO SUPREMO', {
            fontSize: '64px', color: '#00ffff', fontStyle: 'bold', fontFamily: 'Space Grotesk'
        }).setOrigin(0.5);

        // Leaderboard (Top Final)
        this.add.text(width / 2, height / 2 - 140, 'TOP FINAL - MELHORES PONTUAÇÕES', {
            fontSize: '24px', color: '#aaaaaa', fontFamily: 'Space Grotesk'
        }).setOrigin(0.5);

        const allScores = StackManager.getAllScores();
        const sorted = Object.entries(allScores).sort((a, b) => b[1] - a[1]);

        sorted.forEach((entry, index) => {
            const charName = entry[0].toUpperCase();
            const charScore = entry[1];
            const color = (entry[0] === this.player.characterId) ? '#ffffff' : '#888888';

            this.add.text(width / 2, height / 2 - 80 + (index * 40),
                `${index + 1}. ${charName}: ${charScore} STACKS`, {
                fontSize: '28px', color: color, fontFamily: 'Outfit'
            }).setOrigin(0.5);
        });

        this.add.text(width / 2, height / 2 + 100, `PONTUAÇÃO ATUAL: ${score}`, {
            fontSize: '32px', color: '#00ccff', fontWeight: 'bold'
        }).setOrigin(0.5);

        const btn = this.add.text(width / 2, height / 2 + 200, 'REINICIALIZAR JOGO', {
            fontSize: '24px', backgroundColor: '#333', padding: 15, color: '#ffffff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => {
            StackManager.resetStacks();
            window.location.reload();
        });
    }

    update() {
        if (!this.isGameRunning) {
            if (this.keys.ESC && this.keys.ESC.isDown) this.returnToMenu();
            return;
        }

        if (this.keys.ESC.isDown) {
            this.returnToMenu();
            return;
        }

        if (!this.player || !this.player.active) return;

        this.player.update(this.keys, this.input.activePointer);

        // Double check victory in case event was missed
        if (this.enemies.countActive() === 0) {
            this.checkVictory();
        }

        // Use getChildren() to create a static array for safe iteration during destruction
        const enemies = this.enemies.getChildren();
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy && enemy.active) {
                enemy.update(this.player);
            }
        }
    }

    returnToMenu() {
        this.isGameRunning = false;

        // Exibir seleção de personagem
        const selection = document.getElementById('character-selection');
        if (selection) {
            selection.style.display = 'flex';
            selection.style.opacity = '1';
        }

        this.scene.restart();
        this.cameras.main.stopFollow();
    }
}
