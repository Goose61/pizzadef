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

        this.assetManager.queueImage('hotdog', 'assets/hotdog.png');
        this.assetManager.queueImage('frenchFries', 'assets/french-fries.png');
        this.assetManager.queueImage('donut', 'assets/donut.png');
        this.assetManager.queueImage('hamburger', 'assets/hamburger.png');
        this.assetManager.queueImage('taco', 'assets/taco.png');

        this.resizeCanvas();

        this.player = new Player(
            this.canvas.width / 2,
            this.canvas.height - 60,
            this.canvas,
            this.audioManager,
            (x, y) => this.addProjectile(x, y, true, -Math.PI / 2)
        );

        window.addEventListener('resize', this.resizeCanvas.bind(this));
        
        // Add click handler for upgrade buttons
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));

        this.gameLoop = this.gameLoop.bind(this);
        this.spawnEnemy = this.spawnEnemy.bind(this);
        this.spawnBoss = this.spawnBoss.bind(this);
        this.addProjectile = this.addProjectile.bind(this);
        this.addEnemyProjectile = this.addEnemyProjectile.bind(this);
        
        // Set up upgrade buttons
        this.setupUpgradeButtons();
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
        
        // Check if click is on any of the upgrade buttons
        for (const button of this.upgradeButtons) {
            if (
                x >= button.x && 
                x <= button.x + button.width &&
                y >= button.y && 
                y <= button.y + button.height
            ) {
                // Log state before upgrade
                this.logGameState("Before Upgrade");
                
                // Upgrade the selected stat
                this.player.upgradeStat(button.statType);
                
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
                // No updates needed, waiting for player to select an upgrade
                break;

            case GameState.GameOver:
            case GameState.GameWon:
                // No updates needed for static end screens
                break;
        }
    }

    private updateRunning(deltaTime: number): void {
        // If no wave config loaded (shouldn't happen in Running state), return
        if (!this.currentWave) {
            console.error("Attempting to run game logic without a current wave loaded.");
            this.gameState = GameState.GameOver; // Fail safe
            return;
        }

        this.player.update(deltaTime);

        this.projectiles.forEach(projectile => projectile.update(deltaTime, this.canvas.width, this.canvas.height));
        this.projectiles = this.projectiles.filter(projectile => projectile.isActive);

        this.enemies.forEach(enemy => enemy.update(deltaTime, this.canvas.width, this.canvas.height));
        this.enemies = this.enemies.filter(enemy => enemy.isActive);

        // Enemy Spawning Logic (moved from old update)
        if (this.currentWave && !this.currentWave.isBossWave) {
            // Use a timer specific to spawning, reset when needed
            this.enemySpawnTimer -= deltaTime;
            if (this.enemySpawnTimer <= 0 && this.enemiesSpawnedThisWave < this.totalEnemiesThisWave) {
                this.spawnEnemy();
                // Reset timer based on the current wave's interval
                this.enemySpawnTimer = this.currentWave.spawnInterval;
            }
        }

        this.checkCollisions();

        // Check for wave completion
        this.checkWaveCompletion();
    }

    private checkWaveCompletion(): void {
        if (!this.currentWave) return; // Should not happen in Running state

        const bossDefeated = this.currentWave.isBossWave && this.enemies.length === 0 && this.enemiesSpawnedThisWave > 0;
        const regularWaveComplete = !this.currentWave.isBossWave && 
                                  this.enemiesSpawnedThisWave >= this.totalEnemiesThisWave && 
                                  this.enemies.length === 0;

        if (bossDefeated || regularWaveComplete) {
            console.log(`Wave ${this.currentWave.waveNumber} Complete!`);
            
            // Check if this is the last wave in a level
            const isLastWaveInLevel = this.currentWave.waveInLevel === 
                (this.currentWave.levelNumber % BOSS_LEVEL_INTERVAL === 0 ? 3 : 2);
            
            // Only set levelCompleted flag if this is actually the last wave in the level
            if (isLastWaveInLevel) {
                console.log(`Level ${this.currentWave.levelNumber} completed! Showing upgrade screen.`);
                this.levelCompleted = true;
                this.gameState = GameState.UpgradingStats;
                
                // Don't increment the wave index yet - we'll do that after upgrade selection
                // in the handleCanvasClick method
            } else {
                console.log(`Wave ${this.currentWave.waveNumber} completed, but not the last wave in level. Moving to next wave.`);
                this.prepareForNextSequence(); // Prepare for next wave in the same level
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
        // Check projectile collisions with enemies
        this.projectiles.forEach(projectile => {
            if (!projectile.isActive || !projectile.isPlayerProjectile) return;

            this.enemies.forEach(enemy => {
                // Only check active enemies that are alive
                if (!enemy.isActive || !enemy.isAlive()) return;

                const projLeft = projectile.x - projectile.radius;
                const projRight = projectile.x + projectile.radius;
                const projTop = projectile.y - projectile.radius;
                const projBottom = projectile.y + projectile.radius;

                const enemyLeft = enemy.x - enemy.width / 2;
                const enemyRight = enemy.x + enemy.width / 2;
                const enemyTop = enemy.y - enemy.height / 2;
                const enemyBottom = enemy.y + enemy.height / 2;

                // Check for collision
                if (projRight > enemyLeft && projLeft < enemyRight && projBottom > enemyTop && projTop < enemyBottom) {
                    enemy.takeDamage(projectile.damage); // Use projectile damage
                    projectile.isActive = false; // Deactivate projectile
                    this.audioManager.playSound('enemyHit');

                    // Check if enemy was destroyed by projectile
                    if (!enemy.isAlive()) {
                        this.audioManager.playSound('enemyDestroy');
                        // TODO: Add score increase here
                    }
                }
            });
        });

        // Check enemy projectile collisions with player
        this.projectiles.forEach(projectile => {
            if (!projectile.isActive || projectile.isPlayerProjectile || !this.player.isAlive()) return;

            const projLeft = projectile.x - projectile.radius;
            const projRight = projectile.x + projectile.radius;
            const projTop = projectile.y - projectile.radius;
            const projBottom = projectile.y + projectile.radius;

            const playerLeft = this.player.x - this.player.width / 2;
            const playerRight = this.player.x + this.player.width / 2;
            const playerTop = this.player.y - this.player.height / 2;
            const playerBottom = this.player.y + this.player.height / 2;

            // Check for collision
            if (projRight > playerLeft && projLeft < playerRight && projBottom > playerTop && projTop < playerBottom) {
                this.player.takeDamage(projectile.damage); // Apply damage to player
                projectile.isActive = false; // Deactivate projectile
                this.audioManager.playSound('playerHit');

                // Check if player died
                if (!this.player.isAlive()) {
                    console.log("Player defeated! Game Over.");
                    this.gameState = GameState.GameOver;
                    this.audioManager.playSound('playerDefeat');
                }
            }
        });

        // Check collisions between enemies and player (direct hit)
        this.enemies.forEach(enemy => {
            if (!enemy.isActive || !enemy.isAlive() || !this.player.isAlive()) return;

            const enemyLeft = enemy.x - enemy.width / 2;
            const enemyRight = enemy.x + enemy.width / 2;
            const enemyTop = enemy.y - enemy.height / 2;
            const enemyBottom = enemy.y + enemy.height / 2;

            const playerLeft = this.player.x - this.player.width / 2;
            const playerRight = this.player.x + this.player.width / 2;
            const playerTop = this.player.y - this.player.height / 2;
            const playerBottom = this.player.y + this.player.height / 2;

            // Check for collision
            if (enemyRight > playerLeft && enemyLeft < playerRight && enemyBottom > playerTop && enemyTop < playerBottom) {
                enemy.isActive = false; // Deactivate enemy on collision
                this.player.takeDamage(1); // Player takes 1 damage
                this.audioManager.playSound('playerHit');

                // Check if player died
                if (!this.player.isAlive()) {
                    console.log("Player defeated! Game Over.");
                    this.gameState = GameState.GameOver;
                    this.audioManager.playSound('playerDefeat');
                }
            }
        });
    }

    private spawnEnemy(): void {
        if (!this.currentWave || this.currentWave.isBossWave) return;

        // Get the list of enemies for the current wave
        const waveEnemies = this.currentWave.enemies;

        // Calculate remaining enemies to choose from
        let availableToSpawn: WaveEnemyConfig[] = [];
        let currentSpawnCounts: { [key in EnemyType]?: number } = {};
        this.enemies.forEach(e => {
            if (e.type !== EnemyType.Taco) { // Don't count boss in spawn counts if it exists
                 currentSpawnCounts[e.type] = (currentSpawnCounts[e.type] || 0) + 1;
            }
        });
        // Need to count enemies previously spawned this wave but now destroyed
        // This simple logic assumes we just pick randomly from the wave list until total is reached
        // A better approach would track counts per type precisely.

        // Simple random selection from the wave's enemy types for now:
        if (waveEnemies.length > 0) {
            const spawnPadding = 60;
            const x = Math.random() * (this.canvas.width - spawnPadding * 2) + spawnPadding;
            const y = -50; // Start off-screen top

            const randomIndex = Math.floor(Math.random() * waveEnemies.length);
            const typeToSpawn = waveEnemies[randomIndex].type; // Just pick a random type defined for the wave

            let newEnemy: Enemy | null = null;

            switch (typeToSpawn) {
                case EnemyType.HotDog: newEnemy = new HotDogEnemy(x, y, this.assetManager); break;
                case EnemyType.FrenchFries: newEnemy = new FrenchFriesEnemy(x, y, this.assetManager); break;
                case EnemyType.Donut: newEnemy = new DonutEnemy(x, y, this.assetManager); break;
                case EnemyType.Hamburger: newEnemy = new HamburgerEnemy(x, y, this.assetManager); break;
                // Bosses are spawned separately
                case EnemyType.Taco: console.warn("Trying to spawn Taco boss via regular spawn logic?"); break;
            }

            if (newEnemy) {
                this.enemies.push(newEnemy);
                this.enemiesSpawnedThisWave++;
                console.log(`Spawned ${typeToSpawn} (${this.enemiesSpawnedThisWave}/${this.totalEnemiesThisWave}) for wave ${this.currentWave.waveNumber}`);
            }
        }
    }

    private spawnBoss(bossType: EnemyType): void {
        if (!this.currentWave || !this.currentWave.isBossWave) return;

        const x = this.canvas.width / 2;
        const y = -100;
        let boss: Enemy | null = null;

        // Boss HP Scaling (Use currentLevelNumber)
        const baseBossHp = 50;
        // Calculate how many boss intervals have passed (Level 5 is 1st, Level 10 is 2nd, etc.)
        const bossLevelNum = Math.max(0, Math.floor((this.currentLevelNumber - 1) / BOSS_LEVEL_INTERVAL));
        const scaledHp = baseBossHp + bossLevelNum * 25;

        switch (bossType) {
            case EnemyType.Taco:
                boss = new TacoEnemy(
                    x, y,
                    scaledHp,
                    this.assetManager,
                    this.addEnemyProjectile.bind(this),
                    this.player
                );
                break;
            default:
                console.error(`Unknown boss type specified: ${bossType}`);
                return;
        }

        if (boss) {
            this.enemies.push(boss);
            this.enemiesSpawnedThisWave = 1;
            this.totalEnemiesThisWave = 1;
            console.log(`Spawned BOSS: ${bossType} (Level: ${this.currentLevelNumber}, HP: ${scaledHp}) for wave ${this.currentWave.waveNumber}`);
        }
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
        // Draw background (added later potentially)

        // Draw game objects
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.projectiles.forEach(projectile => projectile.draw(this.ctx));
        this.player.draw(this.ctx);
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

    public addProjectile(x: number, y: number, isPlayer: boolean, angle: number): void {
        const damage = isPlayer ? this.player.getProjectileDamage() : 1;
        this.projectiles.push(new Projectile(x, y, isPlayer, angle, damage));
    }

    public addEnemyProjectile(x: number, y: number, isPlayer: boolean, angle: number): void {
        this.projectiles.push(new Projectile(x, y, isPlayer, angle, 1)); // Enemy projectiles deal 1 damage
    }

    private resetGame(): void {
        // Reset player state
        this.player.hp = this.player.maxHp;
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - 60;

        // Clear arrays
        this.projectiles = [];
        this.enemies = [];

        // Reset timers and flags
        this.lastTime = performance.now();

        // Reset wave/stage state
        this.currentWaveIndex = -1;
        this.currentWave = null;
        this.enemiesSpawnedThisWave = 0;
        this.totalEnemiesThisWave = 0;
        this.enemySpawnTimer = 0; // Reset enemy spawn timer

        console.log("Game reset.");
        // Immediately prepare the first sequence (Stage 1 screen)
        this.gameState = GameState.Loading; // Temporarily set to loading until first prep
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