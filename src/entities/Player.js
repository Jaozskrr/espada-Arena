import Phaser from 'phaser';
import { ScoreManager } from '../systems/ScoreManager';

import { AchievementManager } from '../systems/AchievementManager';

export class Player extends Phaser.GameObjects.Container {
    constructor(scene, x, y, characterId, bonuses) {
        super(scene, x, y);

        this.characterId = characterId;
        this.scene = scene;

        // Stats are now mostly fixed, as stacks were removed
        const baseSpeed = characterId === 'zommari' ? 400 : (characterId === 'yammy' ? 220 : 300);
        const baseHealth = characterId === 'yammy' ? 200 : 100;

        this.stats = {
            speed: baseSpeed,
            health: baseHealth,
            damageMultiplier: 1.0,
            cooldownReduction: 0
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

        this.sprite = this.scene.add.circle(0, 0, 20, color);
        this.sprite.setStrokeStyle(2, 0xffffff);
        this.add(this.sprite);

        this.indicator = this.scene.add.triangle(25, 0, 0, -5, 0, 5, 10, 0, 0xffffff);
        this.add(this.indicator);

        this.nameTag = this.scene.add.text(this.x, this.y - 35, this.characterId.toUpperCase(), {
            fontSize: '12px', fontFamily: 'Outfit', color: '#ffffff'
        }).setOrigin(0.5);

        this.hpBg = this.scene.add.rectangle(this.x, this.y - 50, 60, 8, 0x000000, 0.5);
        this.hpBar = this.scene.add.rectangle(this.x - 30, this.y - 50, 60, 8, 0x00ff00, 1).setOrigin(0, 0.5);
    }

    update(keys, pointer) {
        let vx = 0; let vy = 0;
        if (keys.W.isDown) vy = -1;
        if (keys.S.isDown) vy = 1;
        if (keys.A.isDown) vx = -1;
        if (keys.D.isDown) vx = 1;

        const velocity = new Phaser.Math.Vector2(vx, vy).normalize().scale(this.stats.speed);
        this.body.setVelocity(velocity.x, velocity.y);

        // Clamping para garantir que não saia do mapa
        const bounds = this.scene.physics.world.bounds;
        if (this.x < bounds.x) this.x = bounds.x;
        if (this.x > bounds.right) this.x = bounds.right;
        if (this.y < bounds.y) this.y = bounds.y;
        if (this.y > bounds.bottom) this.y = bounds.bottom;

        const angle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
        this.setRotation(angle);
        this.updateUIPosition();

        if (pointer.isDown && this.canBasicAttack) this.handleBasicAttack();
        if (keys.Q.isDown && this.canCastQ) this.handleAbilityQ();
        if (keys.E.isDown && this.canCastE) this.handleAbilityE();

        // Resurrection now requires 25 points
        if (keys.R.isDown && this.canCastR && ScoreManager.canResurrect(this.characterId)) {
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
        const colors = {
            yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
            ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
            szayel: 0xff77cc, aaroniero: 0x4800ff
        };
        const basicSize = this.characterId === 'yammy' ? 15 : 4;
        this.spawnProjectile(this.rotation, 800, 8, colors[this.characterId], basicSize);
        this.scene.time.delayedCall(cooldown, () => { this.canBasicAttack = true; });
    }

    handleAbilityQ() {
        if (!this.canCastQ) return;
        this.canCastQ = false;
        const cooldown = (this.characterId === 'starrk' ? 1200 : 3000) * (1 - this.stats.cooldownReduction);

        if (this.characterId === 'yammy') {
            this.spawnProjectile(this.rotation, 400, 40, 0xff0000, 30);
        } else if (this.characterId === 'starrk') {
            for (let i = 0; i < 5; i++) {
                this.scene.time.delayedCall(i * 100, () => {
                    if (this.active) this.spawnProjectile(this.rotation + (Math.random() - 0.5) * 0.4, 700, 5, 0x00d9ff);
                });
            }
        } else if (this.characterId === 'baraggan') {
            this.spawnProjectile(this.rotation, 300, 15, 0x8b00ff, 40);
        } else if (this.characterId === 'halibel') {
            this.spawnProjectile(this.rotation, 1100, 20, 0x00ffd0, 10);
        } else if (this.characterId === 'ulquiorra') {
            this.spawnProjectile(this.rotation, 900, 25, 0x00ff00, 12);
        } else if (this.characterId === 'nnoitra') {
            this.spawnProjectile(this.rotation - 0.1, 800, 15, 0xffaa00);
            this.spawnProjectile(this.rotation + 0.1, 800, 15, 0xffaa00);
        } else if (this.characterId === 'grimmjow') {
            this.spawnProjectile(this.rotation, 500, 35, 0x0066ff, 20);
        } else if (this.characterId === 'zommari') {
            const proj = this.spawnProjectile(this.rotation, 1200, 10, 0xff00ff, 15);
            if (proj) { proj.isStun = true; proj.stunDuration = 1500; }
        } else if (this.characterId === 'szayel') {
            for (let i = -1; i <= 1; i++) this.spawnProjectile(this.rotation + i * 0.2, 600, 8, 0xff77cc, 6);
        } else if (this.characterId === 'aaroniero') {
            this.spawnProjectile(this.rotation, 450, 30, 0x4800ff, 18);
        }
        this.scene.time.delayedCall(cooldown, () => { this.canCastQ = true; });
    }

    handleAbilityE() {
        if (!this.canCastE) return;
        this.canCastE = false;
        const cooldown = 5000 * (1 - this.stats.cooldownReduction);

        if (this.characterId === 'yammy') {
            this.createAOE(150, 0xff0000, 30);
        } else if (this.characterId === 'starrk') {
            // Colmillo — raio retangular na direção apontada
            const beamLen = 400;
            const beamH = 28;
            const angle = this.rotation;
            const cx = this.x + Math.cos(angle) * (beamLen / 2);
            const cy = this.y + Math.sin(angle) * (beamLen / 2);

            // Glow layer (wider, semi-transparent)
            const glow = this.scene.add.rectangle(cx, cy, beamLen, beamH + 14, 0x00d9ff, 0.25);
            glow.setRotation(angle);
            glow.setDepth(4);
            this.scene.tweens.add({
                targets: glow, alpha: 0, scaleY: 0.1,
                duration: 350, ease: 'Cubic.easeOut',
                onComplete: () => { if (glow.active) glow.destroy(); }
            });

            // Core beam (bright, thin)
            const beam = this.scene.add.rectangle(cx, cy, beamLen, beamH, 0x00d9ff, 0.9);
            beam.setRotation(angle);
            beam.setDepth(5);
            this.scene.tweens.add({
                targets: beam, alpha: 0, scaleY: 0.05,
                duration: 280, ease: 'Cubic.easeOut',
                onComplete: () => { if (beam.active) beam.destroy(); }
            });

            // Hitbox
            const hitbox = this.scene.add.rectangle(cx, cy, beamLen, beamH, 0x00d9ff, 0);
            hitbox.setRotation(angle);
            this.scene.physics.add.existing(hitbox);
            this.scene.projectiles.add(hitbox);
            hitbox.damage = 25 * this.stats.damageMultiplier;
            hitbox.owner = this;
            this.scene.time.delayedCall(180, () => { if (hitbox.active) hitbox.destroy(); });

        } else if (this.characterId === 'baraggan') {
            const area = this.createAOE(120, 0x8b00ff, 40);
            area.isProximity = true;
        } else if (this.characterId === 'halibel') {
            this.createDirectionalSquare(200, 100, 0x00ffd0, 12);
        } else if (this.characterId === 'ulquiorra') {
            const dashDistance = 200;
            const targetX = this.x + Math.cos(this.rotation) * dashDistance;
            const targetY = this.y + Math.sin(this.rotation) * dashDistance;
            this.createDashGhost();
            this.scene.tweens.add({ targets: this, x: targetX, y: targetY, duration: 150, ease: 'Cubic.easeOut' });
        } else if (this.characterId === 'nnoitra') {
            this.createSlashAbility();

        } else if (this.characterId === 'grimmjow') {
            this.createAOE(80, 0x0066ff, 25);
        } else if (this.characterId === 'zommari') {
            const targetX = this.x + Math.cos(this.rotation) * 400;
            const targetY = this.y + Math.sin(this.rotation) * 400;
            this.createDashGhost(); this.setPosition(targetX, targetY);
        } else if (this.characterId === 'szayel') {
            const area = this.createAOE(200, 0xff77cc, 15);
            area.isCountBased = true;
        } else if (this.characterId === 'aaroniero') {
            for (let i = -2; i <= 2; i++) this.spawnProjectile(this.rotation + i * 0.3, 500, 12, 0x4800ff, 8);
        }
        this.scene.time.delayedCall(cooldown, () => { this.canCastE = true; });
    }

    createAOE(radius, color, damage) {
        const area = this.scene.add.circle(this.x, this.y, radius, color, 0.3);
        this.scene.physics.add.existing(area);
        this.scene.projectiles.add(area);
        area.damage = damage * this.stats.damageMultiplier;
        area.radius = radius;
        this.scene.tweens.add({ targets: area, scale: 1.5, alpha: 0, duration: 350, onComplete: () => area.destroy() });
        return area;
    }

    createDirectionalSquare(width, height, color, damage) {
        const x = this.x + Math.cos(this.rotation) * (width / 2);
        const y = this.y + Math.sin(this.rotation) * (width / 2);
        const area = this.scene.add.rectangle(x, y, width, height, color, 0.3);
        area.setRotation(this.rotation);
        this.scene.physics.add.existing(area);
        this.scene.projectiles.add(area);
        area.damage = damage * this.stats.damageMultiplier;
        area.isSlow = true; area.slowDuration = 2000;
        this.scene.tweens.add({ targets: area, alpha: 0, duration: 500, onComplete: () => area.destroy() });
        return area;
    }

    createSlashAbility() {
        const slashDamage = 50 * this.stats.damageMultiplier;
        const baseAngle = this.rotation;
        // 3 slashes: left, center, right — staggered in time (ms)
        const slashAngles = [
            { offset: -0.55, delay: 0 },
            { offset: 0, delay: 70 },
            { offset: 0.55, delay: 140 }
        ];

        slashAngles.forEach(({ offset, delay }) => {
            this.scene.time.delayedCall(delay, () => {
                if (!this.active) return;
                const angle = baseAngle + offset;
                const slashLen = 140;
                const slashW = 10;
                const dist = 80; // distance in front of player

                const cx = this.x + Math.cos(angle) * dist;
                const cy = this.y + Math.sin(angle) * dist;

                // ── Visual slash line (thin rectangle) ──
                const visual = this.scene.add.rectangle(cx, cy, slashLen, slashW, 0xffaa00, 0.9);
                visual.setRotation(angle);
                visual.setDepth(5);

                this.scene.tweens.add({
                    targets: visual,
                    scaleX: 1.4, scaleY: 0.1,
                    alpha: 0,
                    x: cx + Math.cos(angle) * 30,
                    y: cy + Math.sin(angle) * 30,
                    duration: 220,
                    ease: 'Cubic.easeOut',
                    onComplete: () => { if (visual.active) visual.destroy(); }
                });

                // ── Hitbox rectangle (invisible, registered as projectile) ──
                const hitbox = this.scene.add.rectangle(cx, cy, slashLen, 40, 0xffaa00, 0);
                hitbox.setRotation(angle);
                this.scene.physics.add.existing(hitbox);
                this.scene.projectiles.add(hitbox);
                hitbox.damage = slashDamage;
                hitbox.owner = this;

                this.scene.time.delayedCall(120, () => { if (hitbox.active) hitbox.destroy(); });
            });
        });
    }

    createDashGhost() {
        const colors = {
            yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
            ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
            szayel: 0xff77cc, aaroniero: 0x4800ff
        };
        const ghost = this.scene.add.circle(this.x, this.y, 20, colors[this.characterId], 0.5);
        this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() });
    }

