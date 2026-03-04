import Phaser from 'phaser';

export class Enemy extends Phaser.GameObjects.Arc {
    constructor(scene, x, y, characterId = 'ulquiorra', isAlly = false) {
        const colors = {
            yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
            ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
            szayel: 0xff77cc, aaroniero: 0x4800ff
        };
        const color = colors[characterId] || 0xffffff;

        super(scene, x, y, 20, 0, 360, false, color, 0.8);

        this.characterId = characterId;
        this.isAlly = isAlly;
        this.setStrokeStyle(2, isAlly ? 0x00ffff : 0xffffff);

        this.hp = 100;
        this.maxHP = this.hp;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Physics Setup
        if (this.body) {
            this.body.setDrag(100);
            this.body.setCircle(20);
            this.body.setCollideWorldBounds(true, 0.5, 0.5); // Rebatida suave e limite total
        }

        // UI
        this.nameTag = scene.add.text(x, y - 50, (isAlly ? "[ALIADO] " : "") + characterId.toUpperCase(), {
            fontSize: '12px', color: isAlly ? '#00ffff' : '#ffffff', fontFamily: 'Outfit'
        }).setOrigin(0.5);

        this.hpBg = scene.add.rectangle(x, y - 35, 40, 5, 0x000000, 0.5);
        this.hpBar = scene.add.rectangle(x - 20, y - 35, 40, 5, isAlly ? 0x00ffff : color, 1).setOrigin(0, 0.5);

        // AI Stats
        this.speed = 260;
        this.lastShotTime = 0;
        this.shootInterval = 2000;
        this.lastAbilityTime = 0;
        this.abilityCooldown = 6000;
        this.canDash = true;
        this.dashCooldown = 5000;
        this.isDashing = false;

        // Target tracking
        this.target = null;

        // Status Effects
        this.isStunned = false;
        this.isSlowed = false;
    }

    findTarget() {
        if (!this.active || !this.scene) return null;
        let potentialTargets = [];

        if (this.isAlly) {
            potentialTargets = this.scene.enemies.getChildren();
        } else {
            potentialTargets = [];
            if (this.scene.player && this.scene.player.active) potentialTargets.push(this.scene.player);
            this.scene.allies.getChildren().forEach(a => { if (a.active) potentialTargets.push(a); });

            if (this.scene.gameMode === 'FFA') {
                this.scene.enemies.getChildren().forEach(e => {
                    if (e !== this && e.active) potentialTargets.push(e);
                });
            }
        }

        let closest = null;
        let minDist = Infinity;

        potentialTargets.forEach(t => {
            if (!t || !t.active) return;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y);
            if (dist < minDist) {
                minDist = dist;
                closest = t;
            }
        });

