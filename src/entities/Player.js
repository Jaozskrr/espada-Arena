import Phaser from 'phaser';

export class Player extends Phaser.GameObjects.Container {
    constructor(scene, x, y, characterId, bonuses) {
        super(scene, x, y);

        this.characterId = characterId;
        this.bonuses = bonuses;
        this.scene = scene;

        // Base Stats (Differentiated by character)
        const baseSpeed = characterId === 'zommari' ? 400 : (characterId === 'yammy' ? 220 : 300);
        const baseHealth = characterId === 'yammy' ? 200 : 100;

        this.stats = {
            speed: baseSpeed * bonuses.movementSpeed,
            health: baseHealth,
            damageMultiplier: bonuses.damage,
            cooldownReduction: bonuses.cooldownReduction
        };

        this.currentHP = this.stats.health;
        this.maxHealth = this.stats.health;

        // Ability State
        this.canBasicAttack = true;
        this.canCastQ = true;
        this.canCastE = true;
        this.canCastR = true;
        this.isInvulnerable = false;
        this.isResurrectionActive = false;
        this.currentHP = 100;

        // Visual Representation
        this.setupVisuals();

        // Physics
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setCollideWorldBounds(true);
        this.body.setCircle(20, -20, -20);
    }

    setupVisuals() {
        const colors = {
            yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
            ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
            szayel: 0xff77cc, aaroniero: 0x4800ff
        };

        const color = colors[this.characterId] || 0xffffff;

        // Base Circle
        this.sprite = this.scene.add.circle(0, 0, 20, color);
        this.sprite.setStrokeStyle(2, 0xffffff);
        this.add(this.sprite);

        // Direction Indicator (Face towards cursor)
        this.indicator = this.scene.add.triangle(25, 0, 0, -5, 0, 5, 10, 0, 0xffffff);
        this.add(this.indicator);

        // UI elements (Separate from container to avoid rotation)
        this.nameTag = this.scene.add.text(this.x, this.y - 35, this.characterId.toUpperCase(), {
            fontSize: '12px',
            fontFamily: 'Outfit',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.hpBg = this.scene.add.rectangle(this.x, this.y - 50, 60, 8, 0x000000, 0.5);
        this.hpBar = this.scene.add.rectangle(this.x - 30, this.y - 50, 60, 8, 0x00ff00, 1).setOrigin(0, 0.5);

        // Aura removida a pedido do usuário
    }

    update(keys, pointer) {
        // Movement
        let vx = 0;
        let vy = 0;

        if (keys.W.isDown) vy = -1;
        if (keys.S.isDown) vy = 1;
        if (keys.A.isDown) vx = -1;
        if (keys.D.isDown) vx = 1;

        const velocity = new Phaser.Math.Vector2(vx, vy).normalize().scale(this.stats.speed);
        this.body.setVelocity(velocity.x, velocity.y);

        // Rotation towards mouse
        const angle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
        this.setRotation(angle);

        // Update UI position (follow player but don't rotate)
        this.updateUIPosition();

        // Abilities
        if (pointer.isDown && this.canBasicAttack) {
            this.handleBasicAttack();
        }
        if (keys.Q.isDown && this.canCastQ) {
            this.handleAbilityQ();
        }
        if (keys.E.isDown && this.canCastE) {
            this.handleAbilityE();
        }
        if (keys.R.isDown && this.canCastR && this.bonuses.damage >= 1.2) {
            this.handleResurrection();
        }
    }

    updateUIPosition() {
        if (!this.active) return;
        this.nameTag.setPosition(this.x, this.y - 35);
        this.hpBg.setPosition(this.x, this.y - 50);
        this.hpBar.setPosition(this.x - 30, this.y - 50);
    }

    updateHPBar() {
        const percent = Math.max(0, this.currentHP / this.maxHealth);
        this.hpBar.scaleX = percent;
        if (percent < 0.3) this.hpBar.setFillStyle(0xff0000);
        else if (percent < 0.6) this.hpBar.setFillStyle(0xffff00);
        else this.hpBar.setFillStyle(0x00ff00);
    }

    handleBasicAttack() {
        if (!this.canBasicAttack) return;
        this.canBasicAttack = false;

        const cooldown = 400 * (1 - this.stats.cooldownReduction);

        // Visual feedback based on character
        const colors = { starrk: 0x00ccff, ulquiorra: 0x00ff88, grimmjow: 0x0088ff };
        const color = colors[this.characterId];

        // Spawn a fast, small projectile for basic attack
        this.spawnProjectile(this.rotation, 800, 8, color, 4);

        this.scene.time.delayedCall(cooldown, () => {
            this.canBasicAttack = true;
        });
    }

    handleAbilityQ() {
        if (!this.canCastQ) return;
        this.canCastQ = false;

        const cooldown = (this.characterId === 'starrk' ? 1200 : 3000) * (1 - this.stats.cooldownReduction);

        if (this.characterId === 'yammy') {
            // Cero Titã (Huge slow projectile)
            this.spawnProjectile(this.rotation, 400, 40, 0xff4400, 30);
        } else if (this.characterId === 'starrk') {
            // Cero Metralhadora
            for (let i = 0; i < 5; i++) {
                this.scene.time.delayedCall(i * 100, () => {
                    const spread = (Math.random() - 0.5) * 0.4;
                    this.spawnProjectile(this.rotation + spread, 700, 5, 0x00ccff);
                });
            }
        } else if (this.characterId === 'baraggan') {
            // Respira (Purple cloud)
            this.spawnProjectile(this.rotation, 300, 15, 0xbb00ff, 40);
        } else if (this.characterId === 'halibel') {
            // Hirviendo (Fast water)
            this.spawnProjectile(this.rotation, 1100, 20, 0x00ffcc, 10);
        } else if (this.characterId === 'ulquiorra') {
            // Luz de la Luna
            this.spawnProjectile(this.rotation, 900, 25, 0x00ff88, 12);
        } else if (this.characterId === 'nnoitra') {
            // Cero Doble
            this.spawnProjectile(this.rotation - 0.1, 800, 15, 0xffcc00);
            this.spawnProjectile(this.rotation + 0.1, 800, 15, 0xffcc00);
        } else if (this.characterId === 'grimmjow') {
            // Gran Rey Cero
            this.spawnProjectile(this.rotation, 500, 35, 0x0088ff, 20);
        } else if (this.characterId === 'zommari') {
            // Amor (Fast eye-like projectile)
            this.spawnProjectile(this.rotation, 1200, 10, 0xff00ff, 5);
        } else if (this.characterId === 'szayel') {
            // Copy (Multiple small projectiles)
            for (let i = -1; i <= 1; i++) {
                this.spawnProjectile(this.rotation + i * 0.2, 600, 8, 0xff66cc, 6);
            }
        } else if (this.characterId === 'aaroniero') {
            // Glotonería (Dark blob)
            this.spawnProjectile(this.rotation, 450, 30, 0x4400ff, 18);
        }

        this.scene.time.delayedCall(cooldown, () => {
            this.canCastQ = true;
        });
    }

    handleAbilityE() {
        if (!this.canCastE) return;
        this.canCastE = false;
        const cooldown = 5000 * (1 - this.stats.cooldownReduction);

        if (this.characterId === 'yammy') {
            // Ira (Mega Stomp)
            this.createAOE(150, 0xff4400, 30);
        } else if (this.characterId === 'starrk') {
            // Colmillo (Lobos)
            this.spawnProjectile(this.rotation - 0.3, 400, 20, 0x00ccff, 10);
            this.spawnProjectile(this.rotation + 0.3, 400, 20, 0x00ccff, 10);
        } else if (this.characterId === 'baraggan') {
            // Gran Caída (Decay area)
            this.createAOE(120, 0xbb00ff, 40);
        } else if (this.characterId === 'halibel') {
            // Cascada (Water wave)
            this.createAOE(180, 0x00ffcc, 25);
        } else if (this.characterId === 'ulquiorra') {
            // Sonído Dash
            const dashDistance = 200;
            const targetX = this.x + Math.cos(this.rotation) * dashDistance;
            const targetY = this.y + Math.sin(this.rotation) * dashDistance;

            this.createDashGhost();
            this.scene.tweens.add({
                targets: this,
                x: targetX,
                y: targetY,
                duration: 150,
                ease: 'Cubic.easeOut'
            });
        } else if (this.characterId === 'nnoitra') {
            // Santa Teresa (Circular blades)
            this.createAOE(100, 0xffcc00, 50);
        } else if (this.characterId === 'grimmjow') {
            // Desgarrón (Área)
            this.createAOE(80, 0x0088ff, 25);
        } else if (this.characterId === 'zommari') {
            // Gemelos (Blink further)
            const targetX = this.x + Math.cos(this.rotation) * 400;
            const targetY = this.y + Math.sin(this.rotation) * 400;
            this.createDashGhost();
            this.setPosition(targetX, targetY);
        } else if (this.characterId === 'szayel') {
            // Teatro de Titere (Stun area)
            this.createAOE(200, 0xff66cc, 15);
        } else if (this.characterId === 'aaroniero') {
            // Nejibana (Trident spread)
            for (let i = -2; i <= 2; i++) {
                this.spawnProjectile(this.rotation + i * 0.3, 500, 12, 0x4400ff, 8);
            }
        }

        this.scene.time.delayedCall(cooldown, () => {
            this.canCastE = true;
        });
    }

    createAOE(radius, color, damage) {
        const area = this.scene.add.circle(this.x, this.y, radius, color, 0.3);
        this.scene.physics.add.existing(area);
        this.scene.projectiles.add(area);
        area.damage = damage * this.stats.damageMultiplier;
        this.scene.tweens.add({
            targets: area,
            scale: 1.5,
            alpha: 0,
            duration: 350,
            onComplete: () => area.destroy()
        });
    }

    createDashGhost() {
        const colors = {
            yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
            ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
            szayel: 0xff77cc, aaroniero: 0x4800ff
        };
        const ghost = this.scene.add.circle(this.x, this.y, 20, colors[this.characterId], 0.5);
        this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 300,
            onComplete: () => ghost.destroy()
        });
    }

