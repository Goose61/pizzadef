import { AssetManager } from './assetManager';
import { Player } from './player';
import { Projectile } from './projectile';
import { ItemType } from './items'; // Import ItemType
import { AudioManager } from './audio'; // Import AudioManager

export enum EnemyType {
    HotDog = 'HotDog',
    FrenchFries = 'FrenchFries',
    Donut = 'Donut',
    Hamburger = 'Hamburger',
    Mochi = 'Mochi',
    Taco = 'Taco' // Boss
}

// Callback type for spawning items
type SpawnItemCallback = (type: ItemType, x: number, y: number) => void;

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
    protected spawnItemCallback: SpawnItemCallback;
    protected audioManager: AudioManager; // Added audio manager
    
    // Hit flash effect
    private hitTimer: number = 0;
    private readonly hitDuration: number = 0.15; // Shorter flash for enemies

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        hp: number,
        speed: number,
        assetManager: AssetManager,
        imageName: string,
        spawnItemCallback: SpawnItemCallback,
        audioManager: AudioManager // Added audio manager parameter
    ) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.hp = hp;
        this.maxHp = hp;
        this.speed = speed;
        this.assetManager = assetManager;
        this.spawnItemCallback = spawnItemCallback;
        this.audioManager = audioManager; // Store audio manager
        this.image = this.assetManager.getImage(imageName) || null;
        if (!this.image) {
             console.error(`Failed to get image "${imageName}" for enemy type ${this.constructor.name}`);
        }
    }

    // Updated update method to handle hit timer
    update(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
         if (this.hitTimer > 0) {
            this.hitTimer -= deltaTime;
        }
        // Specific enemy movement logic implemented in subclasses
        this.move(deltaTime, canvasWidth, canvasHeight); 
    }
    
    // Abstract move method to be implemented by subclasses
    abstract move(deltaTime: number, canvasWidth: number, canvasHeight: number): void;

    // Updated draw method to handle hit flash
    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isActive || !this.image) return;
        
        ctx.save();
        let alpha = 1.0;
        if (this.hitTimer > 0) {
             // Flicker effect
            alpha = (Math.sin(Date.now() / 40) > 0) ? 0.4 : 1.0;
        }
        ctx.globalAlpha = alpha;

        ctx.drawImage(
            this.image,
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );

        ctx.restore(); // Restore alpha before drawing health bar

        // Draw health bar (only if HP < maxHP)
        if (this.hp < this.maxHp) {
        const barHeight = 5;
        const barYOffset = this.height / 2 + 2;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - this.width / 2, this.y + barYOffset, this.width, barHeight);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - this.width / 2, this.y + barYOffset, this.width * (this.hp / this.maxHp), barHeight);
        }
    }

    takeDamage(amount: number): void {
        if (!this.isAlive()) return; 
        
        this.hp -= amount;
        this.hitTimer = this.hitDuration;
        
        if (this.hp <= 0) {
            this.hp = 0;
            this.isActive = false;
            console.log(`${this.type} destroyed!`);
            // Play specific explosion based on enemy type
            const destroySound = this instanceof TacoEnemy ? 'explosion-large' : 'explosion-small';
            this.audioManager.playSound(destroySound);
            this.trySpawnDrops();
        } else {
            console.log(`${this.type} took ${amount} damage, ${this.hp}/${this.maxHp} HP left`);
            this.audioManager.playSound('enemy-hit'); // Correct name
        }
    }

    // Method to handle spawning drops upon death
    protected trySpawnDrops(): void {
        // Base 5% chance for health drop for all enemies
        if (Math.random() < 0.05) { 
            this.spawnItemCallback(ItemType.Health, this.x, this.y);
            console.log(`${this.type} dropped health!`);
        }
        
        // Add chances for temporary power-ups (Example: 2% chance)
        const tempPowerUpChance = 0.02;
        if (Math.random() < tempPowerUpChance) {
             const boostType = Math.random() < 0.5 ? ItemType.TempFireRate : ItemType.TempDamage;
             this.spawnItemCallback(boostType, this.x, this.y);
             console.log(`${this.type} dropped ${boostType}!`);
        }
    }

    isAlive(): boolean {
        return this.isActive && this.hp > 0;
    }
}