    handleResurrection() {
        if (!this.canCastR || this.isResurrectionActive) return;
        this.canCastR = false;
        this.isResurrectionActive = true;
        AchievementManager.recordResurrection();
        this.sprite.setStrokeStyle(6, 0xffffff);
        this.scene.cameras.main.shake(500, 0.02);
        this.scene.cameras.main.flash(500, 255, 255, 255, 0.5);
        const oldMultiplier = this.stats.damageMultiplier;
        const oldSpeed = this.stats.speed;
        this.stats.damageMultiplier *= 2.5;
        this.stats.speed *= 1.4;

        this.scene.time.delayedCall(10000, () => {
            this.isResurrectionActive = false;
            this.stats.damageMultiplier = oldMultiplier;
            this.stats.speed = oldSpeed;
            this.sprite.setStrokeStyle(2, 0xffffff);
            // Cooldown for R
            this.scene.time.delayedCall(30000, () => { this.canCastR = true; });
        });
    }

    takeDamage(amount) {
        if (this.currentHP <= 0 || this.isInvulnerable) return;
        const finalDamage = this.isResurrectionActive ? amount * 0.7 : amount;
        this.isInvulnerable = true;
        this.currentHP -= finalDamage;
        this.updateHPBar();
        this.sprite.setFillStyle(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (this.active) {
                const colors = {
                    yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
                    ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
                    szayel: 0xff77cc, aaroniero: 0x4800ff
                };
                this.sprite.setFillStyle(colors[this.characterId]);
            }
        });
        this.scene.time.delayedCall(200, () => { this.isInvulnerable = false; });
        if (this.currentHP <= 0) this.die();
    }

    die() {
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
        let finalDamage = damage;
        let finalSize = size;
        let finalSpeed = speed;
        if (this.isResurrectionActive) {
            finalDamage *= 1.8; finalSize *= 1.6; finalSpeed *= 1.3;
        }
        const proj = this.scene.add.circle(this.x, this.y, finalSize, color);
        proj.setStrokeStyle(2, 0xffffff);
        this.scene.projectiles.add(proj);
        proj.body.setCircle(finalSize);
        proj.damage = finalDamage * this.stats.damageMultiplier;
        proj.owner = this;
        proj.body.setVelocity(Math.cos(angle) * finalSpeed, Math.sin(angle) * finalSpeed);
        this.scene.time.delayedCall(2000, () => { if (proj.active) proj.destroy(); });
        return proj;
    }
}
