import { AudioManager } from './audio';
import { Projectile } from './projectile';
import { AssetManager } from './assetManager';

// Enum for different pizza ship types
export enum PizzaType {
    Plain = 'Plain',
    Pepperoni = 'Pepperoni',
    Hawaiian = 'Hawaiian',
    Vegetarian = 'Vegetarian',
    Meatlovers = 'Meatlovers'
}

// Player stats interface
export interface PlayerStats {
    fireRate: number;   // Shots per second
    projectileDamage: number;
    maxHp: number;
}

// Placeholder for Player class
export class Player {
    x: number;
    y: number;
    width: number = 50; // Slightly larger base size
    height: number = 60; // Slightly larger base size
    hp: number;
    maxHp: number;
    shipType: PizzaType = PizzaType.Plain; // Current ship type
    playerImage: HTMLImageElement | null | undefined; // Image for the current ship

    private canvas: HTMLCanvasElement;
    private audioManager: AudioManager;
    private assetManager: AssetManager;
    private isDragging: boolean = false;
    private shootCooldown: number = 0;
    private createProjectileCallback: (x: number, y: number, angle: number, damage?: number) => void;
    
    // Player stats
    private stats: PlayerStats = {
        fireRate: 1.0,         // Base fire rate
        projectileDamage: 1,   // Base damage
        maxHp: 5               // Base max HP
    };
    // Temporary boost tracking
    private tempFireRateBoostEndTime: number = 0;
    private tempDamageBoostEndTime: number = 0;
    private baseFireRate: number = 1.0;
    private baseProjectileDamage: number = 1;
    private baseMaxHp: number = 5;

    // Hit flash effect
    private hitTimer: number = 0;
    private readonly hitDuration: number = 0.2;

    // Ship change flash effect
    private shipChangeTimer: number = 0;
    private readonly shipChangeFlashDuration: number = 0.5;
    
    // Passive regen tracking
    private timeSinceLastRegen: number = 0;

    constructor(
        x: number,
        y: number,
        canvas: HTMLCanvasElement,
        audioManager: AudioManager,
        assetManager: AssetManager,
        createProjectileCallback: (x: number, y: number, angle: number, damage?: number) => void
    ) {
        this.x = x;
        this.y = y;
        this.canvas = canvas;
        this.audioManager = audioManager;
        this.assetManager = assetManager;
        this.createProjectileCallback = createProjectileCallback;

        // Initialize base stats
        this.baseFireRate = this.stats.fireRate;
        this.baseProjectileDamage = this.stats.projectileDamage;
        this.baseMaxHp = this.stats.maxHp;

        this.maxHp = this.stats.maxHp;
        this.hp = this.maxHp;
        this.addEventListeners();
        this.loadShipImage(); // Load initial ship image
    }

    // Load the correct ship image based on shipType
    private loadShipImage(): void {
        let imageName = '';
        switch (this.shipType) {
            case PizzaType.Pepperoni:
                imageName = 'pizza-pepperoni';
                break;
            case PizzaType.Hawaiian:
                imageName = 'pizza-hawaiian';
                break;
            case PizzaType.Vegetarian:
                imageName = 'pizza-vegetarian';
                break;
            case PizzaType.Meatlovers:
                imageName = 'pizza-meatlovers';
                break;
            case PizzaType.Plain:
            default:
                imageName = 'pizza-plain';
                break;
        }
        this.playerImage = this.assetManager.getImage(imageName);
        if (!this.playerImage) {
            console.warn(`Failed to load player image: ${imageName}`);
        }
    }

    // Method to upgrade a specific stat (upgrades base stats)
    upgradeStat(statType: keyof PlayerStats): void {
        switch(statType) {
            case 'fireRate':
                this.baseFireRate += 0.2;
                break;
            case 'projectileDamage':
                this.baseProjectileDamage += 0.2;
                break;
            case 'maxHp':
                this.baseMaxHp += 1;
                this.maxHp = this.getEffectiveMaxHp(); // Update current maxHp
                this.hp = Math.min(this.hp + 1, this.maxHp); // Heal player by 1
                break;
        }
        // Re-apply ship bonuses after base stat upgrade
        this.applyShipBonuses(); 
        console.log(`Upgraded base ${statType}. Current effective: ${this.stats[statType]}`);
    }
    
