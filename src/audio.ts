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

    playSound(name: string): void { // Removed loop parameter, SFX shouldn't loop typically
        if (this.isMuted) return;

        const sound = this.sounds.get(name);
        if (sound) {
            sound.volume = this.sfxVolume; // Ensure volume is current
            sound.currentTime = 0; // Rewind before playing
            sound.play().catch(e => console.error(`Error playing sound ${name}:`, e));
            // console.log(`Playing sound '${name}'`);
        } else {
            console.warn(`Sound '${name}' not found or not loaded.`);
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

    playBackgroundMusic(): void {
        if (this.isMuted || this.musicTracks.length === 0) return;
        
        // If music is currently loaded, paused, and was intentionally paused, just resume it
        if (this.musicElement && this.musicElement.paused && this.isMusicPaused) {
            console.log("Resuming paused background music.");
             this.isMusicPaused = false;
             this.musicElement.play().catch(e => console.error("Error resuming music:", e));
             return; // Don't start a new track
        }
        
        // Otherwise, start the playlist (shuffles and plays next)
        console.log("Starting background music playlist...");
        this.isMusicPaused = false;
        this.shuffleTracks();
        this.currentTrackIndex = -1;
        this.playNextTrack();
    }
    
    private playNextTrack(): void {
        if (this.isMusicPaused || this.musicTracks.length === 0) {
             console.log("Music paused or no tracks loaded, not playing next.");
             return;
        }
        
        this.currentTrackIndex++;
        if (this.currentTrackIndex >= this.musicTracks.length) {
            this.shuffleTracks(); // Reshuffle when playlist ends
            this.currentTrackIndex = 0;
        }
        
        if (this.musicElement && this.musicTracks[this.currentTrackIndex]) {
             const nextTrackSrc = this.musicTracks[this.currentTrackIndex];
            console.log(`Playing music track ${this.currentTrackIndex}: ${nextTrackSrc}`);
            this.musicElement.src = nextTrackSrc;
            this.musicElement.volume = this.musicVolume; // Ensure volume is current
            this.musicElement.play().catch(e => {
                console.error(`Error playing music track ${nextTrackSrc}:`, e);
                 // Try next track after a delay if play fails
                 setTimeout(() => this.playNextTrack(), 1000);
            });
        } else {
            console.warn("Music element not available or track index out of bounds.");
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
        
        // Resume if paused
        if (this.upgradeMusicElement && this.upgradeMusicElement.paused && this.isUpgradeMusicPaused) {
            console.log("Resuming paused upgrade music.");
             this.isUpgradeMusicPaused = false;
             this.upgradeMusicElement.play().catch(e => console.error("Error resuming upgrade music:", e));
             return;
        }
        
        console.log("Starting upgrade music playlist...");
        this.isUpgradeMusicPaused = false;
        this.shuffleUpgradeTracks();
        this.currentUpgradeTrackIndex = -1;
        this.playNextUpgradeTrack();
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