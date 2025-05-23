import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Define the keys for our KV data (same as other endpoints)
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username
const GAMES_PLAYED_KEY = 'leaderboard:games_played'; // Hash: userId -> games_played
const HIGHEST_WAVE_KEY = 'leaderboard:highest_wave'; // Hash: userId -> highest_wave
const LAST_PLAYED_KEY = 'leaderboard:last_played'; // Hash: userId -> timestamp

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { message: 'Missing userId parameter' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { message: 'Player not found' },
        { status: 404 }
      );
    }

    // Format and return player stats
    return NextResponse.json({
      userId,
      username: username || `unknown_${userId}`,
      score: score !== null ? parseInt(score) : 0,
      rank: rank !== null ? rank + 1 : null, // Convert 0-based rank to 1-based
      gamesPlayed: gamesPlayed ? parseInt(gamesPlayed) : 0,
      highestWave: highestWave ? parseInt(highestWave) : 0,
      lastPlayed: lastPlayed ? parseInt(lastPlayed) : null
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json(
      { message: 'Internal Server Error fetching player stats' },
      { status: 500 }
    );
  }
} 