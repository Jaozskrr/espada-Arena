import Phaser from 'phaser';
import { StackManager } from '../systems/StackManager';

export class Enemy extends Phaser.GameObjects.Arc {
    constructor(scene, x, y, characterId = 'ulquiorra') {
        const colors = {
            yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
            ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
            szayel: 0xff77cc, aaroniero: 0x4800ff
        };
        const color = colors[characterId] || 0xffffff;

        super(scene, x, y, 20, 0, 360, false, color, 0.8);

        this.characterId = characterId;
        this.setStrokeStyle(2, 0xffffff);

        // Calculate stacks for scaling
        const stacks = StackManager.getStacks();
        this.difficultyMultiplier = 1 + (stacks * 0.1);

        this.hp = 100 * (1 + (stacks * 0.2));
        this.maxHP = this.hp;

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setDrag(100);

        // UI
        this.nameTag = scene.add.text(x, y - 50, characterId.toUpperCase(), {
            fontSize: '12px', color: '#ffffff', fontFamily: 'Outfit'
        }).setOrigin(0.5);

        this.hpBg = scene.add.rectangle(x, y - 35, 40, 5, 0x000000, 0.5);
        this.hpBar = scene.add.rectangle(x - 20, y - 35, 40, 5, color, 1).setOrigin(0, 0.5);

        // AI Stats
        this.speed = 260 * (1 + (stacks * 0.03));
        this.lastShotTime = 0;
        this.shootInterval = Math.max(1000, 2500 - (stacks * 100));

        this.lastAbilityTime = 0;
        this.abilityCooldown = 6000;

        this.canDash = true;
        this.dashCooldown = 5000;
        this.isDashing = false;

        // Target tracking
        this.target = null;
    }

    findClosestTarget(player) {
        let targets = [player];
        const enemies = this.scene.enemies.getChildren();
        enemies.forEach(e => {
            if (e !== this && e.active) targets.push(e);
        });

        let closest = null;
        let minDist = Infinity;

        targets.forEach(t => {
            if (!t || !t.active) return;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y);
            if (dist < minDist) {
                minDist = dist;
                closest = t;
            }
        });

