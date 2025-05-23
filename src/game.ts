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
import { BackgroundManager } from './background'; // Import BackgroundManager

// Global debug log for troubleshooting
let debugLogs: string[] = [];
function addDebugLog(message: string) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
    debugLogs.push(`${timestamp}: ${message}`);
    if (debugLogs.length > 50) debugLogs.shift(); // Keep log size manageable
    console.log(`DEBUG: ${message}`);
    
    // Update debug element if it exists
    const debugElement = document.getElementById('telegram-debug');
    if (debugElement) {
        debugElement.innerHTML = debugLogs.join('<br>');
        debugElement.scrollTop = debugElement.scrollHeight;
    }
}

// Create or get debug container
function createDebugDisplay() {
    let debugElement = document.getElementById('telegram-debug');
    if (!debugElement) {
        debugElement = document.createElement('div');
        debugElement.id = 'telegram-debug';
        debugElement.style.position = 'fixed';
        debugElement.style.bottom = '10px';
        debugElement.style.right = '10px';
        debugElement.style.width = '300px';
        debugElement.style.height = '200px';
        debugElement.style.background = 'rgba(0,0,0,0.7)';
        debugElement.style.color = '#0f0';
        debugElement.style.padding = '10px';
        debugElement.style.overflow = 'auto';
        debugElement.style.fontSize = '10px';
        debugElement.style.fontFamily = 'monospace';
        debugElement.style.zIndex = '9999';
        document.body.appendChild(debugElement);

        // Add toggle button for debug display
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Debug';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.bottom = '10px';
        toggleBtn.style.right = '320px';
        toggleBtn.style.zIndex = '9999';
        toggleBtn.style.padding = '5px';
        toggleBtn.style.background = '#333';
        toggleBtn.style.color = '#fff';
        toggleBtn.style.border = 'none';
        toggleBtn.addEventListener('click', () => {
            debugElement!.style.display = debugElement!.style.display === 'none' ? 'block' : 'none';
        });
        document.body.appendChild(toggleBtn);
    }
    return debugElement;
}

// Export GameState enum
export enum GameState {
    Menu, // NEW: Initial state showing the menu
    Loading,
    Running,
    GameOver,
    GameWon,
    DisplayWaveStart,
    UpgradingStats,
}

