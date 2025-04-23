import { AssetManager } from './assetManager';
import { Player } from './player';
import { Projectile } from './projectile';

export enum EnemyType {
    HotDog = 'HotDog',
    FrenchFries = 'FrenchFries',
    Donut = 'Donut',
    Hamburger = 'Hamburger',
    Mochi = 'Mochi',
    Taco = 'Taco' // Boss
}

// Base class for all enemies
export abstract class Enemy {
    x: number;
    y: number;
    width: number;
    height: number;
    hp: number;
    maxHp: number;
    speed: number;
    image: HTMLImageElement | null = null;
    isActive: boolean = true;
    abstract type: EnemyType;
    protected assetManager: AssetManager;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        hp: number,
        speed: number,
        assetManager: AssetManager,
        imageName: string
    ) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.hp = hp;
        this.maxHp = hp;
        this.speed = speed;
        this.assetManager = assetManager;
        this.image = this.assetManager.getImage(imageName) || null;
        if (!this.image) {
             console.error(`Failed to get image "${imageName}" for enemy type ${this.constructor.name}`);
        }
    }

    // Abstract methods to be implemented by subclasses
    abstract update(deltaTime: number, canvasWidth: number, canvasHeight: number): void;
    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isActive || !this.image) return;

        ctx.drawImage(
            this.image,
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );

        const barHeight = 5;
        const barYOffset = this.height / 2 + 2;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - this.width / 2, this.y + barYOffset, this.width, barHeight);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - this.width / 2, this.y + barYOffset, this.width * (this.hp / this.maxHp), barHeight);
    }

    takeDamage(amount: number): void {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isActive = false;
            console.log(`${this.type} destroyed!`);
            // TODO: Play enemy destroy sound
            // TODO: Add score
            // TODO: Potentially spawn power-up or debris
        } else {
            console.log(`${this.type} took ${amount} damage, ${this.hp}/${this.maxHp} HP left`);
            // TODO: Play enemy hit sound
        }
    }

    isAlive(): boolean {
        return this.isActive && this.hp > 0;
    }
}

// --- Specific Enemy Implementations ---

export class HotDogEnemy extends Enemy {
    type = EnemyType.HotDog;

    constructor(x: number, y: number, assetManager: AssetManager) {
        const imageName = 'hotdog';
        const width = 50; // Use fixed width
        const height = 50; // Change to 1:1 ratio
        const hp = 1;
        const speed = 100;
        super(x, y, width, height, hp, speed, assetManager, imageName);
    }

    update(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isActive) return;
        this.y += this.speed * deltaTime;
        if (this.y > canvasHeight + this.height / 2) {
            this.isActive = false;
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isActive || !this.image) return;

        ctx.drawImage(
            this.image,
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );

        const barHeight = 5;
        const barYOffset = this.height / 2 + 2;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - this.width / 2, this.y + barYOffset, this.width, barHeight);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - this.width / 2, this.y + barYOffset, this.width * (this.hp / this.maxHp), barHeight);
    }
}

export class FrenchFriesEnemy extends Enemy {
    type = EnemyType.FrenchFries;

    constructor(x: number, y: number, assetManager: AssetManager) {
        const width = 40; // Adjust size
        const height = 50;
        const hp = 2; // Uncommon
        const speed = 120;
        const imageName = 'frenchFries';
        super(x, y, width, height, hp, speed, assetManager, imageName);
    }

    update(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isActive) return;
        this.y += this.speed * deltaTime;
        if (this.y > canvasHeight + this.height / 2) {
            this.isActive = false;
        }
    }
}

export class DonutEnemy extends Enemy {
    type = EnemyType.Donut;

    constructor(x: number, y: number, assetManager: AssetManager) {
        const width = 50; // Adjust size
        const height = 50;
        const hp = 3; // Rare
        const speed = 80;
        const imageName = 'donut';
        super(x, y, width, height, hp, speed, assetManager, imageName);
    }

    update(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isActive) return;
        this.y += this.speed * deltaTime;
        // Maybe add a slight side-to-side movement later?
        if (this.y > canvasHeight + this.height / 2) {
            this.isActive = false;
        }
    }
}

export class HamburgerEnemy extends Enemy {
    type = EnemyType.Hamburger;

