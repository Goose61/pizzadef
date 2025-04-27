// Add Telegram WebApp interface
interface TelegramWebApp {
    ready: () => void;
    expand: () => void;
    initDataUnsafe?: {
        user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
        };
    };
}

interface Window {
    Telegram?: {
        WebApp: TelegramWebApp;
    };
}

import { Player, PlayerStats } from './player';
import { AudioManager } from './audio';
import { Projectile } from './projectile';
import { Enemy, EnemyType, HotDogEnemy, FrenchFriesEnemy, DonutEnemy, HamburgerEnemy, TacoEnemy } from './enemy';
import { AssetManager } from './assetManager';
import { levelConfig, WaveConfig, WaveEnemyConfig, BOSS_LEVEL_INTERVAL } from './LevelConfig'; // Import level config
import { Item, ItemType } from './items'; // Import Item and ItemType
import { PizzaType } from './player'; // Import PizzaType

// Enum for game states
enum GameState {
    Loading,
    Running,
    GameOver,
    GameWon,
    DisplayWaveStart,
    UpgradingStats, // New state for stat upgrading
}

class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private player: Player;
    private lastTime: number = 0;
    private audioManager: AudioManager;
    private projectiles: Projectile[] = [];
    private enemies: Enemy[] = [];
    private items: Item[] = []; // Added array for items
    private assetManager: AssetManager;
    private assetsLoaded: boolean = false;
    private gameState: GameState = GameState.Loading;

    // Wave Management State
    private currentWaveIndex: number = -1; // Overall index in the levelConfig array
    private currentWave: WaveConfig | null = null; // Config for the currently active wave
    private enemiesSpawnedThisWave: number = 0;
    private totalEnemiesThisWave: number = 0;
    private enemySpawnTimer: number = 0;
    // --- Add Level/Wave Tracking --- 
    private currentLevelNumber: number = 0;
    private currentWaveInLevel: number = 0;

    // New state for stage/wave screens
    private displayTimer: number = 0;
    private readonly displayDuration: number = 2.0; // Seconds to display stage/wave screens
    
    // Upgrade UI elements
    private upgradeButtons: Array<{
        statType: keyof PlayerStats;
        label: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }> = [];
    private levelCompleted: boolean = false;

    constructor() {
        // Initialize Telegram Web App if available
        const telegramObj = window as any;
        if (telegramObj.Telegram && telegramObj.Telegram.WebApp) {
            const tg = telegramObj.Telegram.WebApp;
            tg.ready();
            tg.expand();
        }
        
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get 2D rendering context');
        }
        this.ctx = context;
        this.audioManager = new AudioManager();
        this.assetManager = new AssetManager();

        // Queue all assets (including sounds)
        this.queueAssets();

        this.resizeCanvas();

        this.player = new Player(
            this.canvas.width / 2,
            this.canvas.height - 60,
            this.canvas,
            this.audioManager,
            this.assetManager,
            this.addProjectile.bind(this)
        );

        window.addEventListener('resize', this.resizeCanvas.bind(this));
        
        // Add click handler for upgrade buttons
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        // Add touch handler for upgrade buttons
        this.canvas.addEventListener('touchstart', this.handleCanvasTouch.bind(this), { passive: false }); // Added touch listener

        this.gameLoop = this.gameLoop.bind(this);
        this.spawnEnemy = this.spawnEnemy.bind(this);
        this.spawnBoss = this.spawnBoss.bind(this);
        this.addProjectile = this.addProjectile.bind(this);
        this.addEnemyProjectile = this.addEnemyProjectile.bind(this);
        this.spawnItem = this.spawnItem.bind(this); // Bind spawnItem
        
        // Set up upgrade buttons
        this.setupUpgradeButtons();
    }
    
    private queueAssets(): void {
        // Player Pizza Sprites
        this.assetManager.queueImage('pizza-plain', 'assets/plain.png');
        this.assetManager.queueImage('pizza-pepperoni', 'assets/pepperoni.png');
        this.assetManager.queueImage('pizza-hawaiian', 'assets/hawaiian.png');
        this.assetManager.queueImage('pizza-vegetarian', 'assets/vegetarian.png');
        this.assetManager.queueImage('pizza-meatlovers', 'assets/meatlover.png');
        
        // Enemy Sprites
        this.assetManager.queueImage('hotdog', 'assets/hotdog.png');
        this.assetManager.queueImage('frenchFries', 'assets/french-fries.png');
        this.assetManager.queueImage('donut', 'assets/donut.png');
        this.assetManager.queueImage('hamburger', 'assets/hamburger.png');
        this.assetManager.queueImage('taco', 'assets/taco.png');
        
        // Item/PowerUp Sprites
        this.assetManager.queueImage('item-health', 'assets/item-health.png');
        this.assetManager.queueImage('powerup-pizzachange', 'assets/powerup-pizzachange.png');
        this.assetManager.queueImage('powerup-firerate', 'assets/powerup-firerate.png');
        this.assetManager.queueImage('powerup-damage', 'assets/powerup-damage.png');
        
        // Audio Assets
        // SFX
        this.audioManager.loadSound('fire', 'assets/sounds/fire.mp3'); 
        this.audioManager.loadSound('player-hit', 'assets/sounds/player-hit.mp3');
        this.audioManager.loadSound('enemy-hit', 'assets/sounds/enemy-hit.mp3');
        this.audioManager.loadSound('explosion-small', 'assets/sounds/explosion-small.mp3');
        this.audioManager.loadSound('explosion-large', 'assets/sounds/explosion-large.mp3');
        this.audioManager.loadSound('health', 'assets/sounds/health.mp3');
        this.audioManager.loadSound('game-over', 'assets/sounds/game-over.mp3');
        // Renamed boost/change sounds
        this.audioManager.loadSound('boost-activate', 'assets/sounds/power-up.mp3'); // Changed from boost-start
        this.audioManager.loadSound('boost-expire', 'assets/sounds/boost_end.mp3'); // Corrected filename (underscore)
        this.audioManager.loadSound('ship-change', 'assets/sounds/level-up.mp3'); // Changed from level-up
        this.audioManager.loadSound('upgrade-selected', 'assets/sounds/upgrade.mp3'); // Added upgrade click sound
        
        // Background Music Tracks
        this.audioManager.loadMusicTrack('assets/sounds/track1.mp3');
        this.audioManager.loadMusicTrack('assets/sounds/track2.mp3');
        this.audioManager.loadMusicTrack('assets/sounds/track3.mp3');
        this.audioManager.loadMusicTrack('assets/sounds/track4.mp3');
        this.audioManager.loadMusicTrack('assets/sounds/track5.mp3');
        
        // Upgrade Menu Music Tracks
        this.audioManager.loadUpgradeMusicTrack('assets/sounds/upgrade-menu1.mp3');
        this.audioManager.loadUpgradeMusicTrack('assets/sounds/upgrade-menu2.mp3');
        this.audioManager.loadUpgradeMusicTrack('assets/sounds/upgrade-menu3.mp3');
        this.audioManager.loadUpgradeMusicTrack('assets/sounds/upgrade-menu4.mp3');
        this.audioManager.loadUpgradeMusicTrack('assets/sounds/upgrade-menu5.mp3');
        this.audioManager.loadUpgradeMusicTrack('assets/sounds/upgrade-menu6.mp3');
        this.audioManager.loadUpgradeMusicTrack('assets/sounds/upgrade-menu7.mp3');
    }
    
    private setupUpgradeButtons(): void {
        const buttonWidth = 200;
        const buttonHeight = 60;
        const buttonPadding = 20;
        const totalHeight = 3 * buttonHeight + 2 * buttonPadding;
        const startY = (this.canvas.height - totalHeight) / 2;
        
        this.upgradeButtons = [
            {
                statType: 'fireRate',
                label: 'Upgrade Fire Rate',
                x: (this.canvas.width - buttonWidth) / 2,
                y: startY,
                width: buttonWidth,
                height: buttonHeight
            },
            {
                statType: 'projectileDamage',
                label: 'Upgrade Damage',
                x: (this.canvas.width - buttonWidth) / 2,
                y: startY + buttonHeight + buttonPadding,
                width: buttonWidth,
                height: buttonHeight
            },
            {
                statType: 'maxHp',
                label: 'Upgrade Max HP',
                x: (this.canvas.width - buttonWidth) / 2,
                y: startY + 2 * (buttonHeight + buttonPadding),
                width: buttonWidth,
                height: buttonHeight
            }
        ];
    }
    
    private handleCanvasClick(event: MouseEvent): void {
        // Only process clicks in UpgradingStats state
        if (this.gameState !== GameState.UpgradingStats) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.processUpgradeSelection(x, y); // Refactored logic
    }

    // New handler for touch events
    private handleCanvasTouch(event: TouchEvent): void {
        // Only process touches in UpgradingStats state
        if (this.gameState !== GameState.UpgradingStats) return;

        event.preventDefault(); // Prevent default touch behavior (like scrolling)
        const touch = event.touches[0]; // Get the first touch point
        if (touch) {
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.processUpgradeSelection(x, y); // Use the same refactored logic
        }
    }

    // Refactored logic for processing clicks or touches on upgrade buttons
    private processUpgradeSelection(x: number, y: number): void {
        // Check if click/touch is on any of the upgrade buttons
        for (const button of this.upgradeButtons) {
            if (
                x >= button.x &&
                x <= button.x + button.width &&
                y >= button.y &&
                y <= button.y + button.height
            ) {
                // Play upgrade confirmation sound
                this.audioManager.playSound('upgrade-selected');
                
                // Log state before upgrade
                this.logGameState("Before Upgrade");
                
                // Upgrade the selected stat
                this.player.upgradeStat(button.statType);
                
                // Stop upgrade menu music 
                this.audioManager.stopUpgradeMusic(); 
                // Resume background music
                this.audioManager.resumeBackgroundMusic();

                // Store the level we're currently on
                const currentLevel = this.currentLevelNumber;
                
                // Find the next wave in the current level
                let foundNextWave = false;
                let tempIndex = this.currentWaveIndex;
                
                while (tempIndex + 1 < levelConfig.length && !foundNextWave) {
                    tempIndex++;
                    const nextWave = levelConfig[tempIndex];
                    
                    // Found a wave in the same level
                    if (nextWave.levelNumber === currentLevel) {
                        foundNextWave = true;
                        this.currentWaveIndex = tempIndex;
                        this.currentLevelNumber = nextWave.levelNumber;
                        this.currentWaveInLevel = nextWave.waveInLevel;
                    } 
                    // Found a wave in the next level
                    else if (nextWave.levelNumber === currentLevel + 1 && nextWave.waveInLevel === 1) {
                        foundNextWave = true;
                        this.currentWaveIndex = tempIndex;
                        this.currentLevelNumber = nextWave.levelNumber;
                        this.currentWaveInLevel = nextWave.waveInLevel;
                    }
                }
                
                if (!foundNextWave) {
                    // We reached the end of the game
                    console.log("All waves completed! Game Won!");
                    this.gameState = GameState.GameWon;
                    this.audioManager.stopBackgroundMusic(); // Stop music on win
                    return;
                }
                
                // Reset enemies and prepare for next wave
                this.enemies = [];
                this.enemiesSpawnedThisWave = 0;
                
                // Move to wave display state
                this.gameState = GameState.DisplayWaveStart;
                this.displayTimer = this.displayDuration;
                
                // Log state after upgrade
                this.logGameState("After Upgrade");
                
                // Update button positions for next time
                this.setupUpgradeButtons();
                break;
            }
        }
    }

    private resizeCanvas(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.player) {
            this.player.x = this.canvas.width / 2;
            this.player.y = this.canvas.height - 60;
        }
        
        // Update button positions
        this.setupUpgradeButtons();
    }

    public async start(): Promise<void> {
        try {
            console.log('Starting asset loading...');
            await this.assetManager.loadAll();
            this.assetsLoaded = true;
            this.gameState = GameState.Loading; // Should transition away after loading
            console.log('Assets loaded successfully.');

            console.log('Game starting...');
            this.lastTime = performance.now();
            this.resetGame(); // Reset and prepare for the first stage/wave
            requestAnimationFrame(this.gameLoop);

        } catch (error) {
            console.error("Failed to load assets. Cannot start game.", error);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '20px Arial';
            this.ctx.fillText('Error loading game assets. Please refresh.', 50, 100);
        }
    }

    private gameLoop(timestamp: number): void {
        if (!this.assetsLoaded && this.gameState === GameState.Loading) {
            // Still loading assets, keep requesting frame but do nothing else
            requestAnimationFrame(this.gameLoop);
            return;
        }

        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        if (this.gameState !== GameState.GameOver && this.gameState !== GameState.GameWon) {
            requestAnimationFrame(this.gameLoop);
        }
    }

    private update(deltaTime: number): void {
        // State machine for game logic
        switch (this.gameState) {
            case GameState.Loading:
                // Should not happen if assetsLoaded check passes in gameLoop
                break;

            case GameState.DisplayWaveStart:
                this.displayTimer -= deltaTime;
                if (this.displayTimer <= 0) {
                    this.startNextWave(); // Start the actual wave after display
                }
                break;

            case GameState.Running:
                this.updateRunning(deltaTime);
                break;
                
            case GameState.UpgradingStats:
                // Music is paused/stopped via state transition
                break;

            case GameState.GameOver:
            case GameState.GameWon:
                // Music stopped via state transition
                break;
        }
    }

    private updateRunning(deltaTime: number): void {
        // Update player
        this.player.update(deltaTime);

        // Update projectiles
        this.projectiles.forEach(p => p.update(deltaTime, this.canvas.width, this.canvas.height));
        this.projectiles = this.projectiles.filter(p => p.isActive);

        // Update enemies
        this.enemies.forEach(e => e.update(deltaTime, this.canvas.width, this.canvas.height));
        this.enemies = this.enemies.filter(e => e.isActive);

        // Update items
        this.items.forEach(i => i.update(deltaTime, this.canvas.height));
        this.items = this.items.filter(i => i.isActive);

        // Check collisions
        this.checkCollisions();

        // Spawn new enemies if needed
        this.spawnEnemy();

        // Check for wave completion
        this.checkWaveCompletion();
        
        // Check for game over
        if (!this.player.isAlive()) {
            this.gameState = GameState.GameOver;
            this.audioManager.stopBackgroundMusic(); // Stop music
            this.audioManager.playSound('game-over'); // Play game over sound
            console.log("Game Over!");
        }
    }

    private checkWaveCompletion(): void {
        if (!this.currentWave) return; // Should not happen in Running state

        const bossDefeated = this.currentWave.isBossWave && this.enemies.length === 0 && this.enemiesSpawnedThisWave > 0;
        const regularWaveComplete = !this.currentWave.isBossWave && 
                                  this.enemiesSpawnedThisWave >= this.totalEnemiesThisWave && 
                                  this.enemies.length === 0;

        if (bossDefeated || regularWaveComplete) {
            console.log(`Wave ${this.currentWave.waveNumber} Complete!`);
            
            const isLastWaveInLevel = this.currentWave.waveInLevel === 
                (this.currentWave.levelNumber % BOSS_LEVEL_INTERVAL === 0 ? 3 : 2);
            
            if (isLastWaveInLevel) {
                console.log(`Level ${this.currentWave.levelNumber} completed! Showing upgrade screen.`);
                this.levelCompleted = true;
                this.gameState = GameState.UpgradingStats;
                this.audioManager.pauseBackgroundMusic(); // Pause gameplay music
                this.audioManager.playUpgradeMusic(); // Play upgrade menu music playlist
            } else {
                console.log(`Wave ${this.currentWave.waveNumber} completed, but not the last wave in level. Moving to next wave.`);
                this.prepareForNextSequence();
            }
        }
    }

    private prepareForNextSequence(): void {
        // Log state before next sequence
        this.logGameState("Before Next Sequence");
        
        // Only increment if we're not coming from upgrade screen
        if (this.gameState !== GameState.UpgradingStats && this.gameState !== GameState.DisplayWaveStart) {
            this.currentWaveIndex++;
        }
        
        // Reset level completion flag
        this.levelCompleted = false;

        if (this.currentWaveIndex >= levelConfig.length) {
            console.log("All waves completed! Game Won!");
            this.gameState = GameState.GameWon;
             this.audioManager.stopBackgroundMusic(); // Stop music on win
            // TODO: Play game won sound?
            return;
        }

        const nextWaveConfig = levelConfig[this.currentWaveIndex];

        // --- Update Level/Wave Tracking --- 
        this.currentLevelNumber = nextWaveConfig.levelNumber;
        this.currentWaveInLevel = nextWaveConfig.waveInLevel;

        // Calculate total enemies for the upcoming wave
        this.totalEnemiesThisWave = nextWaveConfig.isBossWave
            ? 1
            : nextWaveConfig.enemies.reduce((sum, enemyConf) => sum + enemyConf.count, 0);
        this.enemiesSpawnedThisWave = 0;

        console.log(`Preparing Level ${this.currentLevelNumber} - Wave ${this.currentWaveInLevel} Start Screen... (Enemies: ${this.totalEnemiesThisWave})`);
        this.gameState = GameState.DisplayWaveStart;
        this.displayTimer = this.displayDuration;
        
        // Log state after next sequence
        this.logGameState("After Next Sequence");
    }

    private checkCollisions(): void {
        // Projectile vs Enemy collisions
        this.projectiles.forEach(proj => {
            if (!proj.isActive || !proj.isPlayerProjectile) return;

            this.enemies.forEach(enemy => {
                if (!enemy.isActive || !enemy.isAlive()) return;

                // AABB collision check (using radius for projectile)
                const projLeft = proj.x - proj.radius;
                const projRight = proj.x + proj.radius;
                const projTop = proj.y - proj.radius;
                const projBottom = proj.y + proj.radius;

                const enemyLeft = enemy.x - enemy.width / 2;
                const enemyRight = enemy.x + enemy.width / 2;
                const enemyTop = enemy.y - enemy.height / 2;
                const enemyBottom = enemy.y + enemy.height / 2;

                if (
                    projRight > enemyLeft &&
                    projLeft < enemyRight &&
                    projBottom > enemyTop &&
                    projTop < enemyBottom
                ) {
                    enemy.takeDamage(proj.damage); // Use projectile's damage property
                    proj.isActive = false; // Deactivate projectile on hit
                    // TODO: Add hit effect/sound
                }
            });
        });

        // Player vs Enemy collisions
        this.enemies.forEach(enemy => {
            if (!enemy.isActive || !enemy.isAlive()) return;

            // Simple AABB collision check (using player width/height)
            if (
                this.player.x < enemy.x + enemy.width / 2 &&
                this.player.x + this.player.width / 2 > enemy.x - enemy.width / 2 &&
                this.player.y < enemy.y + enemy.height / 2 &&
                this.player.y + this.player.height / 2 > enemy.y - enemy.height / 2
            ) {
                // Damage player (e.g., 1 damage per collision)
                this.player.takeDamage(1);
                // Optionally damage/destroy enemy too, or bounce back
                enemy.takeDamage(1); // Example: Enemy also takes damage
                 console.log("Collision between player and enemy!");
                // TODO: Add collision effect/sound
            }
        });

        // Player vs Item collisions
        this.items.forEach(item => {
            if (!item.isActive) return;

            // Simple AABB collision check
             if (
                this.player.x < item.x + item.width / 2 &&
                this.player.x + this.player.width / 2 > item.x - item.width / 2 &&
                this.player.y < item.y + item.height / 2 &&
                this.player.y + this.player.height / 2 > item.y - item.height / 2
            ) {
                this.collectItem(item);
                item.isActive = false; // Deactivate item on collect
            }
        });
        
         // Enemy Projectile vs Player collisions
        this.projectiles.forEach(proj => {
            if (!proj.isActive || proj.isPlayerProjectile) return;

            // AABB collision check (using radius for projectile)
            const projLeft = proj.x - proj.radius;
            const projRight = proj.x + proj.radius;
            const projTop = proj.y - proj.radius;
            const projBottom = proj.y + proj.radius;

            const playerLeft = this.player.x - this.player.width / 2;
            const playerRight = this.player.x + this.player.width / 2;
            const playerTop = this.player.y - this.player.height / 2;
            const playerBottom = this.player.y + this.player.height / 2;

            if (
                projRight > playerLeft &&
                projLeft < playerRight &&
                projBottom > playerTop &&
                projTop < playerBottom
            ) {
                this.player.takeDamage(proj.damage); // Use projectile's damage
                proj.isActive = false; // Deactivate projectile on hit
                console.log("Player hit by enemy projectile!");
                // TODO: Add hit effect/sound
            }
        });
    }
    
    // Handle collecting an item
    private collectItem(item: Item): void {
        console.log(`Collected item: ${item.type}`);
        let playSound = true;
        switch (item.type) {
            case ItemType.Health:
                this.player.heal(1); // Heal handles its own sound check now
                playSound = false; // Don't play generic collect sound for health
                break;
            case ItemType.PizzaChange:
                 const nextPizzaType = this.getRandomPizzaType();
                 this.player.changeShip(nextPizzaType); // ChangeShip plays its own sound
                 playSound = false;
                 break;
            case ItemType.TempFireRate:
                 this.player.activateTempFireRate(10); // Plays boost-activate sound
                 playSound = false;
                 break;
            case ItemType.TempDamage:
                 this.player.activateTempDamage(10); // Plays boost-activate sound
                 playSound = false;
                 break;
        }
        if (playSound) {
             this.audioManager.playSound('collect-item'); // Fallback sound
        }
    }
    
    // Helper to get a random pizza type (excluding Plain)
    private getRandomPizzaType(): PizzaType {
        const types = [PizzaType.Pepperoni, PizzaType.Hawaiian, PizzaType.Vegetarian, PizzaType.Meatlovers];
        // Avoid giving the same type player currently has, if possible
         const currentType = this.player.shipType;
         const availableTypes = types.filter(t => t !== currentType);
         if (availableTypes.length > 0) {
            return availableTypes[Math.floor(Math.random() * availableTypes.length)];
         } else {
             // Fallback if somehow player has all types (or only Plain is left)
             return types[Math.floor(Math.random() * types.length)];
                }
    }

    private spawnEnemy(): void {
        if (!this.currentWave || this.currentWave.isBossWave) return;

        this.enemySpawnTimer -= 1 / 60; // Assuming 60 FPS for deltaTime approximation
        if (this.enemySpawnTimer <= 0 && this.enemiesSpawnedThisWave < this.totalEnemiesThisWave) {
            // Determine which enemy to spawn based on wave config
            let cumulativeCount = 0;
            const enemyConfig = this.currentWave.enemies.find(ec => {
                cumulativeCount += ec.count;
                return this.enemiesSpawnedThisWave < cumulativeCount;
            });

            if (enemyConfig) {
                const enemyType = enemyConfig.type;
                const spawnX = Math.random() * this.canvas.width;
                const spawnY = -50; // Spawn above screen
            let newEnemy: Enemy | null = null;

                switch (enemyType) {
                    case EnemyType.HotDog:
                        newEnemy = new HotDogEnemy(spawnX, spawnY, this.assetManager, this.spawnItem, this.audioManager);
                        break;
                    case EnemyType.FrenchFries:
                        newEnemy = new FrenchFriesEnemy(spawnX, spawnY, this.assetManager, this.spawnItem, this.audioManager);
                        break;
                    case EnemyType.Donut:
                        newEnemy = new DonutEnemy(spawnX, spawnY, this.assetManager, this.spawnItem, this.audioManager);
                        break;
                    case EnemyType.Hamburger:
                        newEnemy = new HamburgerEnemy(spawnX, spawnY, this.assetManager, this.spawnItem, this.audioManager);
                        break;
                    // Bosses are spawned via spawnBoss
            }

            if (newEnemy) {
                this.enemies.push(newEnemy);
                this.enemiesSpawnedThisWave++;
                    this.enemySpawnTimer = this.currentWave.spawnInterval; // Reset timer
                }
            } else {
                 console.error("Could not determine enemy type to spawn based on wave config");
                 // Avoid infinite loop if config is bad
                 this.enemiesSpawnedThisWave = this.totalEnemiesThisWave; 
            }
        }
    }

    private spawnBoss(bossType: EnemyType): void {
        if (bossType !== EnemyType.Taco) {
            console.error("Attempted to spawn non-Taco boss type");
                return;
        }
        const spawnX = this.canvas.width / 2;
        const spawnY = -80; // Spawn boss higher up
        const bossHp = 50 + (this.currentLevelNumber / BOSS_LEVEL_INTERVAL) * 25; // Scale HP based on level

        const boss = new TacoEnemy(
            spawnX,
            spawnY,
            bossHp,
            this.assetManager,
            this.addEnemyProjectile, // Pass enemy projectile callback
            this.spawnItem, // Pass item spawn callback
            this.audioManager, // Pass audio manager
            this.player // Pass player reference
        );
            this.enemies.push(boss);
        this.enemiesSpawnedThisWave++; // Boss counts as the one enemy for the wave
         console.log(`Spawning Taco Boss with ${bossHp} HP`);
    }

    private startNextWave(): void {
        // Log state before starting wave
        this.logGameState("Before Starting Wave");
        
        // Now called *after* the display screen timer finishes
        if (this.currentWaveIndex >= levelConfig.length) {
            console.error("startNextWave called after last wave.");
            this.gameState = GameState.GameWon;
            return;
        }

        // --- Set the active wave config --- 
        this.currentWave = levelConfig[this.currentWaveIndex];
        
        // Make sure enemies from previous waves are cleared
        this.enemies = [];
        
        // Calculate total enemies for this wave
        this.totalEnemiesThisWave = this.currentWave.isBossWave
            ? 1
            : this.currentWave.enemies.reduce((sum, enemyConf) => sum + enemyConf.count, 0);
        
        // Reset enemy spawn counters
        this.enemiesSpawnedThisWave = 0;
        
        // Reset spawn timer for the wave start
        this.enemySpawnTimer = 0;
        
        // Set state to Running
        this.gameState = GameState.Running;
        
        // Start or resume background music for the running state
        this.audioManager.playBackgroundMusic(); // AudioManager handles resuming vs starting new

        // Log current level and wave info for debugging
        console.log(`Starting Level ${this.currentWave.levelNumber} - Wave ${this.currentWave.waveInLevel}`);
        console.log(`Current wave index: ${this.currentWaveIndex}, Total waves: ${levelConfig.length}`);
        
        if (!this.currentWave.isBossWave) {
            console.log(`Enemies to spawn: ${this.totalEnemiesThisWave}, Interval: ${this.currentWave.spawnInterval}s`);
        }

        if (this.currentWave.isBossWave && this.currentWave.bossType) {
            this.spawnBoss(this.currentWave.bossType);
        } else if (this.totalEnemiesThisWave === 0 && !this.currentWave.isBossWave) {
             console.warn(`Level ${this.currentWave.levelNumber} Wave ${this.currentWave.waveInLevel} has no enemies. Preparing next sequence.`);
             this.prepareForNextSequence(); // Skip empty waves immediately
        }
        
        // Log state after starting wave
        this.logGameState("After Starting Wave");
    }

    private draw(): void {
        // Clear the canvas
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw content based on current game state
        switch (this.gameState) {
            case GameState.Loading:
                this.drawLoadingScreen();
                break;

            case GameState.Running:
                this.drawRunningGame();
                break;

            case GameState.DisplayWaveStart:
                this.drawWaveStartScreen();
                break;
                
            case GameState.UpgradingStats:
                this.drawUpgradeScreen();
                break;

            case GameState.GameOver:
                this.drawGameOverScreen();
                break;

            case GameState.GameWon:
                this.drawGameWonScreen();
                break;
        }

        // Always draw some aspects of the UI (FPS, etc.)
        if (this.gameState !== GameState.Loading) {
            this.drawUI();
        }
    }

    private drawRunningGame(): void {
        // Draw player
        this.player.draw(this.ctx);

        // Draw projectiles
        this.projectiles.forEach(p => p.draw(this.ctx));

        // Draw enemies
        this.enemies.forEach(e => e.draw(this.ctx));

        // Draw items
        this.items.forEach(i => i.draw(this.ctx));
    }
    
    private drawUpgradeScreen(): void {
        // Draw a dark overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw title
        this.ctx.fillStyle = 'white';
        this.ctx.font = '40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Level Completed!', this.canvas.width / 2, 100);
        this.ctx.font = '30px Arial';
        this.ctx.fillText('Choose an upgrade:', this.canvas.width / 2, 150);
        
        // Show current stats
        const stats = this.player.getStats();
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Current Stats:`, this.canvas.width / 2, 200);
        this.ctx.fillText(`Fire Rate: ${stats.fireRate.toFixed(1)} shots/sec`, this.canvas.width / 2, 230);
        this.ctx.fillText(`Damage: ${stats.projectileDamage}`, this.canvas.width / 2, 260);
        this.ctx.fillText(`Max HP: ${stats.maxHp}`, this.canvas.width / 2, 290);
        
        // Draw upgrade buttons
        this.ctx.font = '24px Arial';
        for (const button of this.upgradeButtons) {
            // Button background
            this.ctx.fillStyle = 'rgba(50, 50, 200, 0.8)';
            this.ctx.fillRect(button.x, button.y, button.width, button.height);
            
            // Button border
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(button.x, button.y, button.width, button.height);
            
            // Button text
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2);
        }
    }

    private drawUI(): void {
        // NOTE: Assuming we have a current wave to display (may need to be conditional)
        if (this.currentWave) {
            // Draw level and wave info in top-left
            this.ctx.fillStyle = 'white';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Level: ${this.currentLevelNumber}`, 20, 30);
            this.ctx.fillText(`Wave: ${this.currentWaveInLevel}`, 20, 50);
            
            // Calculate remaining enemies that need to be defeated
            const enemiesDefeated = this.enemiesSpawnedThisWave - this.enemies.filter(e => e.isAlive()).length;
            const enemiesRemaining = this.totalEnemiesThisWave - enemiesDefeated;
            this.ctx.fillText(`Enemies: ${enemiesRemaining}/${this.totalEnemiesThisWave}`, 20, 70);
            
            // Draw player stats in top-right
            const stats = this.player.getStats();
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`Fire Rate: ${stats.fireRate.toFixed(1)}`, this.canvas.width - 20, 30);
            this.ctx.fillText(`Damage: ${stats.projectileDamage}`, this.canvas.width - 20, 50);
            this.ctx.fillText(`HP: ${this.player.hp}/${stats.maxHp}`, this.canvas.width - 20, 70);
        }
    }

    private drawLoadingScreen(): void {
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading Assets...', this.canvas.width / 2, this.canvas.height / 2);
    }

    private drawWaveStartScreen(): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'lime';
        this.ctx.font = '40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Use upcoming wave config for display
        const upcomingWave = levelConfig[this.currentWaveIndex];
        const levelNum = upcomingWave?.levelNumber || '?';
        const waveInLevelNum = upcomingWave?.waveInLevel || '?';
        this.ctx.fillText(`Level ${levelNum} - Wave ${waveInLevelNum}`, this.canvas.width / 2, this.canvas.height / 2 - 60);

        // Display Objective
        let objectiveText = `Objective: Defeat ${this.totalEnemiesThisWave} enemies`;
        if (upcomingWave?.isBossWave) {
            objectiveText = `Objective: Defeat the TACO BOSS!`;
        }
        this.ctx.fillText(objectiveText, this.canvas.width / 2, this.canvas.height / 2);

        // Display Timer
        this.ctx.font = '18px Arial';
        this.ctx.fillText(`Starting in ${this.displayTimer.toFixed(1)}s...`, this.canvas.width / 2, this.canvas.height / 2 + 40);
    }

    private drawGameOverScreen(): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Game Over', this.canvas.width / 2, this.canvas.height / 2 - 30);
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Refresh to play again', this.canvas.width / 2, this.canvas.height / 2 + 20);
    }

    private drawGameWonScreen(): void {
        this.ctx.fillStyle = 'rgba(0, 50, 0, 0.8)'; // Dark green tint
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'gold';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('You Won!', this.canvas.width / 2, this.canvas.height / 2 - 30);
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText('Congratulations! Refresh to play again.', this.canvas.width / 2, this.canvas.height / 2 + 20);
        // TODO: Add score display?
    }

    public addProjectile(x: number, y: number, angle: number, damageOverride?: number): void {
        const isPlayer = true; // This method is only called by player
        const damage = damageOverride ?? this.player.getProjectileDamage(); // Use override or player's current
        this.projectiles.push(new Projectile(x, y, isPlayer, angle, damage));
    }

    public addEnemyProjectile(x: number, y: number, isPlayer: boolean, angle: number): void {
        const damage = 1; // Standard enemy projectile damage
        this.projectiles.push(new Projectile(x, y, isPlayer, angle, damage));
    }
    
    // Method to spawn items
    public spawnItem(type: ItemType, x: number, y: number): void {
        const newItem = new Item(x, y, type, this.assetManager);
        this.items.push(newItem);
        console.log(`Spawned item ${type} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    }

    private resetGame(): void {
        // Reset player state
        this.player.hp = this.player.maxHp;
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - 60;

        // Clear arrays
        this.projectiles = [];
        this.enemies = [];
        this.items = [];

        // Reset timers and flags
        this.lastTime = performance.now();

        // Reset wave/stage state
        this.currentWaveIndex = -1;
        this.currentWave = null;
        this.enemiesSpawnedThisWave = 0;
        this.totalEnemiesThisWave = 0;
        this.enemySpawnTimer = 0; // Reset enemy spawn timer

        console.log("Game reset.");
        this.audioManager.stopBackgroundMusic(); // Stop music on reset
        this.gameState = GameState.Loading;
        this.prepareForNextSequence();
    }

    private logGameState(message: string): void {
        console.log(`${message}:`);
        console.log(`  Current Wave Index: ${this.currentWaveIndex}`);
        console.log(`  Level Number: ${this.currentLevelNumber}`);
        console.log(`  Wave in Level: ${this.currentWaveInLevel}`);
        console.log(`  Game State: ${GameState[this.gameState]}`);
        console.log(`  Level Completed: ${this.levelCompleted}`);
        if (this.currentWave) {
            console.log(`  Current Wave: ${this.currentWave.waveNumber} (Level ${this.currentWave.levelNumber}, Wave ${this.currentWave.waveInLevel})`);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.start().catch(err => {
        console.error("Error starting game:", err);
    });
}); 