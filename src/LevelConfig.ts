import { EnemyType } from './enemy';

// Defines the enemies and their count for a single wave
export interface WaveEnemyConfig {
    type: EnemyType;
    count: number;
}

// Defines the structure of a single wave
export interface WaveConfig {
    waveNumber: number; // Overall sequential wave number (for scaling/internal use)
    levelNumber: number; // The level this wave belongs to
    waveInLevel: number; // The wave number within the current level (1, 2, or 3 for boss)
    enemies: WaveEnemyConfig[];
    spawnInterval: number; // Time in seconds between spawns within this wave
    isBossWave?: boolean; // Optional flag for boss waves
    bossType?: EnemyType; // Optional: specify the boss type for this wave
}

// --- Level Generation Logic ---

const MAX_LEVELS = 10; // Controls how many sets of waves (levels) to generate
const WAVES_PER_REGULAR_LEVEL = 2;
export const BOSS_LEVEL_INTERVAL = 5; // Export this constant

function generateLevelConfig(): WaveConfig[] {
    const config: WaveConfig[] = [];
    let waveCounter = 1; // Global wave number across all levels (used for scaling)
    const enemyProgression = [EnemyType.HotDog, EnemyType.FrenchFries, EnemyType.Donut, EnemyType.Hamburger];

    for (let level = 1; level <= MAX_LEVELS; level++) {
        const isBossLevel = level % BOSS_LEVEL_INTERVAL === 0;
        const wavesInThisLevel = isBossLevel ? WAVES_PER_REGULAR_LEVEL + 1 : WAVES_PER_REGULAR_LEVEL;

        for (let waveInLevel = 1; waveInLevel <= wavesInThisLevel; waveInLevel++) {
            const isBossWaveOfLevel = isBossLevel && waveInLevel === wavesInThisLevel;

            if (isBossWaveOfLevel) {
                // --- Boss Wave ---
                config.push({
                    waveNumber: waveCounter,
                    levelNumber: level,
                    waveInLevel: waveInLevel,
                    enemies: [], // Bosses are spawned specially
                    spawnInterval: 0, // Not used for boss wave
                    isBossWave: true,
                    bossType: EnemyType.Taco,
                });
            } else {
                // --- Regular Wave ---
                const enemiesForWave: WaveEnemyConfig[] = [];
                const typesAvailable = enemyProgression.slice(0, Math.min(enemyProgression.length, Math.floor(waveCounter / 2) + 1));
                const baseCountPerType = 2;
                const scalingFactor = Math.floor(waveCounter / 3);
                const totalEnemies = (baseCountPerType + scalingFactor) * typesAvailable.length + waveInLevel;
                let enemiesRemaining = totalEnemies;
                for (let i = 0; i < typesAvailable.length; i++) {
                    const type = typesAvailable[i];
                    const count = (i === typesAvailable.length - 1)
                                ? Math.max(1, enemiesRemaining)
                                : Math.max(1, Math.floor(totalEnemies / typesAvailable.length) + (i > 0 ? 1: 0));
                    const actualCount = Math.min(count, enemiesRemaining);
                     if (actualCount > 0) {
                        enemiesForWave.push({ type, count: actualCount });
                        enemiesRemaining -= actualCount;
                    }
                    if (enemiesRemaining <= 0) break;
                }
                if (enemiesRemaining > 0 && enemiesForWave.length > 0) {
                     enemiesForWave[0].count += enemiesRemaining;
                } else if (enemiesRemaining > 0) {
                     enemiesForWave.push({ type: EnemyType.HotDog, count: enemiesRemaining });
                }
                const spawnInterval = Math.max(0.5, 2.0 - waveCounter * 0.05);

                config.push({
                    waveNumber: waveCounter, // Keep overall counter for scaling
                    levelNumber: level,
                    waveInLevel: waveInLevel,
                    enemies: enemiesForWave,
                    spawnInterval: spawnInterval,
                    isBossWave: false,
                });
            }
            waveCounter++; // Increment overall counter regardless of level/wave structure
        }
    }
    return config;
}


// Export the generated configuration
export const levelConfig: WaveConfig[] = generateLevelConfig(); 