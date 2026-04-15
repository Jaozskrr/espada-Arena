const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const highscoreEl = document.getElementById('highscore');
const powerupEl = document.getElementById('powerup-status');

// Canvas setup
canvas.width = 800;
canvas.height = 600;

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let highscore = localStorage.getItem('neonDefenderHighscore') || 0;
let level = 1;
let frames = 0;

// Update Highscore UI
highscoreEl.innerText = highscore;

// Entities
let player;
let bullets = [];
let enemies = [];
let powerups = [];
let particles = [];
let keys = {};
let mouse = { x: 0, y: 0 };

// Constants
const FRICTION = 0.98;
const PLAYER_SPEED = 0.5;
const MAX_PLAYER_SPEED = 5;

class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;
        this.vx = 0;
        this.vy = 0;
        this.color = '#39ff14';
        this.hasShield = false;
        this.shieldTime = 0;
        this.angle = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Draw Shield
        if (this.hasShield) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00f3ff';
        }

        // Draw Player Ship (Triangle)
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.restore();
    }

    update() {
        // Mechanic 1: Inertia Movement
        if (keys['ArrowUp'] || keys['w']) this.vy -= PLAYER_SPEED;
        if (keys['ArrowDown'] || keys['s']) this.vy += PLAYER_SPEED;
        if (keys['ArrowLeft'] || keys['a']) this.vx -= PLAYER_SPEED;
        if (keys['ArrowRight'] || keys['d']) this.vx += PLAYER_SPEED;

        this.vx *= FRICTION;
        this.vy *= FRICTION;

        // Speed limit
        this.vx = Math.max(Math.min(this.vx, MAX_PLAYER_SPEED), -MAX_PLAYER_SPEED);
        this.vy = Math.max(Math.min(this.vy, MAX_PLAYER_SPEED), -MAX_PLAYER_SPEED);

        this.x += this.vx;
        this.y += this.vy;

        // Update Angle towards mouse
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        this.angle = Math.atan2(dy, dx) + Math.PI / 2;

        // Screen Wrap-around
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        if (this.hasShield) {
            this.shieldTime--;
            if (this.shieldTime <= 0) {
                this.hasShield = false;
                powerupEl.innerText = '';
            } else {
                powerupEl.innerText = `SHIELD: ${(this.shieldTime / 60).toFixed(1)}s`;
            }
        }
    }
}

class Bullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 3;
        this.color = '#fff';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
}

class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'chaser'
        this.radius = 12;
        this.color = '#ff00ff';
        this.speed = 2 + (level * 0.2);
    }

    draw() {
        ctx.beginPath();
        ctx.rect(this.x - 10, this.y - 10, 20, 20);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
    }

    update() {
        // Mechanic 3: Chaser AI
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 3;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
    }
}

class Powerup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.color = '#00f3ff';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '10px Orbitron';
        ctx.fillStyle = this.color;
        ctx.fillText('S', this.x, this.y);
    }
}

function spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * canvas.width; y = -20; }
    else if (edge === 1) { x = Math.random() * canvas.width; y = canvas.height + 20; }
    else if (edge === 2) { x = -20; y = Math.random() * canvas.height; }
    else { x = canvas.width + 20; y = Math.random() * canvas.height; }
    
    enemies.push(new Enemy(x, y, 'chaser'));
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function initGame() {
    gameState = 'PLAYING';
    score = 0;
    level = 1;
    player = new Player();
    bullets = [];
    enemies = [];
    powerups = [];
    particles = [];
    scoreEl.innerText = '0';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
}

function gameOver() {
    gameState = 'GAMEOVER';
    finalScoreEl.innerText = score;
    gameOverScreen.classList.remove('hidden');
    
    if (score > highscore) {
        highscore = score;
        localStorage.setItem('neonDefenderHighscore', highscore);
        highscoreEl.innerText = highscore;
    }
}

// Game Loop
function animate() {
    window.requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'PLAYING') {
        frames++;
        
        // Mechanic 5: Progressão Automática
        const spawnInterval = Math.max(10, 60 - Math.floor(score / 500) * 5);
        if (frames % spawnInterval === 0) {
            spawnEnemy();
        }

        if (frames % 1000 === 0) {
            level++;
            // Spawn Powerup
            powerups.push(new Powerup(Math.random() * canvas.width, Math.random() * canvas.height));
        }

        player.update();
        player.draw();

        // Update Bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            bullet.update();
            bullet.draw();
            
            // Remove bullets off screen
            if (bullet.x < -20 || bullet.x > canvas.width + 20 || bullet.y < -20 || bullet.y > canvas.height + 20) {
                bullets.splice(i, 1);
            }
        }

        // Update Enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            enemy.update();
            enemy.draw();

            // Collision with Player
            const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (distToPlayer < player.radius + enemy.radius) {
                if (player.hasShield) {
                    enemies.splice(i, 1);
                    createExplosion(enemy.x, enemy.y, enemy.color);
                    score += 50;
                    scoreEl.innerText = score;
                } else {
                    createExplosion(player.x, player.y, player.color);
                    gameOver();
                    break;
                }
            }

            // Collision with Bullets
            for (let j = bullets.length - 1; j >= 0; j--) {
                const bullet = bullets[j];
                const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
                if (dist < bullet.radius + enemy.radius) {
                    createExplosion(enemy.x, enemy.y, enemy.color);
                    enemies.splice(i, 1);
                    bullets.splice(j, 1);
                    score += 100;
                    scoreEl.innerText = score;
                    break; // Enemy destroyed, next enemy
                }
            }
        }

        // Powerups
        for (let i = powerups.length - 1; i >= 0; i--) {
            const pu = powerups[i];
            pu.draw();
            const dist = Math.hypot(player.x - pu.x, player.y - pu.y);
            if (dist < player.radius + pu.radius) {
                player.hasShield = true;
                player.shieldTime = 600; // 10 seconds
                powerups.splice(i, 1);
            }
        }

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.update();
            p.draw();
            if (p.alpha <= 0) particles.splice(i, 1);
        }
    }
}

// Controls
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === ' ' || e.code === 'Space') {
        if (gameState === 'START' || gameState === 'GAMEOVER') {
            initGame();
        } else if (gameState === 'PLAYING') {
            // Mechanic 2: Laser Shooting (MOUSE AIM)
            const bulletSpeed = 10;
            const dx = mouse.x - player.x;
            const dy = mouse.y - player.y;
            const mag = Math.sqrt(dx * dx + dy * dy);
            
            let bvx = (dx / mag) * bulletSpeed;
            let bvy = (dy / mag) * bulletSpeed;
            
            bullets.push(new Bullet(player.x, player.y, bvx, bvy));
        }
    }
});

window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});


window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Start loop
animate();
