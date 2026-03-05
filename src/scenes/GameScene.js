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
        // Team scores for 2x2 / 3x3 (reset every match)
        this.teamScores = { player: 0, enemy: 0 };
        this.TEAM_WIN_ROUNDS = 5;
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
        const arenaSize = 2200;
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const g = this.add.graphics();

        // Background fill
        g.fillStyle(0x090912, 1);
        g.fillRect(centerX - arenaSize / 2, centerY - arenaSize / 2, arenaSize, arenaSize);

        // Sand/bone texture grid
        g.lineStyle(1, 0x161625, 1);
        const tileSize = 120;
        for (let x = -arenaSize / 2; x <= arenaSize / 2; x += tileSize) {
            g.lineBetween(centerX + x, centerY - arenaSize / 2, centerX + x, centerY + arenaSize / 2);
        }
        for (let y = -arenaSize / 2; y <= arenaSize / 2; y += tileSize) {
            g.lineBetween(centerX - arenaSize / 2, centerY + y, centerX + arenaSize / 2, centerY + y);
        }

        // Accent circles inside the map
        g.lineStyle(1, 0x1a1a35, 0.8);
        [300, 600, 950].forEach(r => g.strokeCircle(centerX, centerY, r));

        // Glowing border
        g.lineStyle(12, 0x00ffff, 0.5);
        g.strokeRect(centerX - arenaSize / 2, centerY - arenaSize / 2, arenaSize, arenaSize);
        g.lineStyle(30, 0x00ffff, 0.08);
        g.strokeRect(centerX - arenaSize / 2 - 8, centerY - arenaSize / 2 - 8, arenaSize + 16, arenaSize + 16);

        this.physics.world.setBounds(centerX - arenaSize / 2, centerY - arenaSize / 2, arenaSize, arenaSize);
        this.physics.world.setBoundsCollision(true, true, true, true);

        // Obstacles — centre pillar + 4 corner pillars
        this.obstacles = this.physics.add.staticGroup();
        const pillarData = [
            { x: 0, y: 0, r: 55 },
            { x: -500, y: -500, r: 40 },
            { x: 500, y: -500, r: 40 },
            { x: -500, y: 500, r: 40 },
            { x: 500, y: 500, r: 40 },
        ];
        pillarData.forEach(({ x, y, r }) => {
            const p = this.add.circle(centerX + x, centerY + y, r, 0x05050e, 1);
            p.setStrokeStyle(3, 0x222244);
            this.obstacles.add(p);
        });
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
        const arenaSize = 2200;
        this.cameras.main.setBounds(width / 2 - arenaSize / 2, height / 2 - arenaSize / 2, arenaSize, arenaSize);
        this.isGameRunning = true;
        this.updateHUD();
    }

    spawnTeams(playerChar, mode) {
        const allTypes = ['yammy', 'starrk', 'baraggan', 'halibel', 'ulquiorra', 'nnoitra', 'grimmjow', 'zommari', 'szayel', 'aaroniero'];
        const available = allTypes.filter(t => t !== playerChar);
        const { width, height } = this.scale;
        const cx = width / 2;
        const cy = height / 2;

        // Helper: get an evenly spaced ring position
        const ringPos = (index, total, radius, offsetAngle = 0) => {
            const angle = offsetAngle + (index / total) * Math.PI * 2;
            return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
        };

        if (mode === 'FFA') {
            // Player at bottom (angle = PI/2 = 270°), everyone else spread around the ring
            const playerPos = ringPos(0, 1, 850, Math.PI / 2);
            this.player.setPosition(playerPos.x, playerPos.y);

            // All 9 others evenly distributed, shifted to avoid player's angle
            available.forEach((type, i) => {
                const pos = ringPos(i, available.length, 850, Math.PI / 2 + (Math.PI * 2 / available.length));
                const enemy = new Enemy(this, pos.x, pos.y, type, false);
                this.enemies.add(enemy);
            });

        } else if (mode === '2x2') {
            const shuffled = Phaser.Utils.Array.Shuffle(available);
            // Player team: bottom-left area
            this.player.setPosition(cx - 350, cy + 750);
            const ally = new Enemy(this, cx + 350, cy + 750, shuffled[0], true);
            this.allies.add(ally);
            // Enemy team: top area, separated
            const e1 = new Enemy(this, cx - 350, cy - 750, shuffled[1], false);
            const e2 = new Enemy(this, cx + 350, cy - 750, shuffled[2], false);
            this.enemies.add(e1);
            this.enemies.add(e2);

        } else if (mode === '3x3') {
            const shuffled = Phaser.Utils.Array.Shuffle(available);
            // Player team: bottom row
            this.player.setPosition(cx, cy + 750);
            const a1 = new Enemy(this, cx - 450, cy + 750, shuffled[0], true);
            const a2 = new Enemy(this, cx + 450, cy + 750, shuffled[1], true);
            this.allies.add(a1); this.allies.add(a2);
            // Enemy team: top row
            const e1 = new Enemy(this, cx - 450, cy - 750, shuffled[2], false);
            const e2 = new Enemy(this, cx, cy - 750, shuffled[3], false);
            const e3 = new Enemy(this, cx + 450, cy - 750, shuffled[4], false);
            this.enemies.add(e1); this.enemies.add(e2); this.enemies.add(e3);
        }
    }

    handleHit(projectile, enemy) {
        if (!projectile.active || !enemy.active) return;
        if (!projectile.hitTargets) projectile.hitTargets = new Set();
        if (projectile.hitTargets.has(enemy)) return;
        projectile.hitTargets.add(enemy);

        let damage = projectile.damage || 10;

        // Proximity damage (Gran Caída do Baraggan)
        if (projectile.isProximity && projectile.radius) {
            const dist = Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y);
            const factor = 1 + Math.max(0, (1 - dist / projectile.radius)) * 1.5;
            damage *= factor;
        }

        // Count-based damage (Teatro de Titere do Szayel)
        if (projectile.isCountBased) {
            const count = this.enemies.getChildren().filter(e =>
                e.active && Phaser.Math.Distance.Between(projectile.x, projectile.y, e.x, e.y) < 200
            ).length;
            damage *= (1 + count * 0.2);
        }

        enemy.takeDamage(damage, projectile.owner);

        // Apply slow (Cascada da Halibel)
        if (projectile.isSlow && enemy.active) {
            enemy.applySlow(projectile.slowDuration || 2000, 0.4);
        }

        // Apply stun (Amor do Zommari)
        if (projectile.isStun && enemy.active) {
            enemy.applyStun(projectile.stunDuration || 1500);
        }

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

        this.time.delayedCall(100, () => {
            const enemiesLeft = this.enemies.getChildren().filter(e => e.active).length;
            const alliesLeft = this.allies.getChildren().filter(a => a.active).length;
            const playerAlive = this.player && this.player.active;

            if (enemiesLeft === 0) {
                // Player team wins (player may be dead but allies cleared enemies)
                if (playerAlive || alliesLeft > 0) this.endRound(true);
                else this.endRound(false);
                return;
            }

            if (this.spectatorMode) {
                // While spectating: update the spectator targets list each kill
                if (this.spectatorTargets) {
                    // If spectated character is dead, auto-advance to next
                    const currentTarget = this.spectatorTargets[this.spectatorTargetIndex];
                    if (currentTarget && !currentTarget.active) {
                        this.spectatorTargetIndex++;
                        this.updateSpectatorTarget();
                    }
                }
                // Check team defeat condition
                if (!playerAlive && alliesLeft === 0) {
                    this.endRound(false);
                }
                return;
            }

            // Normal: player alive path
            if (!playerAlive && alliesLeft === 0) {
                this.handlePlayerDeath();
            }
        });
    }

    handlePlayerDeath() {
        if (!this.isGameRunning) return;
        if (this.spectatorMode) return; // Já em modo espectador

        this.spectatorMode = true;
        this.spectatorTargetIndex = 0;
        this.cameras.main.shake(300, 0.03);

        // Aguarda um frame para garantir que o player foi destruído
        this.time.delayedCall(200, () => this.enterSpectatorMode());
    }

    enterSpectatorMode() {
        this.spectatorTargets = [
            ...this.enemies.getChildren().filter(e => e.active),
            ...this.allies.getChildren().filter(a => a.active)
        ];

        if (this.spectatorTargets.length === 0) {
            this.endRound(false);
            return;
        }

        this.spectatorTargetIndex = 0;
        this.updateSpectatorTarget();
        this.buildSpectatorHUD();
    }

    updateSpectatorTarget() {
        const targets = this.spectatorTargets.filter(t => t.active);
        if (targets.length === 0) {
            this.endRound(false);
            return;
        }

        // Wrap index
        this.spectatorTargetIndex = ((this.spectatorTargetIndex % targets.length) + targets.length) % targets.length;
        this.spectatorTargets = targets;
        const target = targets[this.spectatorTargetIndex];

        this.cameras.main.startFollow(target, true, 0.08, 0.08);

        // Update name label
        if (this.spectatorNameText) {
            const isAlly = target.isAlly;
            this.spectatorNameText.setText(target.characterId.toUpperCase());
            this.spectatorNameText.setStyle({ color: isAlly ? '#00ffff' : '#ff5555' });
        }
    }

    buildSpectatorHUD() {
        const { width, height } = this.scale;

        // Background bar
        const bar = this.add.rectangle(width / 2, height - 40, width, 80, 0x000000, 0.75)
            .setScrollFactor(0).setDepth(50);

        this.add.text(width / 2, height - 60, 'MODO ESPECTADOR', {
            fontSize: '11px', color: '#888888', fontFamily: 'Outfit', letterSpacing: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

        // Prev button
        const btnPrev = this.add.text(width / 2 - 180, height - 35, '◄ ANTERIOR', {
            fontSize: '18px', color: '#ffffff', fontFamily: 'Space Grotesk',
            backgroundColor: '#222222', padding: { x: 14, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setInteractive({ useHandCursor: true });

        // Current name
        const firstTarget = this.spectatorTargets[0];
        this.spectatorNameText = this.add.text(width / 2, height - 35,
            firstTarget ? firstTarget.characterId.toUpperCase() : '---', {
            fontSize: '28px', color: firstTarget?.isAlly ? '#00ffff' : '#ff5555',
            fontFamily: 'Space Grotesk', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

        // Next button
        const btnNext = this.add.text(width / 2 + 180, height - 35, 'PRÓXIMO ►', {
            fontSize: '18px', color: '#ffffff', fontFamily: 'Space Grotesk',
            backgroundColor: '#222222', padding: { x: 14, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setInteractive({ useHandCursor: true });

        btnPrev.on('pointerdown', () => { this.spectatorTargetIndex--; this.updateSpectatorTarget(); });
        btnNext.on('pointerdown', () => { this.spectatorTargetIndex++; this.updateSpectatorTarget(); });

        btnPrev.on('pointerover', () => btnPrev.setStyle({ backgroundColor: '#444444' }));
        btnPrev.on('pointerout', () => btnPrev.setStyle({ backgroundColor: '#222222' }));
        btnNext.on('pointerover', () => btnNext.setStyle({ backgroundColor: '#444444' }));
        btnNext.on('pointerout', () => btnNext.setStyle({ backgroundColor: '#222222' }));
    }

    endRound(isVictory) {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();

        if (isVictory) {
            if (this.gameMode === 'FFA') {
                // FFA: player gets WIN_POINTS (5)
                ScoreManager.addPoints(this.player.characterId, ScoreManager.WIN_POINTS);
                AchievementManager.recordWin();
                if (ScoreManager.getScore(this.player.characterId) >= ScoreManager.MATCH_WIN_THRESHOLD) {
                    this.displayMatchFinished('player');
                    return;
                }
            } else {
                // Team modes: 1 point per round for the player's team
                this.teamScores.player += 1;
                AchievementManager.recordWin();
                if (this.teamScores.player >= this.TEAM_WIN_ROUNDS) {
                    this.displayMatchFinished('player');
                    return;
                }
            }
            this.displayOverlayScreen('VITÓRIA!', '#00ffff');
        } else {
            if (this.gameMode === 'FFA') {
                // FFA: only the highest-HP survivor gets WIN_POINTS
                const survivors = this.enemies.getChildren().filter(e => e.active);
                if (survivors.length > 0) {
                    const roundWinner = survivors.reduce((best, e) => e.hp > best.hp ? e : best, survivors[0]);
                    ScoreManager.addPoints(roundWinner.characterId, ScoreManager.WIN_POINTS);
                }
            } else {
                // Team modes: 1 point for the enemy team
                this.teamScores.enemy += 1;
                if (this.teamScores.enemy >= this.TEAM_WIN_ROUNDS) {
                    this.displayMatchFinished('enemy');
                    return;
                }
            }
            this.displayOverlayScreen('DERROTA!', '#ff0000');
        }
    }

    forceVictory() {
        this.endRound(true);
    }

    displayOverlayScreen(title, color) {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85).setScrollFactor(0).setDepth(100);
        this.add.text(width / 2, height / 2 - 160, title, {
            fontSize: '100px', color: color, fontFamily: 'Space Grotesk', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

        if (this.gameMode === 'FFA') {
            // FFA: show all individual scores
            this.add.text(width / 2, height / 2 - 60, 'PONTUAÇÃO GERAL', {
                fontSize: '18px', color: '#aaaaaa', fontFamily: 'Outfit', fontStyle: 'italic'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

            const scoreContainer = this.add.container(width / 2, height / 2 + 50).setScrollFactor(0).setDepth(101);
            const scores = ScoreManager.getAllScores();
            const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
            sorted.forEach((e, i) => {
                const isPlayer = this.player && e[0] === this.player.characterId;
                const y = (i * 32) - 120;
                if (isPlayer) scoreContainer.add(this.add.rectangle(0, y, 600, 28, 0x00ffff, 0.15));
                scoreContainer.add(this.add.text(-250, y, `${i + 1}. ${e[0].toUpperCase()}`, {
                    fontSize: '18px', color: isPlayer ? '#00ffff' : '#ffffff', fontFamily: 'Outfit'
                }).setOrigin(0, 0.5));
                scoreContainer.add(this.add.text(250, y, `${e[1]} PTS`, {
                    fontSize: '18px', color: '#ffffff', fontFamily: 'Space Grotesk'
                }).setOrigin(1, 0.5));
            });
        } else {
            // Team modes: show round scores
            this.add.text(width / 2, height / 2 - 50, 'ROUNDS', {
                fontSize: '18px', color: '#aaaaaa', fontFamily: 'Outfit', fontStyle: 'italic'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

            // Player Team
            this.add.rectangle(width / 2 - 160, height / 2 + 30, 240, 100, 0x003333, 0.9).setScrollFactor(0).setDepth(101);
            this.add.text(width / 2 - 160, height / 2 + 5, 'SEU TIME', {
                fontSize: '16px', color: '#00ffff', fontFamily: 'Outfit'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            this.add.text(width / 2 - 160, height / 2 + 45, `${this.teamScores.player}`, {
                fontSize: '52px', color: '#00ffff', fontFamily: 'Space Grotesk', fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

            this.add.text(width / 2, height / 2 + 30, 'X', {
                fontSize: '36px', color: '#ffffff', fontFamily: 'Space Grotesk'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

            // Enemy Team
            this.add.rectangle(width / 2 + 160, height / 2 + 30, 240, 100, 0x330000, 0.9).setScrollFactor(0).setDepth(101);
            this.add.text(width / 2 + 160, height / 2 + 5, 'TIME INIMIGO', {
                fontSize: '16px', color: '#ff5555', fontFamily: 'Outfit'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
            this.add.text(width / 2 + 160, height / 2 + 45, `${this.teamScores.enemy}`, {
                fontSize: '52px', color: '#ff5555', fontFamily: 'Space Grotesk', fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

            this.add.text(width / 2, height / 2 + 120, `Primeiro a ${this.TEAM_WIN_ROUNDS} rounds vence a partida`, {
                fontSize: '14px', color: '#888888', fontFamily: 'Outfit'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
        }

        // Botões adicionados diretamente à cena (não Container) para receberem eventos de clique
        const btnNext = this.add.text(width / 2 - 160, height - 80, 'PRÓXIMA RODADA', {
            fontSize: '22px', color: '#00ffff', fontFamily: 'Outfit', backgroundColor: '#1a1a1a',
            padding: { x: 20, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setInteractive({ useHandCursor: true });

        const btnLobby = this.add.text(width / 2 + 160, height - 80, 'SAIR PARA O MENU', {
            fontSize: '22px', color: '#ff5555', fontFamily: 'Outfit', backgroundColor: '#1a1a1a',
            padding: { x: 20, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setInteractive({ useHandCursor: true });

        // Hover effects
        btnNext.on('pointerover', () => btnNext.setStyle({ color: '#ffffff', backgroundColor: '#00aaaa' }));
        btnNext.on('pointerout', () => btnNext.setStyle({ color: '#00ffff', backgroundColor: '#1a1a1a' }));
        btnLobby.on('pointerover', () => btnLobby.setStyle({ color: '#ffffff', backgroundColor: '#7a1111' }));
        btnLobby.on('pointerout', () => btnLobby.setStyle({ color: '#ff5555', backgroundColor: '#1a1a1a' }));

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

    displayMatchFinished(winner) {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.95).setScrollFactor(0).setDepth(200);

        const isPlayerWin = winner === 'player';
        const titleText = isPlayerWin
            ? (this.gameMode === 'FFA' ? 'CAMPEÃO DO FFA!' : 'SEU TIME VENCEU!')
            : (this.gameMode === 'FFA' ? 'PARTIDA ENCERRADA' : 'TIME INIMIGO VENCEU!');

        this.add.text(width / 2, height / 2 - 120, titleText, {
            fontSize: '72px', color: isPlayerWin ? '#00ffff' : '#ff0000',
            fontStyle: 'bold', fontFamily: 'Space Grotesk'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        if (this.gameMode !== 'FFA') {
            this.add.text(width / 2, height / 2, `RESULTADO FINAL: ${this.teamScores.player} - ${this.teamScores.enemy}`, {
                fontSize: '48px', color: '#ffffff', fontFamily: 'Space Grotesk'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        } else {
            const winnerName = this.player ? this.player.characterId.toUpperCase() : 'DESCONHECIDO';
            this.add.text(width / 2, height / 2, `VENCEDOR: ${winnerName}`, {
                fontSize: '36px', color: '#ffffff', fontFamily: 'Space Grotesk'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        }

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


