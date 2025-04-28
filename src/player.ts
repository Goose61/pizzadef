import { AudioManager } from './audio';
import { Projectile } from './projectile';
import { AssetManager } from './assetManager';
import { GameState } from './game'; // Assuming GameState is exported from game.ts
import { ItemType } from './items'; // Assuming ItemType is needed if you handle drops here

// Import GameState enum (assuming it's exported from game.ts or a shared types file)
// If game.ts doesn't export it, we might need to move the enum to a separate file.
// For now, let's assume it can be imported or is globally available (less ideal).
// If GameState is defined in game.ts and not exported, this import won't work directly.
// We might need to declare it locally or pass the state as a string/number.
// Let's try declaring it locally for now as a workaround.

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
    public isDragging: boolean = false;
    private shootCooldown: number = 0;
    private readonly FIRE_SOUND_INTERVAL: number = 0.1; // This constant is now unused
    private createProjectileCallback: (x: number, y: number, angle: number, damage?: number) => void;
    private updateScoreCallback: (change: number) => void; // <<< ADDED CALLBACK
    
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
    private readonly REGEN_INTERVAL: number = 2; // seconds
    private readonly REGEN_AMOUNT: number = 1; // HP per interval

    // Store the last known game state to pass to shoot()
    private currentGameState: GameState = GameState.Loading; 

    private listenersAdded: boolean = false; // Flag to ensure listeners are added only once
    
    // --- Store bound event handlers for proper removal ---
    private boundHandleTouchStart: (event: TouchEvent) => void;
    private boundHandleTouchMove: (event: TouchEvent) => void;
    private boundHandleTouchEnd: () => void;
    private boundHandleMouseDown: (event: MouseEvent) => void;
    private boundHandleMouseMove: (event: MouseEvent) => void;
    private boundHandleMouseUp: () => void;
    // --------------------------------------------------

    constructor(
        x: number,
        y: number,
        canvas: HTMLCanvasElement,
        audioManager: AudioManager,
        assetManager: AssetManager,
        createProjectileCallback: (x: number, y: number, angle: number, damage?: number) => void,
        updateScoreCallback: (change: number) => void // <<< ADDED PARAMETER
    ) {
        // --- ADD CONSTRUCTOR LOG ---
        const timestamp = performance.now();
        console.log(`%cPLAYER CONSTRUCTOR CALLED at ${timestamp.toFixed(2)}ms`, 'color: yellow; font-weight: bold;');
        // ---------------------------
        this.x = x;
        this.y = y;
        this.canvas = canvas;
        this.audioManager = audioManager;
        this.assetManager = assetManager;
        this.createProjectileCallback = createProjectileCallback;
        this.updateScoreCallback = updateScoreCallback; // <<< STORE CALLBACK

        // Initialize base stats
        this.baseFireRate = this.stats.fireRate;
        this.baseProjectileDamage = this.stats.projectileDamage;
        this.baseMaxHp = this.stats.maxHp;

        this.maxHp = this.stats.maxHp;
        this.hp = this.maxHp;
        
        // --- Bind handlers in constructor ---
        this.boundHandleTouchStart = this.handleTouchStart.bind(this);
        this.boundHandleTouchMove = this.handleTouchMove.bind(this);
        this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);
        // ----------------------------------
        
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

    public addEventListeners(): void {
        // --- ADD GUARD ---
        if (this.listenersAdded) {
            console.warn("Attempted to add Player event listeners when already added. Skipping.");
            return;
        }
        this.listenersAdded = true;
        console.log("Adding Player event listeners...");
        const timestamp = new Date().toLocaleTimeString();
        console.log(`   - Listeners added at: ${timestamp}`);
        
        // --- Use bound handlers ---
        this.canvas.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.boundHandleTouchEnd);

        this.canvas.addEventListener('mousedown', this.boundHandleMouseDown);
        this.canvas.addEventListener('mousemove', this.boundHandleMouseMove);
        this.canvas.addEventListener('mouseup', this.boundHandleMouseUp);
        this.canvas.addEventListener('mouseleave', this.boundHandleMouseUp); // Also use bound mouse up
        // --------------------------
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
    update(deltaTime: number, gameState: GameState): void {
        // Update the internal game state tracking
        this.currentGameState = gameState;

        // Update timers
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime;
        }
        if (this.hitTimer > 0) {
            this.hitTimer -= deltaTime;
        }
        if (this.shipChangeTimer > 0) {
            this.shipChangeTimer -= deltaTime;
        }

        // Passive HP Regen (1 HP every 10 seconds)
        this.timeSinceLastRegen += deltaTime;
        if (this.timeSinceLastRegen >= 10) {
            this.heal(1, false); // Heal 1 HP, don't play sound
            this.timeSinceLastRegen = 0;
         }

        // Handle boost expirations
        if (Date.now() >= this.tempFireRateBoostEndTime && this.tempFireRateBoostEndTime !== 0) {
            this.tempFireRateBoostEndTime = 0; // Reset boost time
            this.audioManager.playSound('boost-expire'); // Play expiration sound
             console.log("Fire rate boost expired");
         }
        if (Date.now() >= this.tempDamageBoostEndTime && this.tempDamageBoostEndTime !== 0) {
            this.tempDamageBoostEndTime = 0; // Reset boost time
            this.audioManager.playSound('boost-expire'); // Play expiration sound
             console.log("Damage boost expired");
         }
         
        // Automatic shooting logic
        if (this.shootCooldown <= 0 && this.isDragging && this.currentGameState === GameState.Running) {
            this.shoot();
            this.shootCooldown = this.getShootInterval(); // Reset cooldown based on current fire rate
         }

        // Vegetarian passive regen only when game is running
        if (this.shipType === PizzaType.Vegetarian && this.currentGameState === GameState.Running && this.hp < this.maxHp) {
            this.timeSinceLastRegen += deltaTime;
            if (this.timeSinceLastRegen >= this.REGEN_INTERVAL) {
                this.heal(this.REGEN_AMOUNT, false); // Heal without playing sound
                this.timeSinceLastRegen = 0;
            }
        }
    }

    // Method to handle shooting
    shoot(): void {
        // No need to check gameState here anymore, it's checked in update()
        const damage = this.getProjectileDamage(); // Use method to get potentially boosted damage

        // Center projectile start position
        const projectileX = this.x;
        const projectileY = this.y - this.height / 2;
        
        this.createProjectileCallback(projectileX, projectileY, -Math.PI / 2, damage); // Fire upwards
        
        // --- Play Fire Sound (Now directly called) ---
        this.audioManager.playSound('fire');
        // -------------------------------------------
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
        // Decrease HP by the actual damage amount
        const actualDamage = Math.min(amount, this.hp); // Don't subtract more than current HP
        this.hp -= actualDamage;
        this.hitTimer = this.hitDuration; // Activate hit flash
        
        // Call the score update callback for each point of damage taken
        if (actualDamage > 0) {
             this.updateScoreCallback(-Math.floor(actualDamage)); // <<< CALL SCORE CALLBACK (negative)
        }

        if (this.hp < 0) {
            this.hp = 0;
        }
        this.audioManager.playSound('player-hit');
        console.log(`Player took ${actualDamage} damage, ${this.hp}/${this.maxHp} HP left`);
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

    // --- Change to public --- //
    public removeEventListeners(): void {
        if (!this.listenersAdded) return; // Don't try to remove if not added
        console.log("Removing Player event listeners...");
        
        // --- Remove using the stored bound handlers ---
        this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart);
        this.canvas.removeEventListener('touchmove', this.boundHandleTouchMove);
        this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd);

        this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown);
        this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove);
        this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.boundHandleMouseUp);
        // --------------------------------------------
        
        // TEMPORARY LOG: Indicate that proper removal needs refactoring
        // console.warn("Player.removeEventListeners called, but proper removal requires refactoring addEventListeners to store bound handlers.");
        
        this.listenersAdded = false; // Mark listeners as removed
    }
    // --- END removeEventListeners Method --- //

    // --- Add a reset method ---
    public resetState(): void {
        this.isDragging = false;
        this.shootCooldown = 0;
        this.hitTimer = 0;
        this.shipChangeTimer = 0;
        this.timeSinceLastRegen = 0;
        this.tempFireRateBoostEndTime = 0;
        this.tempDamageBoostEndTime = 0;
        // Don't reset listeners here, handled by Game
    }
    // ------------------------

    // Public method to reset player state (health, position, boosts etc.)
    public reset(): void {
        console.log("Resetting Player state...");
        this.hp = this.getEffectiveMaxHp(); // Reset to current max HP
        this.x = this.canvas.width / 2;
        this.y = this.canvas.height - 60;
        this.changeShip(PizzaType.Plain); // Reset to default ship
        this.tempFireRateBoostEndTime = 0; // Clear boosts
        this.tempDamageBoostEndTime = 0;
        this.shootCooldown = 0;
        this.isDragging = false;
        this.timeSinceLastRegen = 0;
        this.hitTimer = 0;
        // Note: Base stats (baseFireRate, etc.) are NOT reset here, only by upgrades/new game.
    }
} 