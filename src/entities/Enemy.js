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

        if (this.body) {
            this.body.setDrag(150);
            this.body.setCircle(20);
            this.body.setCollideWorldBounds(true, 0.5, 0.5);
        }

        // UI
        this.nameTag = scene.add.text(x, y - 50, (isAlly ? '[ALIADO] ' : '') + characterId.toUpperCase(), {
            fontSize: '12px', color: isAlly ? '#00ffff' : '#ffffff', fontFamily: 'Outfit'
        }).setOrigin(0.5);
        this.hpBg = scene.add.rectangle(x, y - 35, 40, 5, 0x000000, 0.5);
        this.hpBar = scene.add.rectangle(x - 20, y - 35, 40, 5, isAlly ? 0x00ffff : color, 1).setOrigin(0, 0.5);

        // --- Personalidade por personagem ---
        const personalities = {
            yammy: { speed: 220, shootInterval: 1600, preferredRange: 180, aggression: 0.9, accuracy: 0.85 },
            starrk: { speed: 270, shootInterval: 900, preferredRange: 320, aggression: 0.6, accuracy: 0.95 },
            baraggan: { speed: 200, shootInterval: 1800, preferredRange: 250, aggression: 0.5, accuracy: 0.80 },
            halibel: { speed: 280, shootInterval: 1100, preferredRange: 280, aggression: 0.7, accuracy: 0.88 },
            ulquiorra: { speed: 290, shootInterval: 1000, preferredRange: 300, aggression: 0.75, accuracy: 0.93 },
            nnoitra: { speed: 310, shootInterval: 800, preferredRange: 150, aggression: 0.95, accuracy: 0.78 },
            grimmjow: { speed: 320, shootInterval: 850, preferredRange: 160, aggression: 1.0, accuracy: 0.82 },
            zommari: { speed: 350, shootInterval: 1300, preferredRange: 350, aggression: 0.6, accuracy: 0.96 },
            szayel: { speed: 240, shootInterval: 1200, preferredRange: 270, aggression: 0.65, accuracy: 0.87 },
            aaroniero: { speed: 260, shootInterval: 1400, preferredRange: 220, aggression: 0.7, accuracy: 0.83 },
        };

        const p = personalities[characterId] || { speed: 260, shootInterval: 1400, preferredRange: 250, aggression: 0.7, accuracy: 0.85 };
        this.speed = p.speed;
        this.shootInterval = p.shootInterval;
        this.preferredRange = p.preferredRange;
        this.aggression = p.aggression;
        this.accuracy = p.accuracy;  // 0-1: proportion de tiros que miram previsto vs atual

        this.lastShotTime = 0;
        this.lastAbilityTime = 0;
        this.abilityCooldown = 6000;
        this.canDash = true;
        this.dashCooldown = 5000;
        this.isDashing = false;

        // Strafe direction (flips over time to feel human)
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;
        this.nextStrafeFlip = scene.time.now + Phaser.Math.Between(800, 2000);

        this.target = null;
        this.isStunned = false;
        this.isSlowed = false;
    }

    findTarget() {
        if (!this.active || !this.scene) return null;
        let potentialTargets = [];

        if (this.isAlly) {
            potentialTargets = this.scene.enemies.getChildren().filter(e => e.active);
        } else {
            if (this.scene.player && this.scene.player.active) potentialTargets.push(this.scene.player);
            this.scene.allies.getChildren().forEach(a => { if (a.active) potentialTargets.push(a); });
            if (this.scene.gameMode === 'FFA') {
                this.scene.enemies.getChildren().forEach(e => { if (e !== this && e.active) potentialTargets.push(e); });
            }
        }

        // Prioritise lowest HP target within aggression range (human-like "focus fire")
        let best = null;
        let bestScore = Infinity;
        potentialTargets.forEach(t => {
            if (!t || !t.active) return;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y);
            // Score = distance + HP weight (go for wounded targets)
            const hp = t.currentHP ?? t.hp ?? 100;
            const score = dist * 0.6 + hp * 1.5;
            if (score < bestScore) { bestScore = score; best = t; }
        });
        return best;
    }

    // Predictive aiming: returns the angle aimed at where the target WILL be
    aimAngle(bulletSpeed = 450) {
        if (!this.target) return 0;
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const travelTime = dist / bulletSpeed;

        // Predict position based on target body velocity (if available)
        const tvx = this.target.body?.velocity?.x ?? 0;
        const tvy = this.target.body?.velocity?.y ?? 0;
        const predX = this.target.x + tvx * travelTime;
        const predY = this.target.y + tvy * travelTime;

        // Blend between current and predicted position based on accuracy stat
        const blend = this.accuracy;
        const aimX = this.target.x + (predX - this.target.x) * blend;
        const aimY = this.target.y + (predY - this.target.y) * blend;

        // Add tiny random spread (less accurate at range)
        const spread = (1 - this.accuracy) * 0.25;
        return Math.atan2(aimY - this.y, aimX - this.x) + (Math.random() - 0.5) * spread;
    }

    update() {
        if (!this.active || this.hp <= 0 || !this.scene) return;

        // Clamp to world bounds
        const bounds = this.scene.physics.world.bounds;
        this.x = Phaser.Math.Clamp(this.x, bounds.x, bounds.right);
        this.y = Phaser.Math.Clamp(this.y, bounds.y, bounds.bottom);

        if (this.isStunned) { this.body.setVelocity(0, 0); return; }

        this.nameTag.setPosition(this.x, this.y - 50);
        this.hpBg.setPosition(this.x, this.y - 35);
        this.hpBar.setPosition(this.x - 20, this.y - 35);

        if (this.isDashing) return;

        this.target = this.findTarget();
        if (!this.target) { this.body.setVelocity(0, 0); return; }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const toTarget = Math.atan2(dy, dx);

        // --- Flip strafe direction periodically (human-like evasion) ---
        const now = this.scene.time.now;
        if (now > this.nextStrafeFlip) {
            this.strafeDir *= -1;
            this.nextStrafeFlip = now + Phaser.Math.Between(600, 2200);
        }

        const preferred = this.preferredRange;

        // Movement logic
        let vx = 0, vy = 0;
        if (distance > preferred + 60) {
            // Approach — move towards target + slight strafe
            const strafeAngle = toTarget + (Math.PI / 2) * this.strafeDir * 0.4;
            vx = Math.cos(strafeAngle) * this.speed;
            vy = Math.sin(strafeAngle) * this.speed;
        } else if (distance < preferred - 60) {
            // Back off — retreat + strafe sideways
            const retreatAngle = toTarget + Math.PI + (Math.PI / 2) * this.strafeDir * 0.3;
            vx = Math.cos(retreatAngle) * this.speed;
            vy = Math.sin(retreatAngle) * this.speed;
        } else {
            // In preferred range — strafe sideways around target
            const strafeAngle = toTarget + (Math.PI / 2) * this.strafeDir;
            vx = Math.cos(strafeAngle) * (this.speed * 0.75);
            vy = Math.sin(strafeAngle) * (this.speed * 0.75);
        }

        // Aggressive characters close gap faster when target is low HP
        const targetHP = this.target.currentHP ?? this.target.hp ?? 100;
        if (this.aggression > 0.85 && targetHP < 30) {
            vx += Math.cos(toTarget) * this.speed * 0.5;
            vy += Math.sin(toTarget) * this.speed * 0.5;
        }

        this.body.setVelocity(vx, vy);

        // --- Sonido dash (probability influenced by aggression) ---
        if (this.canDash && distance < 500 && Math.random() < 0.003 * this.aggression) {
            this.performSonido(toTarget, distance > this.preferredRange ? 1 : -0.6);
        }

        // --- Special ability ---
        if (now > this.lastAbilityTime + this.abilityCooldown && distance < preferred + 100) {
            this.useSpecialAbility(this.aimAngle());
            this.lastAbilityTime = now;
        }

        // --- Shoot with predictive aim ---
        if (now > this.lastShotTime + this.shootInterval) {
            this.shootAtTarget(this.aimAngle());
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
                const colors = { yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0, ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff, szayel: 0xff77cc, aaroniero: 0x4800ff };
                this.setFillStyle(colors[this.characterId] || 0xff3333, 0.8);
            }
        });
    }

    applySlow(duration, factor = 0.5) {
        if (!this.active || this.isSlowed) return;
        this.isSlowed = true;
        const original = this.speed;
        this.speed *= factor;
        this.setAlpha(0.6);
        this.scene.time.delayedCall(duration, () => {
            if (this.active) { this.isSlowed = false; this.speed = original; this.setAlpha(0.8); }
        });
    }

    useSpecialAbility(angle) {
        if (!this.active || !this.scene) return;
        const group = this.isAlly ? this.scene.projectiles : this.scene.enemyProjectiles;

        if (this.characterId === 'yammy') {
            const area = this.scene.add.circle(this.x, this.y, 150, this.isAlly ? 0x00ffff : 0xff0000, 0.4);
            this.scene.physics.add.existing(area);
            if (area.body) area.body.setCircle(150);
            group.add(area); area.damage = 30; area.owner = this;
            this.scene.tweens.add({ targets: area, scale: 1.2, alpha: 0, duration: 400, onComplete: () => { if (area.active) area.destroy(); } });
        } else if (this.characterId === 'starrk') {
            for (let i = 0; i < 4; i++) {
                this.scene.time.delayedCall(i * 120, () => { if (this.active) this.shootAtTarget(angle + (Math.random() - 0.5) * 0.2, 12, 650); });
            }
        } else if (this.characterId === 'baraggan') {
            this.shootAtTarget(angle, 20, 300, 35);
        } else if (this.characterId === 'halibel') {
            this.shootAtTarget(angle, 20, 900, 10);
        } else if (this.characterId === 'ulquiorra') {
            this.shootAtTarget(angle, 25, 850, 12);
        } else if (this.characterId === 'nnoitra') {
            this.shootAtTarget(angle - 0.15, 12, 700, 6);
            this.scene.time.delayedCall(80, () => { if (this.active) this.shootAtTarget(angle + 0.15, 12, 700, 6); });
        } else if (this.characterId === 'grimmjow') {
            const area = this.scene.add.circle(this.x, this.y, 80, this.isAlly ? 0x00ffff : 0x0066ff, 0.4);
            this.scene.physics.add.existing(area);
            if (area.body) area.body.setCircle(80);
            group.add(area); area.damage = 20; area.owner = this;
            this.scene.tweens.add({ targets: area, scale: 1.3, alpha: 0, duration: 400, onComplete: () => { if (area.active) area.destroy(); } });
        } else if (this.characterId === 'zommari') {
            this.shootAtTarget(angle, 15, 1300, 5);
        } else if (this.characterId === 'szayel') {
            for (let i = -1; i <= 1; i++) this.shootAtTarget(angle + i * 0.18, 8, 530, 6);
        } else if (this.characterId === 'aaroniero') {
            this.shootAtTarget(angle, 25, 480, 15);
        }
    }

    performSonido(angle, direction) {
        if (!this.active) return;
        this.canDash = false; this.isDashing = true;
        this.body.setVelocity(Math.cos(angle) * 850 * direction, Math.sin(angle) * 850 * direction);
        if (this.scene) {
            const ghost = this.scene.add.circle(this.x, this.y, 20, this.isAlly ? 0x00ffff : 0xffffff, 0.35);
            this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 280, onComplete: () => { if (ghost.active) ghost.destroy(); } });
        }
        this.scene.time.delayedCall(180, () => { if (this.active) { this.isDashing = false; this.body.setVelocity(0); } });
        this.scene.time.delayedCall(this.dashCooldown, () => { if (this.active) this.canDash = true; });
    }

    shootAtTarget(angle, damage = 10, speed = 450, size = 6) {
        if (!this.active || !this.scene) return;
        const colors = { yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0, ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff, szayel: 0xff77cc, aaroniero: 0x4800ff };
        const bullet = this.scene.add.circle(this.x, this.y, size, colors[this.characterId] || 0xff3333);
        const group = this.isAlly ? this.scene.projectiles : this.scene.enemyProjectiles;
        group.add(bullet);
        if (bullet.body) bullet.body.setCircle(size);
        bullet.damage = damage; bullet.owner = this;
        bullet.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.scene.time.delayedCall(2000, () => { if (bullet.active) bullet.destroy(); });
    }

    takeDamage(amount, killer = null) {
        if (!this.active || this.hp <= 0) return;
        this.hp = Math.max(-10, this.hp - amount);
        this.updateHPBar();
        if (this.hp <= 0) { this.hp = 0; this.die(killer); return; }
        this.setFillStyle(0xffffff, 1);
        this.scene.time.delayedCall(50, () => {
            if (this.active) {
                const colors = { yammy: 0xff0000, starrk: 0x00d9ff, baraggan: 0x8b00ff, halibel: 0x00ffd0, ulquiorra: 0x00ff00, nnoitra: 0xffaa00, grimmjow: 0x0066ff, zommari: 0xff00ff, szayel: 0xff77cc, aaroniero: 0x4800ff };
                this.setFillStyle(colors[this.characterId] || 0xff3333, 0.8);
            }
        });
    }

    updateHPBar() {
        if (this.hpBar && this.hpBar.active) this.hpBar.scaleX = Math.max(0, this.hp / this.maxHP);
    }

    die(killer = null) {
        if (this.scene) {
            if (killer && killer.characterId) this.scene.awardKill(killer.characterId);
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
