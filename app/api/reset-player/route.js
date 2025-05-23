import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Define the keys for our KV data
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username
const GAMES_PLAYED_KEY = 'leaderboard:games_played'; // Hash: userId -> games_played
const HIGHEST_WAVE_KEY = 'leaderboard:highest_wave'; // Hash: userId -> highest_wave
const LAST_PLAYED_KEY = 'leaderboard:last_played'; // Hash: userId -> timestamp

// This is a special admin key that should be set in environment variables
// A simple protection mechanism for admin-only endpoints
const ADMIN_KEY = process.env.ADMIN_KEY || 'default_admin_key_please_change';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, adminKey } = body;

    // Validate inputs
    if (!userId) {
      return NextResponse.json(
        { message: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Check admin key for authorization
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json(
        { message: 'Unauthorized: Invalid admin key' },
        { status: 401 }
      );
    }

    // Check if user exists first
    const username = await kv.hget(USERNAMES_KEY, userId);
    if (!username) {
      return NextResponse.json(
        { message: 'Player not found' },
        { status: 404 }
      );
    }

    // Use a pipeline for atomic operation
    const pipeline = kv.pipeline();

    // Remove from all relevant collections
    pipeline.zrem(LEADERBOARD_KEY, userId);
    pipeline.hdel(USERNAMES_KEY, userId);
    pipeline.hdel(GAMES_PLAYED_KEY, userId);
    pipeline.hdel(HIGHEST_WAVE_KEY, userId);
    pipeline.hdel(LAST_PLAYED_KEY, userId);

    // Execute the pipeline
    await pipeline.exec();

    console.log(`Reset stats for player ${username} (ID: ${userId})`);

    return NextResponse.json({ 
      message: `Stats for player ${username} have been reset`,
      userId,
      username
    }, { status: 200 });

  } catch (error) {
    console.error('Error resetting player stats:', error);
    return NextResponse.json(
      { message: 'Internal Server Error resetting player stats' },
      { status: 500 }
    );
  }
} 