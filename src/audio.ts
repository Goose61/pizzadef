// Placeholder for AudioManager class
export class AudioManager {
    private sounds: Map<string, HTMLAudioElement> = new Map();
    
    // Main background music
    private musicTracks: string[] = [];
    private currentTrackIndex: number = -1;
    private musicElement: HTMLAudioElement | null = null;
    private isMusicPaused: boolean = false;
    
    // Upgrade menu music
    private upgradeMusicTracks: string[] = [];
    private currentUpgradeTrackIndex: number = -1;
    private upgradeMusicElement: HTMLAudioElement | null = null;
    private isUpgradeMusicPaused: boolean = false; // Separate pause state
    
    // General settings
    private isMuted: boolean = false;
    private musicVolume: number = 0.5; // Shared volume for both music types for now
    private sfxVolume: number = 0.8;

    constructor() {
        // Initialize the main music element
        this.musicElement = new Audio();
        this.musicElement.volume = this.musicVolume;
        this.musicElement.loop = false;
        this.musicElement.addEventListener('ended', () => {
            console.log(`Music track ${this.currentTrackIndex} ended.`);
            this.playNextTrack();
        });
        
        // Handle potential errors
        this.musicElement.addEventListener('error', (e) => {
            console.error("Error with music element:", e);
            // Maybe try playing next track after a short delay?
            setTimeout(() => this.playNextTrack(), 1000);
        });
        
        // Initialize the upgrade music element
        this.upgradeMusicElement = new Audio();
        this.upgradeMusicElement.volume = this.musicVolume;
        this.upgradeMusicElement.loop = false;
        this.upgradeMusicElement.addEventListener('ended', () => {
            console.log(`Upgrade music track ${this.currentUpgradeTrackIndex} ended.`);
            this.playNextUpgradeTrack(); // Play next random upgrade track
        });
        this.upgradeMusicElement.addEventListener('error', (e) => {
            console.error("Error with upgrade music element:", e);
            // Try again after delay?
            setTimeout(() => this.playNextUpgradeTrack(), 1000);
        });
    }

    loadSound(name: string, src: string): void {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = this.sfxVolume;
        this.sounds.set(name, audio);
        console.log(`Loaded sound '${name}' from '${src}'`);
    }
    
    // Method to load music tracks (just stores the path)
    loadMusicTrack(src: string): void {
        this.musicTracks.push(src);
        console.log(`Queued music track: ${src}`);
    }

    // Method to load upgrade music tracks
    loadUpgradeMusicTrack(src: string): void {
        this.upgradeMusicTracks.push(src);
        console.log(`Queued upgrade music track: ${src}`);
    }

    playSound(name: string): void {
        if (this.isMuted) return;

        const originalSound = this.sounds.get(name);
        if (originalSound && originalSound.src) {
            // --- Add specific logging for 'fire' sound ---
            if (name === 'fire') {
                const timestamp = performance.now(); // High-resolution timestamp
                console.log(`FIRE sound triggered at: ${timestamp.toFixed(2)}ms`);
            }
            // --------------------------------------------
            
            // Create a new Audio object each time for reliable playback of rapid SFX
            const soundInstance = new Audio(originalSound.src);
            soundInstance.volume = this.sfxVolume; // Use current SFX volume
            
            // Optional: Add an event listener to remove the element after it finishes playing
            // This helps with cleanup, though garbage collection might handle it eventually.
            soundInstance.addEventListener('ended', () => {
                // Maybe do something here? Or just let it be GC'd.
                // We don't have a reference to remove it from a specific list.
            });
            
            soundInstance.play().catch(e => console.error(`Error playing sound instance ${name}:`, e));
            // No need to rewind (currentTime = 0) as it's a fresh instance
            // console.log(`Playing new instance of sound '${name}'`);
        } else {
            console.warn(`Sound '${name}' not found, not loaded, or has no src.`);
        }
    }