class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private player: Player | null = null;
    private backgroundManager: BackgroundManager | null = null;
    private lastTime: number = 0;
    private audioManager: AudioManager;
    private assetManager: AssetManager;
    private projectiles: Projectile[] = [];
    private enemies: Enemy[] = [];
    private items: Item[] = [];
    private assetsLoaded: boolean = false;
    private gameState: GameState = GameState.Menu; // Start in Menu state

    // --- Score and User Info ---
    private score: number = 0;
    private userId: number | null = null;
    private username: string | null = null;
    // -------------------------

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

    // Loop control
    private animationFrameId: number | null = null;
    private isBackgroundLoopOnly: boolean = false;

    constructor() {
        // Initialize Telegram Web App if available
        const telegramObj = window as any;
        if (telegramObj.Telegram && telegramObj.Telegram.WebApp) {
            const tg = telegramObj.Telegram.WebApp;
            tg.ready();
            tg.expand();
            // Get user info for leaderboard
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                this.userId = tg.initDataUnsafe.user.id;
                this.username = tg.initDataUnsafe.user.username || 
                                 `${tg.initDataUnsafe.user.first_name}${tg.initDataUnsafe.user.last_name ? ' ' + tg.initDataUnsafe.user.last_name : ''}`.trim() || 
                                 `user_${this.userId}`;
                console.log(`Logged in as: ${this.username} (ID: ${this.userId})`);
                // Note: Login call is handled in menu.js before game loads
            } else {
                console.warn("Could not get Telegram user info.");
            }
        }
        
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get 2D rendering context');
        }
        this.ctx = context;
        this.audioManager = new AudioManager();
        this.assetManager = new AssetManager();
        
        // Queue assets (doesn't load them yet)
        this.queueAssets();

        this.resizeCanvas();

        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        this.handlePlayClick = this.handlePlayClick.bind(this);
        this.handleLeaderboardClick = this.handleLeaderboardClick.bind(this);
        this.resizeCanvas = this.resizeCanvas.bind(this);
        this.handleCanvasClick = this.handleCanvasClick.bind(this);
        this.handleCanvasTouch = this.handleCanvasTouch.bind(this);
        this.addProjectile = this.addProjectile.bind(this);
        this.updateScore = this.updateScore.bind(this);
        this.spawnItem = this.spawnItem.bind(this);
        this.addEnemyProjectile = this.addEnemyProjectile.bind(this);

        // Add event listeners
        window.addEventListener('resize', this.resizeCanvas);
        this.canvas.addEventListener('click', this.handleCanvasClick);
        this.canvas.addEventListener('touchstart', this.handleCanvasTouch, { passive: false });
        
        // Add Menu Button Listeners (ensure elements exist)
        const playButton = document.getElementById('playButton');
        const leaderboardButton = document.getElementById('leaderboardButton');
        if (playButton) {
            playButton.addEventListener('click', this.handlePlayClick);
        } else {
            console.error("Play button not found!");
        }
        if (leaderboardButton) {
            leaderboardButton.addEventListener('click', this.handleLeaderboardClick);
        } else {
             console.error("Leaderboard button not found!");
        }
        
        // Initialize Telegram SDK (moved here from start of constructor)
        this.initializeTelegram(); 
    }
    
    private initializeTelegram(): void {
        const telegramObj = window as any;
        addDebugLog("Initializing Telegram WebApp integration...");
        
        createDebugDisplay(); // Create debug container
        
        if (telegramObj.Telegram && telegramObj.Telegram.WebApp) {
            const tg = telegramObj.Telegram.WebApp;
            tg.ready();
            tg.expand();
            addDebugLog("Telegram Web App SDK initialized.");
            
            // Get user info - might be null initially
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                this.userId = tg.initDataUnsafe.user.id;
                const firstName = tg.initDataUnsafe.user.first_name || '';
                const lastName = tg.initDataUnsafe.user.last_name || '';
                const username = tg.initDataUnsafe.user.username || '';
                
                addDebugLog(`Raw Telegram user data: id=${this.userId}, first=${firstName}, last=${lastName}, username=${username}`);
                
                // Build username with fallbacks
                this.username = username || 
                               `${firstName}${lastName ? ' ' + lastName : ''}`.trim() || 
                               `user_${this.userId}`;
                
                addDebugLog(`User info available: ${this.username} (ID: ${this.userId})`);
            } else {
                addDebugLog("Telegram user info not immediately available.");
                try {
                    addDebugLog("initDataUnsafe content: " + JSON.stringify(telegramObj.Telegram.WebApp.initDataUnsafe || {}));
                } catch (e) {
                    addDebugLog("Error stringifying initDataUnsafe: " + e);
                }
            }
        } else {
            addDebugLog("Telegram SDK not found or incomplete.");
            addDebugLog("window.Telegram exists: " + !!telegramObj.Telegram);
            if (telegramObj.Telegram) {
                addDebugLog("window.Telegram.WebApp exists: " + !!telegramObj.Telegram.WebApp);
            }
        }
    }
    
    private queueAssets(): void {
        // --- Background Assets ---
        const bgBasePath = 'assets/backgrounds/';
        this.assetManager.queueImage(bgBasePath + 'blue-back.png', bgBasePath + 'blue-back.png');
        this.assetManager.queueImage(bgBasePath + 'blue-stars.png', bgBasePath + 'blue-stars.png');
        this.assetManager.queueImage(bgBasePath + 'asteroid-1.png', bgBasePath + 'asteroid-1.png');
        this.assetManager.queueImage(bgBasePath + 'asteroid-2.png', bgBasePath + 'asteroid-2.png');
        this.assetManager.queueImage(bgBasePath + 'prop-planet-big.png', bgBasePath + 'prop-planet-big.png');
        this.assetManager.queueImage(bgBasePath + 'prop-planet-small.png', bgBasePath + 'prop-planet-small.png');
        
        // --- Player Pizza Sprites ---
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
                // --- MUSIC CHANGE START ---
                // Stop upgrade menu music IMMEDIATELY
                this.audioManager.stopUpgradeMusic(); 
                // Play upgrade confirmation sound
                this.audioManager.playSound('upgrade-selected');
                // --- MUSIC CHANGE END ---
                
                // Log state before upgrade
                this.logGameState("Before Upgrade");
                
                // Upgrade the selected stat
                this.player?.upgradeStat(button.statType);
                
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
                    this.sendScoreToBackend(); // <<< SEND SCORE ON GAME WON
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
        // Resize background manager as well
        if (this.backgroundManager) { 
            this.backgroundManager.resize(this.canvas.width, this.canvas.height);
        }
        // Update button positions
        this.setupUpgradeButtons();
    }

    public async startInitialLoad(): Promise<void> { // Renamed to avoid confusion with starting game loop
        if (this.assetsLoaded) return; // Don't reload
        
        this.gameState = GameState.Loading; // Show loading screen
        // Draw loading screen once manually before starting loop
        this.draw(); 
        
        try {
            console.log('Starting asset loading...');
            await this.assetManager.loadAll();
            this.assetsLoaded = true;
            console.log('Assets loaded successfully.');

            // *** Initialize components AFTER assets are loaded ***
            console.log('Initializing BackgroundManager...');
            this.backgroundManager = new BackgroundManager(this.assetManager, this.canvas.width, this.canvas.height);
            
            console.log('Initializing Player...');
            // Ensure Player is created only once
            if (!this.player) { 
                this.player = new Player(
                    this.canvas.width / 2,
                    this.canvas.height - 60,
                    this.canvas,
                    this.audioManager,
                    this.assetManager,
                    this.addProjectile.bind(this),
                    this.updateScore.bind(this)
                );
            }
            // Set up buttons again after resize potentially happened during loading
            this.setupUpgradeButtons(); 
            
            // Assets are loaded, transition back to Menu state 
            // and start the background-only animation loop
            this.gameState = GameState.Menu; 
            this.startAnimationLoop(true); // Start background-only loop

        } catch (error) {
            console.error("Failed to load assets. Cannot start game.", error);
            // Stay in loading state and show error (draw loop will handle this)
            // Optionally change state to an Error state
        }
    }
    
    // Method to start the animation loop (either background-only or full game)
    private startAnimationLoop(backgroundOnly: boolean): void {
        if (this.animationFrameId !== null) {
            console.warn("Animation loop already running.");
            return;
        }
        console.log(`Starting animation loop (Background Only: ${backgroundOnly})`);
        this.isBackgroundLoopOnly = backgroundOnly;
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
    
    // Method to stop the animation loop
    private stopAnimationLoop(): void {
        if (this.animationFrameId !== null) {
            console.log("Stopping animation loop.");
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // *** MAIN GAME LOOP ***
    private gameLoop(timestamp: number): void {
        if (this.animationFrameId === null) return; // Check if loop should be stopped

        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        
        // --- LOGGING --- 
        // console.log(`%cLOOP: ${GameState[this.gameState]}, Delta: ${deltaTime.toFixed(4)}s`, 'color: gray');
        // ---------------

        // Update game state
        this.update(deltaTime);
        
        // Draw based on state
        this.draw();
        
        // Request next frame
        this.animationFrameId = requestAnimationFrame(this.gameLoop); 
    }

    private update(deltaTime: number): void {
        // Always update background if it exists and we're not in loading
        if (this.backgroundManager && this.gameState !== GameState.Loading) {
            this.backgroundManager.update(deltaTime);
        }
        
        // Don't run game logic if only background loop is active
        if (this.isBackgroundLoopOnly) return; 
        
        // State machine for game logic (only runs if !isBackgroundLoopOnly)
        switch (this.gameState) {
            case GameState.Menu:
            case GameState.Loading:
                // No game logic updates needed
                break;
            case GameState.DisplayWaveStart:
                this.displayTimer -= deltaTime;
                if (this.displayTimer <= 0) {
                    this.startNextWave(); 
                }
                break;
            case GameState.Running:
                this.updateRunning(deltaTime); // Player, enemies, projectiles, collisions
                break;
            case GameState.UpgradingStats:
                // No updates needed, waiting for player input handled by event listener
                break;
            case GameState.GameOver:
            case GameState.GameWon:
                // Game ended, no updates
                break;
        }
    }

    private draw(): void {
        // Clear canvas (important!)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Background if it exists
        if (this.backgroundManager) {
            this.backgroundManager.draw(this.ctx);
        }
        
        // Draw other elements based on state
        switch (this.gameState) {
            case GameState.Menu:
                // Background is drawn above. Menu is HTML overlay, nothing to draw on canvas.
                break;
            case GameState.Loading:
                // Draw loading text ONLY if background isn't ready yet
                if (!this.backgroundManager) { 
                    this.drawLoadingScreen(); 
                }
                break;
            case GameState.Running:
                if (this.player) this.drawRunningGame();
                break;
            case GameState.DisplayWaveStart:
                 if (this.player) this.drawRunningGame(); // Draw game under wave screen
                 this.drawWaveStartScreen();
                break;
            case GameState.UpgradingStats:
                 if (this.player) this.drawRunningGame(); // Draw game under upgrade screen
                 this.drawUpgradeScreen();
                break;
            case GameState.GameOver:
                if (this.player) this.drawRunningGame(); // Draw final game state
                this.drawGameOverScreen();
                break;
            case GameState.GameWon:
                 if (this.player) this.drawRunningGame(); // Draw final game state
                this.drawGameWonScreen();
                break;
        }
        
        // Draw UI overlays if applicable (e.g., score, wave number)
        if (this.gameState === GameState.Running || 
            this.gameState === GameState.DisplayWaveStart || 
            this.gameState === GameState.UpgradingStats || 
            this.gameState === GameState.GameOver || 
            this.gameState === GameState.GameWon) 
        { 
            if (this.player) this.drawUI(); 
        }
    }

    private drawRunningGame(): void {
        // Draw enemies first
        this.enemies.forEach(e => e.draw(this.ctx));

        // Draw projectiles
        this.projectiles.forEach(p => p.draw(this.ctx));

        // Draw items
        this.items.forEach(i => i.draw(this.ctx));
        
        // Draw player last to appear on top
        this.player?.draw(this.ctx);
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
        const stats = this.player?.getStats();
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Current Stats:`, this.canvas.width / 2, 200);
        this.ctx.fillText(`Fire Rate: ${stats?.fireRate.toFixed(1)} shots/sec`, this.canvas.width / 2, 230);
        this.ctx.fillText(`Damage: ${stats?.projectileDamage}`, this.canvas.width / 2, 260);
        this.ctx.fillText(`Max HP: ${stats?.maxHp}`, this.canvas.width / 2, 290);
        
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
            const stats = this.player?.getStats();
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`Fire Rate: ${stats?.fireRate.toFixed(1)}`, this.canvas.width - 20, 30);
            this.ctx.fillText(`Damage: ${stats?.projectileDamage}`, this.canvas.width - 20, 50);
            this.ctx.fillText(`HP: ${this.player?.hp}/${stats?.maxHp}`, this.canvas.width - 20, 70);
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
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // --- Responsive Formatting ---
        const isMobile = this.canvas.width < 600;
        const titleFontSize = isMobile ? 28 : 40;
        const objectiveFontSize = isMobile ? 20 : 28;
        const timerFontSize = isMobile ? 14 : 18;
        const titleY = this.canvas.height / 2 - (isMobile ? 50 : 60);
        const objectiveY = this.canvas.height / 2;
        const timerY = this.canvas.height / 2 + (isMobile ? 40 : 50);
        // ---------------------------

        // Use upcoming wave config for display
        const upcomingWave = levelConfig[this.currentWaveIndex];
        const levelNum = upcomingWave?.levelNumber || '?';
        const waveInLevelNum = upcomingWave?.waveInLevel || '?';
        
        this.ctx.font = `${titleFontSize}px Arial`;
        this.ctx.fillText(`Level ${levelNum} - Wave ${waveInLevelNum}`, this.canvas.width / 2, titleY);

        // Display Objective
        let objectiveText = `Objective: Defeat ${this.totalEnemiesThisWave} enemies`;
        if (upcomingWave?.isBossWave) {
            objectiveText = `Objective: Defeat the TACO BOSS!`;
        }
        this.ctx.font = `${objectiveFontSize}px Arial`;
        this.ctx.fillText(objectiveText, this.canvas.width / 2, objectiveY);

        // Display Timer
        this.ctx.font = `${timerFontSize}px Arial`;
        this.ctx.fillText(`Starting in ${this.displayTimer.toFixed(1)}s...`, this.canvas.width / 2, timerY);
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
        if (!this.player) return;
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
        console.log("Resetting game state for actual play...");
        // Ensure player and background exist before resetting game logic
        if (!this.player || !this.backgroundManager) { 
             console.error("Cannot reset game, player or background not initialized!");
             return;
        }
        this.projectiles = [];
        this.enemies = [];
        this.items = [];
        this.score = 0; 
        this.currentWaveIndex = -1;
        this.currentLevelNumber = 0;
        this.currentWaveInLevel = 0;
        this.enemiesSpawnedThisWave = 0;
        this.totalEnemiesThisWave = 0;
        this.enemySpawnTimer = 0;
        this.currentWave = null;
        this.levelCompleted = false; 
        this.player!.reset(); // Use non-null assertion here

        this.audioManager.stopBackgroundMusic();
        this.audioManager.stopUpgradeMusic();
        
        this.prepareForNextSequence(); // Starts the wave display -> running sequence
        
        // Start full game loop updates
        this.isBackgroundLoopOnly = false; 
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

    // --- Score Update Method --- 
    private updateScore(change: number): void {
        this.score += change;
        console.log(`Score updated: ${this.score} (+${change})`);
        // Optionally update a score display element here if needed during gameplay
    }
    // -------------------------
    
    // --- Send Score to Backend --- 
    private async sendScoreToBackend(): Promise<void> {
        addDebugLog("Preparing to send score to backend...");
        addDebugLog(`User info check - Username: ${this.username}, UserId: ${this.userId}`);
        
        if (!this.username || this.userId === null) {
            addDebugLog("Cannot send score: User info not available. Attempting final fallback...");
            
            // Last attempt to get Telegram data
            const telegramObj = window as any;
            if (telegramObj.Telegram?.WebApp?.initDataUnsafe?.user) {
                this.userId = telegramObj.Telegram.WebApp.initDataUnsafe.user.id;
                this.username = telegramObj.Telegram.WebApp.initDataUnsafe.user.username || 
                              `${telegramObj.Telegram.WebApp.initDataUnsafe.user.first_name || ''} ${telegramObj.Telegram.WebApp.initDataUnsafe.user.last_name || ''}`.trim() ||
                              `player_${this.userId}`;
                addDebugLog(`Last-minute user data retrieved: ${this.username} (${this.userId})`);
            } else {
                // Create a fallback anonymous user if we still don't have data
                this.userId = Math.floor(Math.random() * 1000000) + 100000;
                this.username = `anonymous_${this.userId}`;
                addDebugLog(`Created fallback anonymous user: ${this.username} (${this.userId})`);
            }
        }

        if (this.score <= 0) {
            addDebugLog("Score is 0, not sending to backend.");
            return;
        }

        addDebugLog(`Sending score ${this.score} for user ${this.username} (ID: ${this.userId}) to backend...`);

        try {
            const payload = { 
                username: this.username,
                userId: this.userId,
                score: this.score,
                wave: this.currentWaveIndex + 1 // Add the current wave for tracking
            };
            
            addDebugLog("Full payload: " + JSON.stringify(payload));
            
            const response = await fetch('/api/simple-submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseText = await response.text();
            
            if (!response.ok) {
                addDebugLog(`HTTP error! status: ${response.status}, response: ${responseText}`);
                return;
            }
            
            try {
                const result = JSON.parse(responseText);
                addDebugLog("Score submission successful: " + JSON.stringify(result));
            } catch (e) {
                addDebugLog("Error parsing JSON response: " + e + ", raw: " + responseText);
            }

        } catch (error) {
            addDebugLog("Error sending score to backend: " + error);
        }
    }
    // ---------------------------
    
    // --- NEW Menu Button Handlers ---
    private handlePlayClick(): void {
        addDebugLog("Play button clicked");
        if (!this.assetsLoaded || !this.player || !this.backgroundManager) {
            addDebugLog("Assets not loaded or components not initialized, cannot start game!");
            return;
        }
        
        // Hide HTML Menu
        const mainMenuElement = document.getElementById('mainMenu');
        if (mainMenuElement) {
            mainMenuElement.style.display = 'none';
        }
        
        // Perform user login fetch (moved from menu.js)
        if (this.userId !== null) {
            addDebugLog(`Attempting login fetch for user: ${this.username} (ID: ${this.userId})`);
             fetch('/api/simple-login', { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userId: this.userId, username: this.username }),
                })
                .then(response => response.text())
                .then(data => {
                    try {
                        const jsonData = JSON.parse(data);
                        addDebugLog('Login response: ' + JSON.stringify(jsonData));
                    } catch (e) {
                        addDebugLog('Error parsing login response: ' + e + ', raw: ' + data);
                    }
                })
                .catch(error => addDebugLog('Error logging player: ' + error));
        } else {
            addDebugLog('User ID not available for login fetch.');
        }

        // Reset game state and start the first wave sequence
        this.resetGame(); 
        // The game loop is already running (in background mode),
        // resetGame sets isBackgroundLoopOnly = false, so it will start full updates.
    }
    
    private handleLeaderboardClick(): void {
         console.log("Leaderboard button clicked");
         window.location.href = 'leaderboard.html';
    }
    // -------------------------------

    // *** RESTORED GAME LOGIC METHODS ***
    private updateRunning(deltaTime: number): void {
        if (!this.player) return; 
        this.player.update(deltaTime, this.gameState);

        // Update projectiles
        this.projectiles.forEach(p => p.update(deltaTime, this.canvas.width, this.canvas.height));
        this.projectiles = this.projectiles.filter(p => p.isActive);

        // Update enemies
        this.enemies.forEach(e => e.update(deltaTime, this.canvas.width, this.canvas.height));
        this.enemies = this.enemies.filter(e => e.isActive);

        // Update items
        this.items.forEach(i => i.update(deltaTime, this.canvas.height));
        this.items = this.items.filter(i => i.isActive);

        this.checkCollisions();
        this.spawnEnemy(deltaTime);
        this.checkWaveCompletion();
        
        // Check for game over condition
        if (this.player && !this.player.isAlive()) {
            this.logGameState("Player died");
            this.gameState = GameState.GameOver;
            this.stopAnimationLoop(); // Stop game updates
            this.sendScoreToBackend(); // Send score when game is over
            this.draw(); // Draw the game over screen immediately
            this.startAnimationLoop(true); // Restart loop for background/UI only
            return; // Skip rest of updateRunning
        }
    }
    private checkWaveCompletion(): void {
        if (!this.currentWave || !this.player) return; 

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
                this.audioManager.pauseBackgroundMusic(); 
                this.audioManager.playUpgradeMusic(); 
                this.sendScoreToBackend(); 
            } else {
                console.log(`Wave ${this.currentWave.waveNumber} completed, moving to next wave.`);
                this.prepareForNextSequence();
            }
        }
    }
    private prepareForNextSequence(): void {
        this.logGameState("Before Next Sequence");
        
        if (this.gameState !== GameState.UpgradingStats && this.gameState !== GameState.DisplayWaveStart) {
            this.currentWaveIndex++;
        }
        
        this.levelCompleted = false;

        if (this.currentWaveIndex >= levelConfig.length) {
            console.log("All waves completed! Game Won!");
            this.gameState = GameState.GameWon;
             this.audioManager.stopBackgroundMusic(); 
            this.sendScoreToBackend(); 
            return;
        }

        const nextWaveConfig = levelConfig[this.currentWaveIndex];
        this.currentLevelNumber = nextWaveConfig.levelNumber;
        this.currentWaveInLevel = nextWaveConfig.waveInLevel;
        this.totalEnemiesThisWave = nextWaveConfig.isBossWave
            ? 1
            : nextWaveConfig.enemies.reduce((sum, enemyConf) => sum + enemyConf.count, 0);
        this.enemiesSpawnedThisWave = 0;

        console.log(`Preparing Level ${this.currentLevelNumber} - Wave ${this.currentWaveInLevel} Start Screen... (Enemies: ${this.totalEnemiesThisWave})`);
        this.gameState = GameState.DisplayWaveStart;
        this.displayTimer = this.displayDuration;
        
        this.logGameState("After Next Sequence");
    }
    private checkCollisions(): void {
        if (!this.player) return;

        const player = this.player; // Alias for convenience

        // --- Collision Check Helper (AABB) ---
        const checkAABB = (rect1: {x: number, y: number, width: number, height: number}, 
                           rect2: {x: number, y: number, width: number, height: number}): boolean => {
            // Calculate edges, assuming x/y is center
            const rect1Left = rect1.x - rect1.width / 2;
            const rect1Right = rect1.x + rect1.width / 2;
            const rect1Top = rect1.y - rect1.height / 2;
            const rect1Bottom = rect1.y + rect1.height / 2;

            const rect2Left = rect2.x - rect2.width / 2;
            const rect2Right = rect2.x + rect2.width / 2;
            const rect2Top = rect2.y - rect2.height / 2;
            const rect2Bottom = rect2.y + rect2.height / 2;
            
            // Check for overlap
            return rect1Left < rect2Right && rect1Right > rect2Left &&
                   rect1Top < rect2Bottom && rect1Bottom > rect2Top;
        };
        // -------------------------------------

        // 1. Player Projectile vs. Enemy
        this.projectiles.forEach(proj => {
            if (!proj.isActive || !proj.isPlayerProjectile) return; // Skip inactive or enemy projectiles

            this.enemies.forEach(enemy => {
                if (!enemy.isActive) return; // Skip inactive enemies

                if (checkAABB(proj, enemy)) {
                    console.log(`Collision: Player Projectile (${proj.x.toFixed(0)}, ${proj.y.toFixed(0)}) vs Enemy ${enemy.type} (${enemy.x.toFixed(0)}, ${enemy.y.toFixed(0)})`);
                    enemy.takeDamage(proj.damage); 
                    proj.isActive = false;
                    if (!enemy.isAlive()) {
                         this.updateScore(10); // Score for destroying enemy
                    }
                    // Potentially add a small hit effect/sound here
                }
            });
        });

        // 2. Player vs. Enemy
        this.enemies.forEach(enemy => {
            if (!enemy.isActive) return;

            if (checkAABB(player, enemy)) {
                 console.log(`Collision: Player (${player.x.toFixed(0)}, ${player.y.toFixed(0)}) vs Enemy ${enemy.type} (${enemy.x.toFixed(0)}, ${enemy.y.toFixed(0)})`);
                player.takeDamage(1); // Player takes 1 damage
                enemy.takeDamage(100); // Enemy takes massive damage (usually destroyed)
                 if (!enemy.isAlive()) {
                         this.updateScore(5); // Smaller score for collision kill?
                 }
                 // Potentially add player hit effect/sound here
            }
        });

        // 3. Player vs. Item
        this.items.forEach(item => {
            if (!item.isActive) return;
            
            if (checkAABB(player, item)) {
                 console.log(`Collision: Player (${player.x.toFixed(0)}, ${player.y.toFixed(0)}) vs Item ${item.type} (${item.x.toFixed(0)}, ${item.y.toFixed(0)})`);
                 this.collectItem(item);
                 item.isActive = false;
            }
        });

        // 4. Enemy Projectile vs. Player
        this.projectiles.forEach(proj => {
            if (!proj.isActive || proj.isPlayerProjectile) return; // Skip inactive or player projectiles

            if (checkAABB(proj, player)) {
                 console.log(`Collision: Enemy Projectile (${proj.x.toFixed(0)}, ${proj.y.toFixed(0)}) vs Player (${player.x.toFixed(0)}, ${player.y.toFixed(0)})`);
                player.takeDamage(proj.damage);
                proj.isActive = false;
                 // Potentially add player hit effect/sound here
            }
        });
    }
    private collectItem(item: Item): void {
        if (!this.player) return;
        console.log(`Collected item: ${item.type}`);
        let playSound = true;
        switch (item.type) {
            case ItemType.Health:
                this.player.heal(1); 
                playSound = false; 
                break;
            case ItemType.PizzaChange:
                 const nextPizzaType = this.getRandomPizzaType();
                 this.player.changeShip(nextPizzaType); 
                 playSound = false;
                 break;
            case ItemType.TempFireRate:
                 this.player.activateTempFireRate(10); 
                 playSound = false;
                 break;
            case ItemType.TempDamage:
                 this.player.activateTempDamage(10); 
                 playSound = false;
                 break;
        }
        if (playSound) {
             // this.audioManager.playSound('collect-item'); // Needs a sound file
        }
    }
    private getRandomPizzaType(): PizzaType {
        if (!this.player) return PizzaType.Plain; // Default if player doesn't exist
        const types = [PizzaType.Pepperoni, PizzaType.Hawaiian, PizzaType.Vegetarian, PizzaType.Meatlovers];
         const currentType = this.player.shipType;
         const availableTypes = types.filter(t => t !== currentType);
         if (availableTypes.length > 0) {
            return availableTypes[Math.floor(Math.random() * availableTypes.length)];
         } else {
             return types[Math.floor(Math.random() * types.length)];
         }
    }
    private spawnEnemy(deltaTime: number): void {
        if (!this.currentWave || this.currentWave.isBossWave || this.enemiesSpawnedThisWave >= this.totalEnemiesThisWave) {
            return; // Don't spawn in boss waves or if wave count is met
        }

        this.enemySpawnTimer -= deltaTime;

        if (this.enemySpawnTimer <= 0) {
            // --- Determine which enemy type to spawn based on wave config --- 
            let enemyToSpawn: EnemyType | null = null;
            let cumulativeCount = 0;
            for (const enemyConf of this.currentWave.enemies) {
                cumulativeCount += enemyConf.count;
                if (this.enemiesSpawnedThisWave < cumulativeCount) {
                    enemyToSpawn = enemyConf.type;
                    break;
                }
            }

            if (!enemyToSpawn) {
                 console.warn("Could not determine enemy type to spawn, check wave config.");
                 this.enemySpawnTimer = this.currentWave.spawnInterval; // Reset timer anyway
                 return;
            }
            
            // --- Spawn the determined enemy --- 
            const spawnX = Math.random() * (this.canvas.width - 50) + 25; // Random X, avoid edges
            const spawnY = -50; // Start above screen
            let newEnemy: Enemy | null = null;
            
            // Ensure player exists for targeting
            if (!this.player) {
                 console.error("Cannot spawn enemy, player reference is null.");
                 this.enemySpawnTimer = this.currentWave.spawnInterval; // Reset timer
                 return;
            }

            switch (enemyToSpawn) {
                case EnemyType.HotDog:
                    newEnemy = new HotDogEnemy(spawnX, spawnY, this.assetManager, this.spawnItem.bind(this), this.audioManager);
                    break;
                case EnemyType.FrenchFries:
                    newEnemy = new FrenchFriesEnemy(spawnX, spawnY, this.assetManager, this.spawnItem.bind(this), this.audioManager);
                    break;
                case EnemyType.Donut:
                    newEnemy = new DonutEnemy(spawnX, spawnY, this.assetManager, this.spawnItem.bind(this), this.audioManager);
                    break;
                 case EnemyType.Hamburger: // Added Hamburger case
                    newEnemy = new HamburgerEnemy(spawnX, spawnY, this.assetManager, this.spawnItem.bind(this), this.audioManager);
                    break;
                // Add Taco case - it has a different constructor
                case EnemyType.Taco: 
                    // This case shouldn't be reached via spawnEnemy, but handle defensively
                    console.warn("Attempted to spawn Taco boss via regular spawnEnemy. Use spawnBoss.");
                    break; 
                default:
                    console.error(`Unhandled enemy type in spawnEnemy: ${enemyToSpawn}`);
                // Add cases for other enemy types here...
            }

            if (newEnemy) {
                this.enemies.push(newEnemy);
                this.enemiesSpawnedThisWave++;
                 console.log(`Spawned enemy ${enemyToSpawn} (${this.enemiesSpawnedThisWave}/${this.totalEnemiesThisWave})`);
            }
            
            // Reset timer for the next spawn
            this.enemySpawnTimer = this.currentWave.spawnInterval;
        }
    }
    private spawnBoss(bossType: EnemyType): void {
        if (!this.player) return;
        // ... (rest of spawnBoss logic using this.currentLevelNumber, etc.)
    }
    private startNextWave(): void {
        this.logGameState("Before Starting Wave");
        if (this.currentWaveIndex >= levelConfig.length) {
            console.error("startNextWave called after last wave.");
            this.gameState = GameState.GameWon;
            return;
        }
        this.currentWave = levelConfig[this.currentWaveIndex];
        this.enemies = [];
        this.totalEnemiesThisWave = this.currentWave.isBossWave
            ? 1
            : this.currentWave.enemies.reduce((sum, enemyConf) => sum + enemyConf.count, 0);
        this.enemiesSpawnedThisWave = 0;
        this.enemySpawnTimer = 0;
        this.gameState = GameState.Running;
        
        const isNewLevelStart = this.currentWave.waveInLevel === 1;
        this.audioManager.playBackgroundMusic(isNewLevelStart); 

        console.log(`Starting Level ${this.currentWave.levelNumber} - Wave ${this.currentWave.waveInLevel}`);
        if (!this.currentWave.isBossWave) {
             console.log(`Enemies to spawn: ${this.totalEnemiesThisWave}, Interval: ${this.currentWave.spawnInterval}s`);
        }
        if (this.currentWave.isBossWave && this.currentWave.bossType) {
            this.spawnBoss(this.currentWave.bossType);
        } else if (this.totalEnemiesThisWave === 0 && !this.currentWave.isBossWave) {
             console.warn(`Level ${this.currentWave.levelNumber} Wave ${this.currentWave.waveInLevel} has no enemies. Prep next.`);
             this.prepareForNextSequence(); 
        }
        this.logGameState("After Starting Wave");
    }
    // *** END RESTORED METHODS ***
}

// --- Global Setup --- 
let currentGame: Game | null = null;

window.addEventListener('DOMContentLoaded', () => {
    if ((window as any).__GAME_INITIALIZED__) {
        console.warn("Game already initialized. Skipping duplicate initialization.");
        return;
    }
    (window as any).__GAME_INITIALIZED__ = true;
    console.log("%cDOM Content Loaded - Creating Game Instance...", 'color: green; font-weight: bold;');
    
    // Create instance (constructor sets up canvas, managers, listeners)
    currentGame = new Game();
    (window as any).currentGame = currentGame; 

    // Start loading assets and initializing background/player
    // This will automatically start the background animation loop once done.
    console.log("Initiating initial asset load...");
    currentGame.startInitialLoad().catch(err => {
         console.error("Error during initial load:", err);
         // Handle critical loading failure - maybe display error on canvas
    });
});