        return closest;
    }

    update() {
        if (!this.active || this.hp <= 0 || !this.scene) return;

        // Proteção extra contra saída do mapa
        const bounds = this.scene.physics.world.bounds;
        if (this.x < bounds.x) this.x = bounds.x;
        if (this.x > bounds.right) this.x = bounds.right;
        if (this.y < bounds.y) this.y = bounds.y;
        if (this.y > bounds.bottom) this.y = bounds.bottom;

        if (this.isStunned) {
            this.body.setVelocity(0, 0);
            return;
        }

        this.nameTag.setPosition(this.x, this.y - 50);
        this.hpBg.setPosition(this.x, this.y - 35);
        this.hpBar.setPosition(this.x - 20, this.y - 35);

        if (this.isDashing) return;

        this.target = this.findTarget();
        if (!this.target) {
            this.body.setVelocity(0, 0);
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);

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
        if (now > this.lastAbilityTime + this.abilityCooldown && distance < 400) {
            this.useSpecialAbility(angle);
            this.lastAbilityTime = now;
        }
        if (this.canDash && distance < 500 && Math.random() < 0.005) {
            this.performSonido(angle, distance > 250 ? 1 : -0.5);
        }
        if (now > this.lastShotTime + this.shootInterval) {
            this.shootAtTarget(angle);
            this.lastShotTime = now;
        }
    }

    applyStun(duration) {
        if (!this.active) return;
        this.isStunned = true;
        this.setFillStyle(0xffffff, 1);
        this.scene.time.delayedCall(duration, () => {
            if (this.active) {
                this.isStunned = false;
                const colors = {
                    yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
                    ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
                    szayel: 0xff77cc, aaroniero: 0x4800ff
                };
                this.setFillStyle(colors[this.characterId] || 0xff3333, 0.8);
            }
        });
    }

    applySlow(duration, factor = 0.5) {
        if (!this.active || this.isSlowed) return;
        this.isSlowed = true;
        const originalSpeed = this.speed;
        this.speed *= factor;
        this.setAlpha(0.6);
        this.scene.time.delayedCall(duration, () => {
            if (this.active) {
                this.isSlowed = false;
                this.speed = originalSpeed;
                this.setAlpha(0.8);
            }
        });
    }

    useSpecialAbility(angle) {
        if (!this.active || !this.scene) return;
        let group = this.isAlly ? this.scene.projectiles : this.scene.enemyProjectiles;

        if (this.characterId === 'yammy') {
            const area = this.scene.add.circle(this.x, this.y, 150, this.isAlly ? 0x00ffff : 0xff0000, 0.4);
            this.scene.physics.add.existing(area);
            if (area.body) area.body.setCircle(150);
            group.add(area);
            area.damage = 30;
            area.owner = this;
            this.scene.tweens.add({ targets: area, scale: 1.2, alpha: 0, duration: 400, onComplete: () => { if (area.active) area.destroy(); } });
        } else if (this.characterId === 'starrk') {
            for (let i = 0; i < 4; i++) {
                this.scene.time.delayedCall(i * 150, () => {
                    if (this.active) this.shootAtTarget(angle + (Math.random() - 0.5) * 0.3, 12, 600);
                });
            }
        } else if (this.characterId === 'baraggan') {
            this.shootAtTarget(angle, 15, 300, 30);
        } else if (this.characterId === 'halibel') {
            this.shootAtTarget(angle, 20, 900, 10);
        } else if (this.characterId === 'ulquiorra') {
            this.shootAtTarget(angle, 25, 800, 12);
        } else if (this.characterId === 'nnoitra') {
            this.shootAtTarget(angle, 10, 700, 6);
            this.scene.time.delayedCall(100, () => { if (this.active) this.shootAtTarget(angle + 0.1, 10, 700, 6); });
        } else if (this.characterId === 'grimmjow') {
            const area = this.scene.add.circle(this.x, this.y, 80, this.isAlly ? 0x00ffff : 0x0066ff, 0.4);
            this.scene.physics.add.existing(area);
            if (area.body) area.body.setCircle(80);
            group.add(area);
            area.damage = 20;
            area.owner = this;
            this.scene.tweens.add({ targets: area, scale: 1.3, alpha: 0, duration: 400, onComplete: () => { if (area.active) area.destroy(); } });
        } else if (this.characterId === 'zommari') {
            this.shootAtTarget(angle, 15, 1200, 5);
        } else if (this.characterId === 'szayel') {
            for (let i = -1; i <= 1; i++) this.shootAtTarget(angle + i * 0.2, 8, 500, 6);
        } else if (this.characterId === 'aaroniero') {
            this.shootAtTarget(angle, 25, 450, 15);
        }
    }

    performSonido(angle, direction) {
        if (!this.active) return;
        this.canDash = false;
        this.isDashing = true;
        const dashSpeed = 800;
        this.body.setVelocity(Math.cos(angle) * dashSpeed * direction, Math.sin(angle) * dashSpeed * direction);
        if (this.scene) {
            const ghostColor = this.isAlly ? 0x00ffff : 0xffffff;
            const ghost = this.scene.add.circle(this.x, this.y, 20, ghostColor, 0.4);
            this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => { if (ghost.active) ghost.destroy(); } });
        }
        this.scene.time.delayedCall(200, () => {
            if (this.active) {
                this.isDashing = false;
                this.body.setVelocity(0);
            }
        });
        this.scene.time.delayedCall(this.dashCooldown, () => { if (this.active) this.canDash = true; });
    }

    shootAtTarget(angle, damage = 10, speed = 400, size = 6) {
        if (!this.active || !this.scene) return;
        const colors = {
            yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
            ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
            szayel: 0xff77cc, aaroniero: 0x4800ff
        };
        const color = colors[this.characterId] || 0xff3333;
        const bullet = this.scene.add.circle(this.x, this.y, size, color);
        const group = this.isAlly ? this.scene.projectiles : this.scene.enemyProjectiles;
        group.add(bullet);
        if (bullet.body) bullet.body.setCircle(size);
        bullet.damage = damage;
        bullet.owner = this;
        bullet.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.scene.time.delayedCall(2000, () => { if (bullet.active) bullet.destroy(); });
    }

    takeDamage(amount, killer = null) {
        if (!this.active || this.hp <= 0) return;
        this.hp = Math.max(-10, this.hp - amount);
        this.updateHPBar();
        if (this.hp <= 0) {
            this.hp = 0;
            this.die(killer);
            return;
        }
        this.setFillStyle(0xffffff, 1);
        this.scene.time.delayedCall(50, () => {
            if (this.active) {
                const colors = {
                    yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0,
                    ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff,
                    szayel: 0xff77cc, aaroniero: 0x4800ff
                };
                this.setFillStyle(colors[this.characterId] || 0xff3333, 0.8);
            }
        });
    }

    updateHPBar() {
        if (this.hpBar && this.hpBar.active) {
            const percent = Math.max(0, this.hp / this.maxHP);
            this.hpBar.scaleX = percent;
        }
    }

    die(killer = null) {
        if (this.scene) {
            if (killer && killer.characterId) {
                this.scene.awardKill(killer.characterId);
            }
            // Emitir evento ANTES de destruir para que a cena possa ler o estado
            this.scene.events.emit('enemyKilled', this);
        }
        this.destroy();
    }

    destroy(fromScene) {
        if (this.nameTag) this.nameTag.destroy();
        if (this.hpBg) this.hpBg.destroy();
        if (this.hpBar) this.hpBar.destroy();
        super.destroy(fromScene);
    }
}
