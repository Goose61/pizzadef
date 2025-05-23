import { kv } from '@vercel/kv';

// Define the keys for our KV data
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username
const GAMES_PLAYED_KEY = 'leaderboard:games_played'; // Hash: userId -> games_played
const HIGHEST_WAVE_KEY = 'leaderboard:highest_wave'; // Hash: userId -> highest_wave
const LAST_PLAYED_KEY = 'leaderboard:last_played'; // Hash: userId -> timestamp

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { userId, username, score, wave = 0 } = request.body;

    // Basic validation
    if (userId === undefined || userId === null || !username || typeof score !== 'number') {
      return response.status(400).json({ message: 'Missing or invalid parameters (userId, username, score)' });
    }
    
    // Ensure score is an integer
    const integerScore = Math.floor(score);
    if (integerScore <= 0) {
        return response.status(200).json({ message: 'Score is zero or negative, not recorded.' });
    }

    // Ensure wave is an integer
    const integerWave = Math.floor(wave);

    // Get the current timestamp
    const timestamp = Date.now();

    // Multi-stage process using a pipeline for atomic updates
    const pipeline = kv.pipeline();

    // Check existing score using ZSCORE
    const currentHighScore = await kv.zscore(LEADERBOARD_KEY, userId.toString());
    
    // Always increment games played counter
    const currentGamesPlayed = await kv.hget(GAMES_PLAYED_KEY, userId.toString()) || 0;
    const newGamesPlayed = parseInt(currentGamesPlayed) + 1;
    pipeline.hset(GAMES_PLAYED_KEY, { [userId.toString()]: newGamesPlayed });
    
    // Always update the last played timestamp
    pipeline.hset(LAST_PLAYED_KEY, { [userId.toString()]: timestamp });

    // Update highest wave if current wave is higher
    const currentHighestWave = await kv.hget(HIGHEST_WAVE_KEY, userId.toString()) || 0;
    if (integerWave > parseInt(currentHighestWave)) {
      pipeline.hset(HIGHEST_WAVE_KEY, { [userId.toString()]: integerWave });
    }

    // Update score if it's a new high score
    let isNewHighScore = false;
    if (currentHighScore === null || integerScore > Number(currentHighScore)) {
      // Add/Update the score in the sorted set
      pipeline.zadd(LEADERBOARD_KEY, { score: integerScore, member: userId.toString() });
      
      // Always update the username in case it changed
      pipeline.hset(USERNAMES_KEY, { [userId.toString()]: username });
      
      isNewHighScore = true;
    }

    // Execute all commands in pipeline
    await pipeline.exec();
    
    console.log(`Game recorded for ${username} (ID: ${userId}): Score=${integerScore}, Wave=${integerWave}, Games=${newGamesPlayed}`);
    
    return response.status(200).json({ 
      message: isNewHighScore ? 'High score updated successfully!' : 'Game recorded but not a new high score.',
      newHighScore: isNewHighScore ? integerScore : null,
      currentHighScore: isNewHighScore ? integerScore : Number(currentHighScore),
      gamesPlayed: newGamesPlayed,
      highestWave: Math.max(integerWave, parseInt(currentHighestWave) || 0),
    });

  } catch (error) {
    console.error('Error processing score submission:', error);
    return response.status(500).json({ message: 'Internal Server Error processing score' });
  }
} 