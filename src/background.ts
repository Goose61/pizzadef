import { AssetManager } from './assetManager';

// --- Interfaces for background elements ---
interface Star {
    x: number;
    y: number;
    speed: number;
    size: number;
    image: HTMLImageElement;
}

interface ParallaxLayer {
    image: HTMLImageElement;
    y1: number;
    y2: number;
    speed: number;
}

interface Asteroid {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    rotation: number;
    rotationSpeed: number;
    image: HTMLImageElement;
    width: number;
    height: number;
}

interface Planet {
    x: number;
    y: number;
    image: HTMLImageElement;
    width: number;
    height: number;
    lifeTimer: number; // How long it stays on screen
}

// --- Background Manager Class ---
export class BackgroundManager {
    private assetManager: AssetManager;
    private canvasWidth: number;
    private canvasHeight: number;

    // Store asset *names* instead of direct references initially
    private staticBackgroundName: string = 'assets/backgrounds/blue-back.png';
    private starLayerName: string = 'assets/backgrounds/blue-stars.png';
    private asteroidNames: string[] = [
        'assets/backgrounds/asteroid-1.png',
        'assets/backgrounds/asteroid-2.png'
    ];
    private planetNames: string[] = [
        'assets/backgrounds/prop-planet-big.png',
        'assets/backgrounds/prop-planet-small.png'
    ];
    
    // Keep the loaded references for star layer structure
    private starLayer: ParallaxLayer | null = null; 

    private asteroids: Asteroid[] = [];
    private planets: Planet[] = [];

    // Configuration
    private readonly STAR_SCROLL_SPEED: number = 20; // Pixels per second
    private readonly MAX_ASTEROIDS: number = 15;
    private readonly ASTEROID_SPAWN_INTERVAL: number = 0.5; // Seconds
    private asteroidSpawnTimer: number = this.ASTEROID_SPAWN_INTERVAL;
    private readonly PLANET_SPAWN_INTERVAL_MIN: number = 15; // Min seconds between planets
    private readonly PLANET_SPAWN_INTERVAL_MAX: number = 45; // Max seconds between planets
    private readonly PLANET_LIFESPAN_MIN: number = 10; // Min seconds a planet stays
    private readonly PLANET_LIFESPAN_MAX: number = 30; // Max seconds a planet stays
    private planetSpawnTimer: number = this.getRandomPlanetSpawnTime();
    private readonly MAX_PLANETS: number = 2; // Max planets on screen at once

    constructor(assetManager: AssetManager, canvasWidth: number, canvasHeight: number) {
        this.assetManager = assetManager;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        // No need to call loadAssets here anymore, assets are queued in Game.ts
        // this.loadAssets(); 
        this.initializeStarLayer(); // Initialize star layer structure after potential resize info
    }
    
    // Removed loadAssets method - assets are queued in Game.ts and retrieved in draw/spawn methods
    // private loadAssets(): void { ... }

    // Initialize or re-initialize the star layer object
    private initializeStarLayer(): void {
         const starsImage = this.assetManager.getImage(this.starLayerName);
        if (starsImage) {
            this.starLayer = {
                image: starsImage,
                y1: 0,
                y2: -this.canvasHeight, // Position the second image directly above the first
                speed: this.STAR_SCROLL_SPEED
            };
        } else {
            // Attempt to re-get image later if not loaded yet
            console.warn("Star layer image not immediately available, will try again.");
            this.starLayer = null; 
        }
    }

    public resize(width: number, height: number): void {
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.initializeStarLayer(); // Re-initialize star layer with new height
        // Clear elements that might be positioned incorrectly after resize
        this.asteroids = [];
        this.planets = [];
    }

    private getRandomPlanetSpawnTime(): number {
        return Math.random() * (this.PLANET_SPAWN_INTERVAL_MAX - this.PLANET_SPAWN_INTERVAL_MIN) + this.PLANET_SPAWN_INTERVAL_MIN;
    }

