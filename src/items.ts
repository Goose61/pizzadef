import { AssetManager } from './assetManager';

// Enum defining the different types of collectible items
export enum ItemType {
    Health = 'Health',
    PizzaChange = 'PizzaChange',
    TempFireRate = 'TempFireRate',
    TempDamage = 'TempDamage',
}

// Base class for all collectible items
export class Item {
    x: number;
    y: number;
    width: number = 30; // Example size
    height: number = 30; // Example size
    type: ItemType;
    image: HTMLImageElement | null | undefined;
    isActive: boolean = true;
    speed: number = 80; // How fast items fall

    constructor(x: number, y: number, type: ItemType, assetManager: AssetManager) {
        this.x = x;
        this.y = y;
        this.type = type;

        let imageName = '';
        switch (type) {
            case ItemType.Health:
                imageName = 'item-health';
                break;
            case ItemType.PizzaChange:
                imageName = 'powerup-pizzachange';
                break;
            case ItemType.TempFireRate:
                 imageName = 'powerup-firerate';
                 break;
            case ItemType.TempDamage:
                 imageName = 'powerup-damage';
                 break;
        }

        this.image = assetManager.getImage(imageName);
        if (!this.image) {
            console.warn(`Failed to get image "${imageName}" for item type ${type}`);
            // Fallback drawing can be added here if needed
        }
    }

    update(deltaTime: number, canvasHeight: number): void {
        if (!this.isActive) return;

        // Move downwards
        this.y += this.speed * deltaTime;

        // Deactivate if it goes off screen
        if (this.y > canvasHeight + this.height / 2) {
            this.isActive = false;
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.isActive) return;

        if (this.image) {
            ctx.drawImage(
                this.image,
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );
        } else {
            // Fallback drawing if image failed to load
            ctx.fillStyle = 'purple'; // Use a distinct color for missing items
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
            ctx.fillStyle = 'white';
             ctx.font = '10px Arial';
             ctx.textAlign = 'center';
             ctx.fillText(this.type.substring(0,1), this.x, this.y); // Draw first letter
        }
    }
} 