        return closest;
    }

    update(player) {
        if (this.hp <= 0 || !this.active) return;

        // Update UI position
        this.nameTag.setPosition(this.x, this.y - 50);
        this.hpBg.setPosition(this.x, this.y - 35);
        this.hpBar.setPosition(this.x - 20, this.y - 35);

        if (this.isDashing) return;

        // Find Closest Target (FFA)
        this.target = this.findClosestTarget(player);
        if (!this.target) return;

        // Move towards target
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Logic: Aggressive behavior
        if (distance > 350) {
            this.body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
        } else if (distance < 120) {
            const escapeAngle = angle + Math.PI;
            this.body.setVelocity(Math.cos(escapeAngle) * this.speed, Math.sin(escapeAngle) * this.speed);
        } else {
            const strafeAngle = angle + Math.PI / 2;
            this.body.setVelocity(Math.cos(strafeAngle) * (this.speed * 0.7), Math.sin(strafeAngle) * (this.speed * 0.7));
        }

        const now = this.scene.time.now;

        // Special Ability Logic
        if (now > this.lastAbilityTime + this.abilityCooldown && distance < 400) {
            this.useSpecialAbility(angle);
            this.lastAbilityTime = now;
        }

        // Random Dash (Sonído)
        if (this.canDash && distance < 500 && Math.random() < 0.005) {
            this.performSonido(angle, distance > 250 ? 1 : -0.5);
        }

        // Shoot at target
        if (now > this.lastShotTime + this.shootInterval) {
            this.shootAtTarget(angle);
            this.lastShotTime = now;
        }
    }

    useSpecialAbility(angle) {
        if (this.characterId === 'yammy') {
            const area = this.scene.add.circle(this.x, this.y, 150, 0xff4400, 0.4);
            this.scene.physics.add.existing(area);
            this.scene.enemyProjectiles.add(area);
            area.damage = 30 * this.difficultyMultiplier;
            this.scene.tweens.add({ targets: area, scale: 1.2, alpha: 0, duration: 400, onComplete: () => area.destroy() });
        } else if (this.characterId === 'starrk') {
            for (let i = 0; i < 4; i++) {
                this.scene.time.delayedCall(i * 150, () => {
                    if (this.active) this.shootAtTarget(angle + (Math.random() - 0.5) * 0.3, 12, 600);
                });
            }
        } else if (this.characterId === 'baraggan') {
            this.shootAtTarget(angle, 15, 300, 30); // Slow moving death cloud
        } else if (this.characterId === 'halibel') {
            this.shootAtTarget(angle, 20, 900, 10);
        } else if (this.characterId === 'ulquiorra') {
            this.shootAtTarget(angle, 25, 800, 12);
        } else if (this.characterId === 'nnoitra') {
            this.shootAtTarget(angle, 10, 700, 6);
            this.scene.time.delayedCall(100, () => this.shootAtTarget(angle, 10, 700, 6));
        } else if (this.characterId === 'grimmjow') {
            const area = this.scene.add.circle(this.x, this.y, 80, 0x0088ff, 0.4);
            this.scene.physics.add.existing(area);
            this.scene.enemyProjectiles.add(area);
            area.damage = 20 * this.difficultyMultiplier;
            this.scene.tweens.add({ targets: area, scale: 1.3, alpha: 0, duration: 400, onComplete: () => area.destroy() });
        } else if (this.characterId === 'zommari') {
            this.shootAtTarget(angle, 15, 1200, 5);
        } else if (this.characterId === 'szayel') {
            for (let i = -1; i <= 1; i++) this.shootAtTarget(angle + i * 0.2, 8, 500, 6);
        } else if (this.characterId === 'aaroniero') {
            this.shootAtTarget(angle, 25, 450, 15);
        }
    }

    performSonido(angle, direction) {
        this.canDash = false;
        this.isDashing = true;

        const dashSpeed = 800;
        this.body.setVelocity(Math.cos(angle) * dashSpeed * direction, Math.sin(angle) * dashSpeed * direction);

        // Ghost effect for Sonído
        const ghost = this.scene.add.circle(this.x, this.y, 20, 0xff0000, 0.4);
        this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 300,
            onComplete: () => ghost.destroy()
        });

        this.scene.time.delayedCall(200, () => {
            this.isDashing = false;
            this.body.setVelocity(0);
        });

        this.scene.time.delayedCall(this.dashCooldown, () => {
            this.canDash = true;
        });
    }

    shootAtTarget(angle, damage = 10, speed = 400, size = 6) {
        const colors = {
            yammy: 0xff4400, starrk: 0x00ccff, baraggan: 0xbb00ff, halibel: 0x00ffcc,
            ulquiorra: 0x00ff88, nnoitra: 0xffcc00, grimmjow: 0x0066ff, zommari: 0xff00ff,
            szayel: 0xff66cc, aaroniero: 0x4400ff
        };
        const color = colors[this.characterId] || 0xff3333;

        const bullet = this.scene.add.circle(this.x, this.y, size, color);
        this.scene.enemyProjectiles.add(bullet);
        bullet.body.setCircle(size);
        bullet.damage = damage * this.difficultyMultiplier;
        bullet.owner = this;

        bullet.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );

        this.scene.time.delayedCall(2000, () => {
            if (bullet.active) bullet.destroy();
        });
    }

    takeDamage(amount) {
        if (this.hp <= 0 || !this.active) return;

        this.hp -= amount;
        this.updateHPBar();

        if (this.hp <= 0) {
            this.hp = 0; // Ensure it stays at 0
            this.die();
            return;
        }

        // Flash effect only if still alive
        this.setFillStyle(0xffffff, 1);
        this.scene.time.delayedCall(50, () => {
            if (this.active) {
                const colors = {
                    yammy: 0xff4400, starrk: 0x00ccff, baraggan: 0xbb00ff, halibel: 0x00ffcc,
                    ulquiorra: 0x00ff88, nnoitra: 0xffcc00, grimmjow: 0x0066ff, zommari: 0xff00ff,
                    szayel: 0xff66cc, aaroniero: 0x4400ff
                };
                this.setFillStyle(colors[this.characterId] || 0xff3333, 0.8);
            }
        });
    }

    updateHPBar() {
        const percent = Math.max(0, this.hp / this.maxHP);
        this.hpBar.scaleX = percent;
    }

    die() {
        const scene = this.scene;
        if (!scene) return;

        // Partículas removidas a pedido do usuário
        this.destroy();
        scene.events.emit('enemyKilled');
    }

    destroy(fromScene) {
        if (this.nameTag) this.nameTag.destroy();
        if (this.hpBg) this.hpBg.destroy();
        if (this.hpBar) this.hpBar.destroy();
        super.destroy(fromScene);
    }
}