    handleResurrection() {
        if (!this.canCastR || this.isResurrectionActive) return;
        this.canCastR = false;
        this.isResurrectionActive = true;

        // Visual Transformation & Sound (Visual only)
        this.sprite.setStrokeStyle(6, 0xffffff);
        this.scene.cameras.main.shake(500, 0.02);
        this.scene.cameras.main.flash(500, 255, 255, 255, 0.5);

        // Massive Buffs
        const oldMultiplier = this.stats.damageMultiplier;
        const oldSpeed = this.stats.speed;

        this.stats.damageMultiplier *= 2.5;
        this.stats.speed *= 1.4;

        // Aura removida a pedido do usuário

        // Effect Duration (10 seconds)
        this.scene.time.delayedCall(10000, () => {
            this.isResurrectionActive = false;
            this.stats.damageMultiplier = oldMultiplier;
            this.stats.speed = oldSpeed;
            this.sprite.setStrokeStyle(2, 0xffffff);
            if (this.resAura) this.resAura.destroy();

            // Long Cooldown for R (30 seconds)
            this.scene.time.delayedCall(30000, () => {
                this.canCastR = true;
            });
        });
    }

    takeDamage(amount) {
        if (this.currentHP <= 0 || this.isInvulnerable) return;

        // Resurrección reduces incoming damage by 30%
        const finalDamage = this.isResurrectionActive ? amount * 0.7 : amount;

        this.isInvulnerable = true;
        this.currentHP -= finalDamage;
        this.updateHPBar();

        // Flash Red and Invulnerability Frame
        this.sprite.setFillStyle(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (this.active) {
                const colors = { starrk: 0x00ccff, ulquiorra: 0x00ff88, grimmjow: 0x0088ff };
                this.sprite.setFillStyle(colors[this.characterId]);
            }
        });