    private getRandomPlanetLifespan(): number {
        return Math.random() * (this.PLANET_LIFESPAN_MAX - this.PLANET_LIFESPAN_MIN) + this.PLANET_LIFESPAN_MIN;
    }

    public update(deltaTime: number): void {
        // Update scrolling star layer
        if (this.starLayer) {
            // Check if image is loaded, retrieve if necessary (handles delayed loading)
            if (!this.starLayer.image) {
                 const starsImage = this.assetManager.getImage(this.starLayerName);
                 if (starsImage) {
                     this.starLayer.image = starsImage;
                 } else {
                     return; // Skip update if image still not loaded
                 }
            }
            
            this.starLayer.y1 += this.starLayer.speed * deltaTime;
            this.starLayer.y2 += this.starLayer.speed * deltaTime;

            // Reset positions when scrolled off-screen
            if (this.starLayer.y1 >= this.canvasHeight) {
                this.starLayer.y1 = this.starLayer.y2 - this.canvasHeight;
            }
            if (this.starLayer.y2 >= this.canvasHeight) {
                this.starLayer.y2 = this.starLayer.y1 - this.canvasHeight;
            }
        }

        // Update asteroids
        this.asteroids.forEach((asteroid, index) => {
            asteroid.x += asteroid.velocityX * deltaTime;
            asteroid.y += asteroid.velocityY * deltaTime;
            asteroid.rotation += asteroid.rotationSpeed * deltaTime;

            // Despawn if off-screen (add buffer)
            const buffer = Math.max(asteroid.width, asteroid.height);
            if (asteroid.x < -buffer || asteroid.x > this.canvasWidth + buffer ||
                asteroid.y < -buffer || asteroid.y > this.canvasHeight + buffer) {
                this.asteroids.splice(index, 1);
            }
        });

        // Spawn new asteroids
        this.asteroidSpawnTimer -= deltaTime;
        if (this.asteroidSpawnTimer <= 0 && this.asteroids.length < this.MAX_ASTEROIDS && this.asteroidNames.length > 0) {
            this.spawnAsteroid();
            this.asteroidSpawnTimer = this.ASTEROID_SPAWN_INTERVAL * (0.5 + Math.random()); // Add some variance
        }

        // Update planets
        this.planets.forEach((planet, index) => {
            // Move planet downwards with the star layer speed
            if (this.starLayer) {
                planet.y += this.starLayer.speed * deltaTime;
            }
            
            planet.lifeTimer -= deltaTime; // Decrease lifespan timer

            // Remove planet if its lifespan is over OR if its TOP edge has scrolled below the bottom of the screen
            if (planet.lifeTimer <= 0 || planet.y > this.canvasHeight) {
                this.planets.splice(index, 1);
            }
        });

        // Spawn new planets
        this.planetSpawnTimer -= deltaTime;
        if (this.planetSpawnTimer <= 0 && this.planets.length < this.MAX_PLANETS && this.planetNames.length > 0) {
            this.spawnPlanet();
            this.planetSpawnTimer = this.getRandomPlanetSpawnTime();
        }
    }

    private spawnAsteroid(): void {
        // Get a random asteroid image *name*
        const imageName = this.asteroidNames[Math.floor(Math.random() * this.asteroidNames.length)];
        // Get the actual image from the asset manager
        const image = this.assetManager.getImage(imageName);
        
        // Only spawn if image is loaded
        if (!image) {
             console.warn(`Asteroid image ${imageName} not loaded yet, skipping spawn.`);
             return; 
        }
        
        const scale = 0.5 + Math.random() * 0.75; // Random size
        const width = image.width * scale;
        const height = image.height * scale;

        // Determine spawn edge (0: top, 1: right, 2: bottom, 3: left)
        const edge = Math.floor(Math.random() * 4);
        let x, y;

        switch (edge) {
            case 0: // Top
                x = Math.random() * this.canvasWidth;
                y = -height;
                break;
            case 1: // Right
                x = this.canvasWidth + width;
                y = Math.random() * this.canvasHeight;
                break;
            case 2: // Bottom
                x = Math.random() * this.canvasWidth;
                y = this.canvasHeight + height;
                break;
            default: // Left
                x = -width;
                y = Math.random() * this.canvasHeight;
                break;
        }

        // Target somewhere roughly center screen
        const targetX = this.canvasWidth * (0.3 + Math.random() * 0.4);
        const targetY = this.canvasHeight * (0.3 + Math.random() * 0.4);
        const angle = Math.atan2(targetY - y, targetX - x);
        const speed = 30 + Math.random() * 40; // Random speed

        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;
        const rotationSpeed = (Math.random() - 0.5) * 2; // Radians per second

        this.asteroids.push({
            x, y, velocityX, velocityY,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed,
            image, width, height
        });
    }

