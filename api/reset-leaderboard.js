import { kv } from '@vercel/kv';

// Define the keys for our KV data
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username
const GAMES_PLAYED_KEY = 'leaderboard:games_played'; // Hash: userId -> games_played
const HIGHEST_WAVE_KEY = 'leaderboard:highest_wave'; // Hash: userId -> highest_wave
const LAST_PLAYED_KEY = 'leaderboard:last_played'; // Hash: userId -> timestamp

// This is a special admin key that should be set in environment variables
// A simple protection mechanism for admin-only endpoints
const ADMIN_KEY = process.env.ADMIN_KEY || 'default_admin_key_please_change';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { adminKey, confirmation } = request.body;

    // Check admin key for authorization
    if (adminKey !== ADMIN_KEY) {
      return response.status(401).json({ message: 'Unauthorized: Invalid admin key' });
    }

    // Double-check with a confirmation phrase
    if (confirmation !== 'RESET_ALL_PLAYER_DATA') {
      return response.status(400).json({ 
        message: 'Missing confirmation phrase. Please include "confirmation": "RESET_ALL_PLAYER_DATA" in your request body.' 
      });
    }

    // Use a pipeline for atomic operation
    const pipeline = kv.pipeline();

    // Delete all leaderboard data
    pipeline.del(LEADERBOARD_KEY);
    pipeline.del(USERNAMES_KEY);
    pipeline.del(GAMES_PLAYED_KEY);
    pipeline.del(HIGHEST_WAVE_KEY);
    pipeline.del(LAST_PLAYED_KEY);

    // Execute the pipeline
    await pipeline.exec();

    console.log('Entire leaderboard has been reset!');

    return response.status(200).json({ 
      message: 'Leaderboard has been reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resetting leaderboard:', error);
    return response.status(500).json({ message: 'Internal Server Error resetting leaderboard' });
  }
} 