// --- Specific Enemy Implementations ---

export class HotDogEnemy extends Enemy {
    type = EnemyType.HotDog;

    constructor(x: number, y: number, assetManager: AssetManager, spawnItemCallback: SpawnItemCallback, audioManager: AudioManager) {
        const imageName = 'hotdog';
        const width = 50; // Use fixed width
        const height = 50; // Change to 1:1 ratio
        const hp = 1;
        const speed = 100;
        super(x, y, width, height, hp, speed, assetManager, imageName, spawnItemCallback, audioManager);
    }

    move(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isActive) return;
        this.y += this.speed * deltaTime;
        if (this.y > canvasHeight + this.height / 2) {
            this.y = -this.height / 2;
        }
    }
}

export class FrenchFriesEnemy extends Enemy {
    type = EnemyType.FrenchFries;

    constructor(x: number, y: number, assetManager: AssetManager, spawnItemCallback: SpawnItemCallback, audioManager: AudioManager) {
        const width = 40; // Adjust size
        const height = 50;
        const hp = 2; // Uncommon
        const speed = 120;
        const imageName = 'frenchFries';
        super(x, y, width, height, hp, speed, assetManager, imageName, spawnItemCallback, audioManager);
    }

    move(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isActive) return;
        this.y += this.speed * deltaTime;
        if (this.y > canvasHeight + this.height / 2) {
            this.y = -this.height / 2;
        }
    }
}

export class DonutEnemy extends Enemy {
    type = EnemyType.Donut;

    constructor(x: number, y: number, assetManager: AssetManager, spawnItemCallback: SpawnItemCallback, audioManager: AudioManager) {
        const width = 50; // Adjust size
        const height = 50;
        const hp = 3; // Rare
        const speed = 80;
        const imageName = 'donut';
        super(x, y, width, height, hp, speed, assetManager, imageName, spawnItemCallback, audioManager);
    }

    move(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isActive) return;
        this.y += this.speed * deltaTime;
        if (this.y > canvasHeight + this.height / 2) {
            this.y = -this.height / 2;
        }
    }
}

export class HamburgerEnemy extends Enemy {
    type = EnemyType.Hamburger;

    constructor(x: number, y: number, assetManager: AssetManager, spawnItemCallback: SpawnItemCallback, audioManager: AudioManager) {
        const width = 60; // Adjust size
        const height = 55;
        const hp = 5; // Exotic
        const speed = 60;
        const imageName = 'hamburger';
        super(x, y, width, height, hp, speed, assetManager, imageName, spawnItemCallback, audioManager);
    }

    move(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isActive) return;
        this.y += this.speed * deltaTime;
        if (this.y > canvasHeight + this.height / 2) {
            this.y = -this.height / 2;
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
        spawnItemCallback: SpawnItemCallback,
        audioManager: AudioManager, // Added audio manager
        playerRef: Player
    ) {
        const width = 80;
        const height = 65;
        const speed = 150;
        const imageName = 'taco';
        super(x, y, width, height, hp, speed, assetManager, imageName, spawnItemCallback, audioManager); // Pass audio manager to super

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

    move(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
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

    // Override trySpawnDrops for the Boss
    protected trySpawnDrops(): void {
        // Always drop the Pizza Change power-up
        this.spawnItemCallback(ItemType.PizzaChange, this.x, this.y);
        console.log("Taco Boss dropped Pizza Change power-up!");
        
        // Optionally, still give a chance for health or temp boosts as well?
        // super.trySpawnDrops(); // Call base method for chance of health/temp boost
    }
}

// MochiEnemy would go here if asset was available 