    private spawnPlanet(): void {
        // Get a random planet image *name*
        const imageName = this.planetNames[Math.floor(Math.random() * this.planetNames.length)];
        // Get the actual image from the asset manager
        const image = this.assetManager.getImage(imageName);
        
        // Only spawn if image is loaded
        if (!image) {
             console.warn(`Planet image ${imageName} not loaded yet, skipping spawn.`);
             return; 
        }
        
        // --- TEMPORARY: Force huge size for debugging ---\
        const scaleFactor = 5.0; // Ensure no trailing chars
        // -----------------------------------------------\

        const width = image.width * scaleFactor; // Ensure no trailing chars
        const height = image.height * scaleFactor; // Ensure no trailing chars

        const x = Math.random() * (this.canvasWidth - width); // Ensure no trailing chars
        const y = -height; // Spawn just above the screen
        const lifeTimer = this.getRandomPlanetLifespan();

        this.planets.push({ x, y, image, width, height, lifeTimer });
        console.log(`Spawned planet ${imageName} at (${x.toFixed(0)}, ${y.toFixed(0)}) with lifespan ${lifeTimer.toFixed(1)}s`);
    }


    public draw(ctx: CanvasRenderingContext2D): void {
        // Draw static background first - get image reference here
        const staticBgImage = this.assetManager.getImage(this.staticBackgroundName);
        if (staticBgImage) {
            ctx.drawImage(staticBgImage, 0, 0, this.canvasWidth, this.canvasHeight);
        } else {
            // Fallback color if image fails
            ctx.fillStyle = '#00001a'; // Dark blue fallback
            ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        }

        // Draw scrolling stars - ensure layer and image exist
        if (this.starLayer && this.starLayer.image) {
            ctx.drawImage(this.starLayer.image, 0, this.starLayer.y1, this.canvasWidth, this.canvasHeight);
            ctx.drawImage(this.starLayer.image, 0, this.starLayer.y2, this.canvasWidth, this.canvasHeight);
        } else if (!this.starLayer) {
            // Attempt to initialize if it failed earlier
            this.initializeStarLayer();
        }
        
        // --- Explicitly set alpha before drawing planets/asteroids ---
        ctx.globalAlpha = 1.0;

        // Draw planets (behind asteroids)
        this.planets.forEach(planet => {
             // Image should be loaded if planet exists, but double-check
             if (planet.image) {
                // --- ADD LOG for dimensions --- 
                const logDimensions = Math.random() < 0.01; // Log occasionally
                if (logDimensions) {
                    console.log(`Drawing planet at (${planet.x.toFixed(0)}, ${planet.y.toFixed(0)}) with size (${planet.width}x${planet.height})`);
                }
                // --- END LOG ---
                ctx.drawImage(planet.image, planet.x, planet.y, planet.width, planet.height);
             }
        });

        // Draw asteroids
        this.asteroids.forEach(asteroid => {
            // Image should be loaded if asteroid exists, but double-check
            if (asteroid.image) {
                ctx.save();
                ctx.translate(asteroid.x + asteroid.width / 2, asteroid.y + asteroid.height / 2);
                ctx.rotate(asteroid.rotation);
                ctx.drawImage(asteroid.image, -asteroid.width / 2, -asteroid.height / 2, asteroid.width, asteroid.height);
                ctx.restore();
            }
        });
    }
} 