import { kv } from '@vercel/kv';

// Define the keys for our KV data (same as other endpoints)
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username
const GAMES_PLAYED_KEY = 'leaderboard:games_played'; // Hash: userId -> games_played
const HIGHEST_WAVE_KEY = 'leaderboard:highest_wave'; // Hash: userId -> highest_wave
const LAST_PLAYED_KEY = 'leaderboard:last_played'; // Hash: userId -> timestamp

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { userId } = request.query;

    if (!userId) {
      return response.status(400).json({ message: 'Missing userId parameter' });
    }

    // Get all player stats in parallel
    const [score, username, gamesPlayed, highestWave, lastPlayed, rank] = await Promise.all([
      kv.zscore(LEADERBOARD_KEY, userId),
      kv.hget(USERNAMES_KEY, userId),
      kv.hget(GAMES_PLAYED_KEY, userId),
      kv.hget(HIGHEST_WAVE_KEY, userId),
      kv.hget(LAST_PLAYED_KEY, userId),
      kv.zrevrank(LEADERBOARD_KEY, userId) // Get player's rank (0-based)
    ]);

    // If player not found in the leaderboard
    if (score === null && username === null) {
      return response.status(404).json({ message: 'Player not found' });
    }

    // Calculate player statistics
    const playerStats = {
      userId,
      username: username || `Player ${userId.slice(0, 5)}`,
      score: score ? parseInt(score) : 0,
      rank: rank !== null ? rank + 1 : null, // Convert to 1-based rank
      gamesPlayed: gamesPlayed ? parseInt(gamesPlayed) : 0,
      highestWave: highestWave ? parseInt(highestWave) : 0,
      lastPlayed: lastPlayed ? new Date(parseInt(lastPlayed)).toISOString() : null,
      averageScore: gamesPlayed && parseInt(gamesPlayed) > 0 ? 
        (score ? parseInt(score) / parseInt(gamesPlayed) : 0).toFixed(1) : 0
    };

    return response.status(200).json(playerStats);

  } catch (error) {
    console.error('Error fetching player stats:', error);
    return response.status(500).json({ message: 'Internal Server Error fetching player stats' });
  }
} 