    // Method to get current effective stats (base + bonuses)
    getStats(): PlayerStats {
        return { ...this.stats }; // Return a copy
    }

    // Calculate effective shoot interval considering boosts
    private getShootInterval(): number {
        const effectiveFireRate = this.stats.fireRate * (Date.now() < this.tempFireRateBoostEndTime ? 1.5 : 1); // 50% boost
        return 1.0 / effectiveFireRate;
    }
    
    // Calculate effective projectile damage considering boosts
    getProjectileDamage(): number {
        const effectiveDamage = this.stats.projectileDamage * (Date.now() < this.tempDamageBoostEndTime ? 1.5 : 1); // 50% boost
        return Math.round(effectiveDamage * 10) / 10; // Return rounded damage
    }

    // Calculate effective max HP
    private getEffectiveMaxHp(): number {
         // Add any ship-specific max HP bonuses here if needed in the future
        return this.baseMaxHp;
    }

    private addEventListeners(): void {
        // Touch events for dragging
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Mouse events for dragging (for testing on desktop)
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this)); // Stop dragging if mouse leaves canvas
    }

    // --- Touch Event Handlers ---
    private handleTouchStart(event: TouchEvent): void {
        event.preventDefault();
        const touch = event.touches[0];
        if (this.isPointerOverPlayer(touch.clientX, touch.clientY)) {
            this.isDragging = true;
        }
    }

    private handleTouchMove(event: TouchEvent): void {
        event.preventDefault();
        if (this.isDragging && event.touches.length > 0) {
            const touch = event.touches[0];
            this.updatePosition(touch.clientX, touch.clientY);
        }
    }

    private handleTouchEnd(): void {
        this.isDragging = false;
    }

    // --- Mouse Event Handlers ---
    private handleMouseDown(event: MouseEvent): void {
        if (this.isPointerOverPlayer(event.clientX, event.clientY)) {
            this.isDragging = true;
        }
    }

    private handleMouseMove(event: MouseEvent): void {
        if (this.isDragging) {
            this.updatePosition(event.clientX, event.clientY);
        }
    }

    private handleMouseUp(): void {
        this.isDragging = false;
    }

    // --- Helper Methods ---
    private isPointerOverPlayer(clientX: number, clientY: number): boolean {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // Simple bounding box check
        return (
            canvasX >= this.x - this.width / 2 &&
            canvasX <= this.x + this.width / 2 &&
            canvasY >= this.y - this.height / 2 &&
            canvasY <= this.y + this.height / 2
        );
    }

    private updatePosition(clientX: number, clientY: number): void {
        const rect = this.canvas.getBoundingClientRect();
        let targetX = clientX - rect.left;
        let targetY = clientY - rect.top;

        // Clamp position to canvas bounds (considering player size)
        targetX = Math.max(this.width / 2, Math.min(this.canvas.width - this.width / 2, targetX));
        targetY = Math.max(this.height / 2, Math.min(this.canvas.height - this.height / 2, targetY));

        this.x = targetX;
        this.y = targetY;
    }

    // Update method: handle shooting and temporary boosts
    update(deltaTime: number): void {
         // Hit flash timer
        if (this.hitTimer > 0) {
            this.hitTimer -= deltaTime;
        }
        // Ship change flash timer
        if (this.shipChangeTimer > 0) {
            this.shipChangeTimer -= deltaTime;
        }

         // Automatic shooting logic
         this.shootCooldown -= deltaTime;
         if (this.shootCooldown <= 0) {
             this.shoot();
             this.shootCooldown = this.getShootInterval();
         }

         // Check temporary boost expiry
         if (this.tempFireRateBoostEndTime > 0 && Date.now() >= this.tempFireRateBoostEndTime) {
             this.tempFireRateBoostEndTime = 0;
             this.audioManager.playSound('boost-end'); // Changed from boost-expire
             console.log("Fire rate boost expired");
         }
         if (this.tempDamageBoostEndTime > 0 && Date.now() >= this.tempDamageBoostEndTime) {
             this.tempDamageBoostEndTime = 0;
             this.audioManager.playSound('boost-end'); // Changed from boost-expire
             console.log("Damage boost expired");
         }
         
         // Passive Regen for Vegetarian
         if (this.shipType === PizzaType.Vegetarian && this.isAlive() && this.hp < this.maxHp) {
             this.timeSinceLastRegen += deltaTime;
             if (this.timeSinceLastRegen >= 1.0) { // Regenerate every 1 second
                 const regenAmount = 0.1; // Heal 0.1 HP per second
                 this.heal(regenAmount, false); // Heal without sound
                 this.timeSinceLastRegen = 0;
             }
         } else {
              this.timeSinceLastRegen = 0; // Reset timer if not applicable
         }
    }

    // Modified shoot method for different pizza types
    shoot(): void {
        const projectileX = this.x;
        const projectileY = this.y - this.height / 2; // Tip of the pizza
        const baseAngle = -Math.PI / 2; // Straight up
        const currentDamage = this.getProjectileDamage(); // Base damage including boosts

        switch (this.shipType) {
            case PizzaType.Pepperoni:
                // 15% chance for +1 damage ("hot" projectile)
                const bonusDamage = Math.random() < 0.15 ? 1 : 0;
                this.createProjectileCallback(projectileX, projectileY, baseAngle, currentDamage + bonusDamage);
                break;
                
            case PizzaType.Hawaiian:
                // Shoots two projectiles in a narrow V
                const spreadAngle = Math.PI / 32; // Small angle
                this.createProjectileCallback(projectileX, projectileY, baseAngle - spreadAngle, currentDamage);
                this.createProjectileCallback(projectileX, projectileY, baseAngle + spreadAngle, currentDamage);
                break;
                
            case PizzaType.Meatlovers:
                // Base shot
                this.createProjectileCallback(projectileX, projectileY, baseAngle, currentDamage);
                // 10% chance for a shotgun blast (3 projectiles, wider spread, maybe less damage?)
                if (Math.random() < 0.10) {
                    const shotgunDamage = Math.max(1, Math.round(currentDamage * 0.5)); // Example: half damage
                    const shotgunSpread = Math.PI / 12;
                    this.createProjectileCallback(projectileX, projectileY, baseAngle - shotgunSpread, shotgunDamage);
                    this.createProjectileCallback(projectileX, projectileY, baseAngle, shotgunDamage);
                    this.createProjectileCallback(projectileX, projectileY, baseAngle + shotgunSpread, shotgunDamage);
                }
                break;

            case PizzaType.Vegetarian:
            case PizzaType.Plain:
            default:
                // Standard single shot
                this.createProjectileCallback(projectileX, projectileY, baseAngle, currentDamage);
                break;
        }

        this.audioManager.playSound('fire'); // Changed from 'shoot'
    }

    // Draw method using the player image
    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save(); // Save context state
        
        let alpha = 1.0;
        // Apply hit flash effect (reduce alpha)
        if (this.hitTimer > 0) {
            // Simple flicker effect
            alpha = (Math.sin(Date.now() / 50) > 0) ? 0.5 : 1.0; 
        }
        // Apply ship change flash (overlay white)
        if (this.shipChangeTimer > 0) {
            const flashIntensity = Math.max(0, this.shipChangeTimer / this.shipChangeFlashDuration);
             ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity * 0.5})`; // Semi-transparent white flash
        }
        
        ctx.globalAlpha = alpha; // Apply hit flash alpha

        if (this.playerImage) {
             // Adjust draw position slightly if needed based on specific sprite dimensions
            ctx.drawImage(
                this.playerImage,
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );
        } else {
             // Fallback drawing if image is missing
            ctx.fillStyle = '#FFD700'; // Yellow
        ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.height / 2); 
            ctx.lineTo(this.x - this.width / 2, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.closePath();
        ctx.fill();
        }

        // Draw health bar (adjusted position slightly)
        const barWidth = this.width;
        const barHeight = 6;
        const barYOffset = this.height / 2 + 5; // Move below the player image
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - barWidth / 2, this.y + barYOffset, barWidth, barHeight);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - barWidth / 2, this.y + barYOffset, barWidth * (this.hp / this.maxHp), barHeight);
        
         // Draw boost indicators (optional)
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        let boostTextY = this.y + barYOffset + barHeight + 12;
        if (Date.now() < this.tempFireRateBoostEndTime) {
            ctx.fillText('RATE UP!', this.x, boostTextY);
            boostTextY += 12;
        }
         if (Date.now() < this.tempDamageBoostEndTime) {
            ctx.fillText('DMG UP!', this.x, boostTextY);
        }

        // Draw ship change flash overlay if active
        if (this.shipChangeTimer > 0) {
             ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        }

        ctx.restore(); // Restore context state (clears alpha and fillStyle changes)
    }

    takeDamage(amount: number): void {
        this.hp -= amount;
        this.hitTimer = this.hitDuration; // Activate hit flash
        if (this.hp < 0) {
            this.hp = 0;
        }
        this.audioManager.playSound('player-hit'); // Correct name
        console.log(`Player took ${amount} damage, ${this.hp}/${this.maxHp} HP left`);
    }
    
    // Added optional playSound parameter to avoid sound during passive regen
    heal(amount: number, playSound: boolean = true): void {
        const oldHp = this.hp;
        this.hp = Math.min(this.hp + amount, this.maxHp);
        if (this.hp > oldHp && playSound) { // Only play sound if HP actually increased
             this.audioManager.playSound('health'); // Changed from 'heal'
        }
        // Don't log every passive tick
        if (playSound) {
           console.log(`Player healed ${amount} HP. Current HP: ${this.hp}/${this.maxHp}`);
        }
    }

    isAlive(): boolean {
        return this.hp > 0;
    }

    // Change the player's ship type and apply bonuses
    changeShip(newType: PizzaType): void {
        if (this.shipType === newType) return; // No change if already this type

        console.log(`Changing ship from ${this.shipType} to ${newType}`);
        this.shipType = newType;
        this.loadShipImage(); // Load the new image
        this.applyShipBonuses(); // Apply stat changes/abilities
        this.shipChangeTimer = this.shipChangeFlashDuration; // Activate flash effect
        this.audioManager.playSound('level-up'); // Changed from ship-change
    }
    
    // Apply stat bonuses based on the current ship type
    private applyShipBonuses(): void {
         // Reset stats to base before applying new bonuses
        this.stats.fireRate = this.baseFireRate;
        this.stats.projectileDamage = this.baseProjectileDamage;
        // Calculate base max HP first (Vegetarian might modify it)
        let calculatedMaxHp = this.baseMaxHp;
        
        // Apply bonuses based on type
        switch (this.shipType) {
            case PizzaType.Pepperoni:
                this.stats.fireRate *= 1.15; // 15% faster fire rate
                // Damage bonus handled in shoot() method
                break;
            case PizzaType.Hawaiian:
                 this.stats.projectileDamage *= 1.1; // 10% more damage
                 // Firing pattern handled in shoot() method
                break;
            case PizzaType.Vegetarian:
                 calculatedMaxHp = Math.round(this.baseMaxHp * 1.2); // 20% more max HP
                 // Passive regen handled in update() method
                 break;
            case PizzaType.Meatlovers:
                 this.stats.fireRate *= 1.05;
                 this.stats.projectileDamage *= 1.05;
                 // Shotgun blast handled in shoot() method
                break;
            case PizzaType.Plain:
            default:
                // No bonus for plain
                break;
        }
        
        // Update max HP and clamp current HP
        this.stats.maxHp = calculatedMaxHp;
        this.maxHp = this.stats.maxHp; 
        this.hp = Math.min(this.hp, this.maxHp); // Ensure HP doesn't exceed new max

        console.log("Applied ship bonuses. New stats:", this.stats);
    }
    
     // Activate temporary fire rate boost
    activateTempFireRate(durationSeconds: number): void {
        this.tempFireRateBoostEndTime = Date.now() + durationSeconds * 1000;
        this.audioManager.playSound('power-up'); // Changed from boost-activate
        console.log(`Fire rate boost activated for ${durationSeconds} seconds!`);
    }

    // Activate temporary damage boost
    activateTempDamage(durationSeconds: number): void {
        this.tempDamageBoostEndTime = Date.now() + durationSeconds * 1000;
        this.audioManager.playSound('power-up'); // Changed from boost-activate
        console.log(`Damage boost activated for ${durationSeconds} seconds!`);
    }
} 