    constructor(x: number, y: number, assetManager: AssetManager) {
        const width = 60; // Adjust size
        const height = 55;
        const hp = 5; // Exotic
        const speed = 60;
        const imageName = 'hamburger';
        super(x, y, width, height, hp, speed, assetManager, imageName);
    }

    update(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isActive) return;
        this.y += this.speed * deltaTime;
        if (this.y > canvasHeight + this.height / 2) {
            this.isActive = false;
        }
    }
}

export class TacoEnemy extends Enemy {
    type = EnemyType.Taco;

    private addProjectileCallback: (x: number, y: number, isPlayerProjectile: boolean, angle: number) => void;
    private playerRef: Player;
    private moveDirection: number = 1;
    private targetY: number = 100;
    private shootTimer: number = 0;
    private baseShootInterval: number = 2.0;
    private movementChangeTimer: number = 0;
    private verticalMovementTimer: number = 0;
    private verticalDirection: number = 0;
    private randomSpeedMultiplier: number = 1;

    constructor(
        x: number,
        y: number,
        hp: number,
        assetManager: AssetManager,
        addProjectileCallback: (x: number, y: number, isPlayerProjectile: boolean, angle: number) => void,
        playerRef: Player
    ) {
        const width = 80;
        const height = 65;
        const speed = 150;
        const imageName = 'taco';
        super(x, y, width, height, hp, speed, assetManager, imageName);

        this.addProjectileCallback = addProjectileCallback;
        this.playerRef = playerRef;
        this.shootTimer = this.getShootInterval();
        this.y = this.targetY;
        this.movementChangeTimer = this.getRandomTime(1, 3);
        this.verticalMovementTimer = this.getRandomTime(2, 4);
    }

    private getRandomTime(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    private getShootInterval(): number {
        const hpDifficultyBonus = Math.max(0, Math.floor((this.maxHp - 50) / 50));
        return Math.max(0.5, this.baseShootInterval - hpDifficultyBonus * 0.2);
    }

    update(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isActive || !this.isAlive()) return;

        // Update movement change timer
        this.movementChangeTimer -= deltaTime;
        if (this.movementChangeTimer <= 0) {
            // Randomly change direction or speed
            if (Math.random() > 0.4) {
                this.moveDirection *= -1; // Change direction
            }
            this.randomSpeedMultiplier = Math.random() * 0.75 + 0.5; // Speed between 0.5x and 1.25x
            this.movementChangeTimer = this.getRandomTime(1, 3);
        }

        // Update vertical movement timer
        this.verticalMovementTimer -= deltaTime;
        if (this.verticalMovementTimer <= 0) {
            // Change vertical movement pattern
            this.verticalDirection = (Math.random() - 0.5) * 2; // Between -1 and 1
            this.targetY = 80 + Math.random() * 60; // Random height between 80 and 140
            this.verticalMovementTimer = this.getRandomTime(2, 4);
        }

        // Horizontal movement
        this.x += this.moveDirection * this.speed * this.randomSpeedMultiplier * deltaTime;

        const leftBound = this.width / 2 + canvasWidth * 0.1;
        const rightBound = canvasWidth - this.width / 2 - canvasWidth * 0.1;

        if (this.moveDirection === 1 && this.x >= rightBound) {
            this.x = rightBound;
            this.moveDirection = -1;
        } else if (this.moveDirection === -1 && this.x <= leftBound) {
            this.x = leftBound;
            this.moveDirection = 1;
        }

        // Vertical movement smoothly approaches target
        if (Math.abs(this.y - this.targetY) > 1) {
            this.y += (this.targetY - this.y) * 0.1;
        }

        // Shooting behavior
        this.shootTimer -= deltaTime;
        if (this.shootTimer <= 0) {
            const dx = this.playerRef.x - this.x;
            const dy = this.playerRef.y - this.y;
            const angle = Math.atan2(dy, dx);

            this.addProjectileCallback(
                this.x,
                this.y + this.height / 2,
                false,
                angle
            );

            // Add a small variation to shoot interval
            this.shootTimer = this.getShootInterval() * (Math.random() * 0.4 + 0.8); // 0.8x to 1.2x variation
        }
    }
}

// MochiEnemy would go here if asset was available 