    stopSound(name: string): void {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
            // console.log(`Stopped sound '${name}'`);
        }
    }
    
    // --- Background Music Controls ---

    // Modified to handle starting new level music vs resuming/continuing
    playBackgroundMusic(isNewLevel: boolean = false): void {
        if (this.isMuted || this.musicTracks.length === 0) return;
        
        // If music is currently loaded, paused, and was intentionally paused, just resume it
        if (this.musicElement && this.musicElement.paused && this.isMusicPaused) {
            console.log("Resuming paused background music.");
             this.isMusicPaused = false;
             // Check readyState before playing to potentially avoid errors
             if (this.musicElement.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
                this.musicElement.play().catch(e => console.error("Error resuming music:", e));
             } else {
                 console.warn("Music not ready to resume, will try again on 'canplaythrough'.");
                 // Add a listener to play when ready, remove it after playing
                 const playWhenReady = () => {
                    if (!this.isMusicPaused) { // Check again in case it got paused/stopped
                        this.musicElement?.play().catch(e => console.error("Error resuming music from canplaythrough:", e));
                    }
                    this.musicElement?.removeEventListener('canplaythrough', playWhenReady);
                 };
                 this.musicElement.addEventListener('canplaythrough', playWhenReady);
             }
             return; // Don't start a new track
        }
        
        // If it's a new level, shuffle and start from the first track
        if (isNewLevel) {
            console.log("Starting music for new level...");
            this.isMusicPaused = false;
            this.shuffleTracks();
            this.currentTrackIndex = -1; // Will be incremented to 0 in playNextTrack
            this.playNextTrack();
        } 
        // Otherwise (e.g., starting next wave in the same level), continue playing the CURRENT track if one is loaded
        else if (this.musicElement && this.musicElement.src && !this.isMusicPaused) {
             // If it's not playing, try to play the current track
             if (this.musicElement.paused) {
                 console.log(`Continuing current background track: ${this.musicElement.src}`);
                 if (this.musicElement.readyState >= 3) {
                    this.musicElement.play().catch(e => console.error(`Error playing current track ${this.musicElement?.src}:`, e));
                 } else {
                     console.warn("Music not ready to play, will try again on 'canplaythrough'.");
                     const playWhenReady = () => {
                         if (!this.isMusicPaused) {
                            this.musicElement?.play().catch(e => console.error("Error playing current track from canplaythrough:", e));
                         }
                        this.musicElement?.removeEventListener('canplaythrough', playWhenReady);
                     };
                     this.musicElement.addEventListener('canplaythrough', playWhenReady);
                 }
             }
        } 
        // If no track is loaded/playing and it's not a new level (e.g., game start before first level), start the playlist
        else if (!this.musicElement?.src) {
            console.log("Starting background music playlist for the first time...");
            this.isMusicPaused = false;
            this.shuffleTracks();
            this.currentTrackIndex = -1;
            this.playNextTrack();
        }
    }
    
    private playNextTrack(): void {
        if (this.isMusicPaused || this.musicTracks.length === 0) {
             console.log("Music paused or no tracks loaded, not playing next.");
             return;
        }
        
        // --- Explicitly stop before loading next ---
        if (this.musicElement && !this.musicElement.paused) {
            this.musicElement.pause();
            this.musicElement.currentTime = 0; // Reset position
            console.log("Stopping previous track before playing next.");
        }
        // ----------------------------------------
        
        this.currentTrackIndex++;
        // If we went past the end, reshuffle and wrap around
        if (this.currentTrackIndex >= this.musicTracks.length) {
            console.log("Reached end of playlist, reshuffling...");
            this.shuffleTracks(); 
            this.currentTrackIndex = 0;
        }
        
        if (this.currentTrackIndex < 0) { // Handle case where it was -1 initially
            this.currentTrackIndex = 0;
        }

        if (this.musicElement && this.musicTracks[this.currentTrackIndex]) {
             const nextTrackSrc = this.musicTracks[this.currentTrackIndex];
            console.log(`Playing music track ${this.currentTrackIndex}: ${nextTrackSrc}`);
            // Only change src if it's different to avoid interrupting playback unnecessarily
            // or causing issues if the same track needs to loop conceptually after reshuffle
            // --- Move src assignment after potential stop ---
            // if (this.musicElement.src !== nextTrackSrc) { 
            //     this.musicElement.src = nextTrackSrc;
            //     this.musicElement.volume = this.musicVolume; // Ensure volume is current
            // }
            this.musicElement.src = nextTrackSrc;
            this.musicElement.volume = this.musicVolume;
            // ----------------------------------------------
            
            // Attempt to play, handle potential errors and readiness
            const playPromise = this.musicElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Autoplay prevention is common, often requires user interaction first.
                    // We might already have interaction, but it's good to log.
                    console.error(`Error playing music track ${nextTrackSrc}:`, error);
                    // Attempting to play next track might lead to loops if all fail.
                    // Consider a flag to prevent rapid retries or notify user.
                    // For now, just log and rely on 'ended' event or manual calls.
                    // setTimeout(() => this.playNextTrack(), 5000); // Maybe retry after longer delay?
                });
            }
        } else {
            console.warn("Music element not available or track index out of bounds/invalid.");
            // Attempt to recover if possible
             if (this.musicTracks.length > 0) {
                 console.log("Attempting to recover music playback.");
                 this.currentTrackIndex = -1; // Reset and try again
                 setTimeout(() => this.playNextTrack(), 1000); 
             }
        }
    }
    
    private shuffleTracks(): void {
        console.log("Shuffling music playlist...");
        // Fisher-Yates shuffle algorithm
        for (let i = this.musicTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.musicTracks[i], this.musicTracks[j]] = [this.musicTracks[j], this.musicTracks[i]];
        }
    }

    pauseBackgroundMusic(): void {
        if (this.musicElement && !this.musicElement.paused) {
            this.musicElement.pause();
            this.isMusicPaused = true;
            console.log("Background music paused.");
        }
    }

    resumeBackgroundMusic(): void {
        if (this.isMuted) return;
        if (this.musicElement && this.musicElement.paused && this.isMusicPaused) {
             this.isMusicPaused = false;
             this.musicElement.play().catch(e => console.error("Error resuming music:", e));
             console.log("Background music resumed.");
        } else if (this.isMusicPaused) {
            // If it was paused logically but not playing (e.g., finished track), start next
             this.isMusicPaused = false;
             this.playNextTrack(); 
        }
    }

    stopBackgroundMusic(): void {
        if (this.musicElement) {
            this.musicElement.pause();
            this.musicElement.currentTime = 0;
             this.isMusicPaused = true; // Treat stopped as paused logically
            this.currentTrackIndex = -1; // Reset index
            console.log("Background music stopped.");
        }
    }
    
    // --- Upgrade Menu Music Controls ---
    
    playUpgradeMusic(): void {
        if (this.isMuted || this.upgradeMusicTracks.length === 0) return;
        
        // Stop any currently playing upgrade track before starting a new one
        if (this.upgradeMusicElement && !this.upgradeMusicElement.paused) {
             this.upgradeMusicElement.pause();
             this.upgradeMusicElement.currentTime = 0;
        }
        
        console.log("Starting a random upgrade music track...");
        this.isUpgradeMusicPaused = false;
        
        // Shuffle the tracks to ensure variety over time and handle playlist end
        this.shuffleUpgradeTracks();
        
        // --- FIX: Directly choose and play a random track from the shuffled list ---
        // Instead of resetting to -1 and playing index 0 via playNextUpgradeTrack,
        // pick a random index directly.
        this.currentUpgradeTrackIndex = Math.floor(Math.random() * this.upgradeMusicTracks.length);
        
        if (this.upgradeMusicElement && this.upgradeMusicTracks[this.currentUpgradeTrackIndex]) {
            const trackToPlaySrc = this.upgradeMusicTracks[this.currentUpgradeTrackIndex];
            console.log(`Playing randomly selected upgrade music track ${this.currentUpgradeTrackIndex}: ${trackToPlaySrc}`);
            this.upgradeMusicElement.src = trackToPlaySrc;
            this.upgradeMusicElement.volume = this.musicVolume;
            this.upgradeMusicElement.play().catch(e => {
                console.error(`Error playing upgrade music track ${trackToPlaySrc}:`, e);
                // Maybe try the *next* track in the shuffled list on error?
                setTimeout(() => this.playNextUpgradeTrack(), 1000); 
            });
        } else {
            console.warn("Upgrade music element not available or randomly selected track index invalid.");
            // Attempt to recover if tracks exist
            if (this.upgradeMusicTracks.length > 0) {
                this.playNextUpgradeTrack(); // Fallback to playing the next (index 0 after shuffle)
            }
        }
    }
    
    private playNextUpgradeTrack(): void {
        if (this.isUpgradeMusicPaused || this.upgradeMusicTracks.length === 0) return;
        
        this.currentUpgradeTrackIndex++;
        if (this.currentUpgradeTrackIndex >= this.upgradeMusicTracks.length) {
            this.shuffleUpgradeTracks();
            this.currentUpgradeTrackIndex = 0;
        }
        
        if (this.upgradeMusicElement && this.upgradeMusicTracks[this.currentUpgradeTrackIndex]) {
             const nextTrackSrc = this.upgradeMusicTracks[this.currentUpgradeTrackIndex];
            console.log(`Playing upgrade music track ${this.currentUpgradeTrackIndex}: ${nextTrackSrc}`);
            this.upgradeMusicElement.src = nextTrackSrc;
            this.upgradeMusicElement.volume = this.musicVolume;
            this.upgradeMusicElement.play().catch(e => {
                console.error(`Error playing upgrade music track ${nextTrackSrc}:`, e);
                 setTimeout(() => this.playNextUpgradeTrack(), 1000);
            });
        } else {
             console.warn("Upgrade music element not available or track index out of bounds.");
        }
    }
    
    private shuffleUpgradeTracks(): void {
        console.log("Shuffling upgrade music playlist...");
        for (let i = this.upgradeMusicTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.upgradeMusicTracks[i], this.upgradeMusicTracks[j]] = [this.upgradeMusicTracks[j], this.upgradeMusicTracks[i]];
        }
    }
    
    pauseUpgradeMusic(): void {
        if (this.upgradeMusicElement && !this.upgradeMusicElement.paused) {
            this.upgradeMusicElement.pause();
            this.isUpgradeMusicPaused = true;
            console.log("Upgrade music paused.");
        }
    }

    // Resume not strictly needed if we always call playUpgradeMusic, but good to have
    resumeUpgradeMusic(): void {
        if (this.isMuted) return;
        if (this.upgradeMusicElement && this.upgradeMusicElement.paused && this.isUpgradeMusicPaused) {
             this.isUpgradeMusicPaused = false;
             this.upgradeMusicElement.play().catch(e => console.error("Error resuming upgrade music:", e));
             console.log("Upgrade music resumed.");
        } else if (this.isUpgradeMusicPaused) {
             this.isUpgradeMusicPaused = false;
             this.playNextUpgradeTrack(); 
        }
    }
    
    stopUpgradeMusic(): void {
        if (this.upgradeMusicElement) {
            this.upgradeMusicElement.pause();
            this.upgradeMusicElement.currentTime = 0;
             this.isUpgradeMusicPaused = true; 
            this.currentUpgradeTrackIndex = -1;
            console.log("Upgrade music stopped.");
        }
    }

    // --- Volume and Mute Controls ---
    
     setMusicVolume(volume: number): void {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.musicElement) {
            this.musicElement.volume = this.musicVolume;
        }
        if (this.upgradeMusicElement) { // Also set upgrade music volume
            this.upgradeMusicElement.volume = this.musicVolume;
        }
        console.log(`Music volume set to ${this.musicVolume.toFixed(2)}`);
    }

    setSfxVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
         // Update existing loaded sounds
        this.sounds.forEach(sound => {
            sound.volume = this.sfxVolume;
        });
        console.log(`SFX volume set to ${this.sfxVolume.toFixed(2)}`);
    }

    toggleMute(): void {
        this.isMuted = !this.isMuted;
        console.log(`Audio ${this.isMuted ? 'muted' : 'unmuted'}`);
        if (this.isMuted) {
            // Pause main music
            if (this.musicElement && !this.musicElement.paused) {
                 this.musicElement.pause();
            }
             // Pause upgrade music
            if (this.upgradeMusicElement && !this.upgradeMusicElement.paused) {
                 this.upgradeMusicElement.pause();
            }
            // Stop SFX
            this.sounds.forEach(sound => { 
                sound.pause();
                sound.currentTime = 0;
            });
        } else {
             // Resume main music if it should be playing
            if (this.musicElement && this.musicElement.paused && !this.isMusicPaused) {
                 this.musicElement.play().catch(e => console.error("Error resuming music after unmute:", e));
            }
             // Resume upgrade music if it should be playing
             if (this.upgradeMusicElement && this.upgradeMusicElement.paused && !this.isUpgradeMusicPaused) {
                 this.upgradeMusicElement.play().catch(e => console.error("Error resuming upgrade music after unmute:", e));
            }
        }
    }
} 