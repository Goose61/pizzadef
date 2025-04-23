import { AudioManager } from './audio';
import { Projectile } from './projectile';

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
    width: number = 40; // Example size
    height: number = 50; // Example size
    toppings: string[] = []; // To store power-ups/toppings
    hp: number;
    maxHp: number;
    private canvas: HTMLCanvasElement;
    private audioManager: AudioManager;
    private isDragging: boolean = false;
    private shootCooldown: number = 0;
    private createProjectileCallback: (x: number, y: number) => void;
    
    // Player stats
    private stats: PlayerStats = {
        fireRate: 1.0,         // 1 shot per second initially
        projectileDamage: 1,   // Base damage
        maxHp: 5               // Base max HP
    };

    constructor(
        x: number,
        y: number,
        canvas: HTMLCanvasElement,
        audioManager: AudioManager,
        createProjectileCallback: (x: number, y: number) => void
    ) {
        this.x = x;
        this.y = y;
        this.canvas = canvas;
        this.audioManager = audioManager;
        this.createProjectileCallback = createProjectileCallback;
        this.maxHp = this.stats.maxHp;
        this.hp = this.maxHp;
        this.addEventListeners();
    }

    // Method to upgrade a specific stat
    upgradeStat(statType: keyof PlayerStats): void {
        switch(statType) {
            case 'fireRate':
                this.stats.fireRate += 0.2; // Increase fire rate by 0.2 per upgrade
                break;
            case 'projectileDamage':
                this.stats.projectileDamage += 0.2; // Change from 1 to 0.2 to match fire rate increment
                break;
            case 'maxHp':
                this.stats.maxHp += 1; // Increase max HP by 1
                this.maxHp = this.stats.maxHp;
                this.hp = Math.min(this.hp + 1, this.maxHp); // Heal player by 1 when max HP increases
                break;
        }
        
        console.log(`Upgraded ${statType} to ${this.stats[statType]}`);
    }
    
    // Method to get current stats
    getStats(): PlayerStats {
        return { ...this.stats };
    }

    // Method to get shoot interval based on fire rate
    private getShootInterval(): number {
        return 1.0 / this.stats.fireRate; // Convert fire rate to interval
    }
    
    // Method to get projectile damage
    getProjectileDamage(): number {
        return this.stats.projectileDamage;
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

    // Placeholder update method
    update(deltaTime: number): void {
         // Automatic shooting logic
         this.shootCooldown -= deltaTime;
         if (this.shootCooldown <= 0) {
             this.shoot();
             this.shootCooldown = this.getShootInterval();
         }
    }

    shoot(): void {
        // Create projectile at the tip of the pizza slice
        const projectileX = this.x;
        const projectileY = this.y - this.height / 2;

        this.createProjectileCallback(projectileX, projectileY);

        this.audioManager.playSound('shoot');
    }

    // Placeholder draw method
    draw(ctx: CanvasRenderingContext2D): void {
        // Draw basic pizza slice shape (triangle)
        ctx.fillStyle = '#FFD700'; // Yellow for cheese
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height / 2); // Top point
        ctx.lineTo(this.x - this.width / 2, this.y + this.height / 2); // Bottom left
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2); // Bottom right
        ctx.closePath();
        ctx.fill();

        // Draw crust
        ctx.fillStyle = '#D2691E'; // Brown for crust
        ctx.fillRect(this.x - this.width / 2, this.y + this.height / 2 - 5, this.width, 5);

        // Draw health bar
        const barWidth = this.width;
        const barHeight = 5;
        const barYOffset = this.height / 2 + 10;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - barWidth / 2, this.y + barYOffset, barWidth, barHeight);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - barWidth / 2, this.y + barYOffset, barWidth * (this.hp / this.maxHp), barHeight);
    }

    takeDamage(amount: number): void {
        this.hp -= amount;
        if (this.hp < 0) {
            this.hp = 0;
        }
        console.log(`Player took ${amount} damage, ${this.hp}/${this.maxHp} HP left`);
        // TODO: Add visual/audio feedback for player getting hit
        // Potentially trigger invincibility frames
    }

    isAlive(): boolean {
        return this.hp > 0;
    }

    addToping(topping: string): void {
        this.toppings.push(topping);
        console.log(`Added topping: ${topping}. Current toppings: ${this.toppings.join(', ')}`);
        // Potentially modify player stats or appearance
    }
} 