        // End invulnerability after 200ms
        this.scene.time.delayedCall(200, () => {
            this.isInvulnerable = false;
        });

        if (this.currentHP <= 0) {
            this.die();
        }
    }

    die() {
        if (this.resAura) this.resAura.destroy();
        this.scene.events.emit('playerDied');
        this.destroy();
    }

    destroy(fromScene) {
        if (this.nameTag) this.nameTag.destroy();
        if (this.hpBg) this.hpBg.destroy();
        if (this.hpBar) this.hpBar.destroy();
        super.destroy(fromScene);
    }

    spawnProjectile(angle, speed, damage, color, size = 8) {
        // Stats scaling during Resurrección
        let finalDamage = damage;
        let finalSize = size;
        let finalSpeed = speed;

        if (this.isResurrectionActive) {
            finalDamage *= 1.8;
            finalSize *= 1.6;
            finalSpeed *= 1.3;
        }

        const proj = this.scene.add.circle(this.x, this.y, finalSize, color);
        proj.setStrokeStyle(2, 0xffffff);

        // Add to group FIRST (this enables physics and adds it to the physics world)
        this.scene.projectiles.add(proj);

        // Initialize body properties
        proj.body.setCircle(finalSize);
        proj.damage = finalDamage * this.stats.damageMultiplier;
        proj.owner = this; // Adicionado por consistência

        // Set velocity AFTER addition to physics group
        const vx = Math.cos(angle) * finalSpeed;
        const vy = Math.sin(angle) * finalSpeed;
        proj.body.setVelocity(vx, vy);

        // Trail removido a pedido do usuário

        this.scene.time.delayedCall(2000, () => {
            if (proj.active) proj.destroy();
        });
    }
}

