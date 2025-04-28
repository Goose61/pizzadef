export class Projectile {
    x: number;
    y: number;
    width: number = 10; // ADDED width
    height: number = 10; // ADDED height
    radius: number = 5; // Small circle for the projectile
    speed: number = 400; // Pixels per second
    isActive: boolean = true;
    isPlayerProjectile: boolean; // Added flag
    angle: number; // Added angle
    damage: number = 1; // Default damage value

    constructor(x: number, y: number, isPlayerProjectile: boolean, angle: number = -Math.PI / 2, damage: number = 1) { // Added flag, angle, and damage
        this.x = x;
        this.y = y;
        this.isPlayerProjectile = isPlayerProjectile; // Store flag
        this.angle = angle; // Store angle
        this.damage = damage; // Set the damage value
    }

    update(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
        this.x += Math.cos(this.angle) * this.speed * deltaTime;
        this.y += Math.sin(this.angle) * this.speed * deltaTime;

        // Deactivate if it goes off-screen (use parameters now)
        if (this.y < -this.radius || this.y > canvasHeight + this.radius || this.x < -this.radius || this.x > canvasWidth + this.radius) {
            this.isActive = false;
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isActive) return;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isPlayerProjectile ? '#FFFF00' : '#FF0000'; // Yellow for player, Red for enemy
        ctx.fill();
        ctx.closePath();
    }
} 