import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Define the keys for our KV data (same as other APIs)
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username
const GAMES_PLAYED_KEY = 'leaderboard:games_played'; // Hash: userId -> games_played
const HIGHEST_WAVE_KEY = 'leaderboard:highest_wave'; // Hash: userId -> highest_wave
const LAST_PLAYED_KEY = 'leaderboard:last_played'; // Hash: userId -> timestamp

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, username } = body;
    console.log(`Received login request for userId=${userId}, username=${username}`);

    if (!userId || !username) {
      return NextResponse.json(
        { message: 'Missing userId or username' }, 
        { status: 400 }
      );
    }

    // Ensure userId is a string
    const userIdStr = String(userId);
    
    // Use userId as the key for the user object
    const userKey = `user:${userIdStr}`;

    // Check if user already exists in the user records
    const existingUser = await kv.hgetall(userKey);
    
    // Also check if the user exists in the leaderboard system
    const existingScore = await kv.zscore(LEADERBOARD_KEY, userIdStr);
    const existingUsername = await kv.hget(USERNAMES_KEY, userIdStr);
    
    console.log(`User lookup results - User record: ${existingUser ? 'found' : 'not found'}, 
                Leaderboard score: ${existingScore !== null ? existingScore : 'not found'}, 
                Username entry: ${existingUsername ? existingUsername : 'not found'}`);

    // Create a multi-command pipeline
    const pipeline = kv.pipeline();

    // Update or create user in our user object store
    if (existingUser) {
      // Update username if it changed, keep score
      if (existingUser.username !== username) {
        pipeline.hset(userKey, { username });
        console.log(`Updating username in user record for user ${userIdStr} from ${existingUser.username} to ${username}`);
      }
    } else {
      // Create new user with score 0
      const newUser = { userId: userIdStr, username, score: 0 };
      pipeline.hset(userKey, newUser);
      // Add user ID to a set for easy retrieval of all users (if needed)
      pipeline.sadd('users', userKey);
      console.log(`Creating new user record for ${userIdStr} (${username})`);
    }

    // Always ensure username is in the USERNAMES_KEY hash for leaderboard consistency
    if (!existingUsername || existingUsername !== username) {
      pipeline.hset(USERNAMES_KEY, { [userIdStr]: username });
      console.log(`Updating username in leaderboard for user ${userIdStr} to ${username}`);
    }

    // If user doesn't have a score yet, add a default score of 0
    if (existingScore === null) {
      pipeline.zadd(LEADERBOARD_KEY, { score: 0, member: userIdStr });
      console.log(`Adding default score of 0 for new user ${userIdStr}`);
    }

    // Initialize games played if needed
    const existingGamesPlayed = await kv.hget(GAMES_PLAYED_KEY, userIdStr);
    if (!existingGamesPlayed) {
      pipeline.hset(GAMES_PLAYED_KEY, { [userIdStr]: 0 });
      console.log(`Initializing games played count for user ${userIdStr}`);
    }

    // Execute all commands in the pipeline
    await pipeline.exec();

    // Determine if this was a new user creation or an existing user
    const isNewUser = !existingUser && !existingScore && !existingUsername;
    
    // Create response object with detailed status
    const responseData = {
      message: isNewUser ? 'New user created' : 'User logged in successfully',
      user: {
        userId: userIdStr,
        username,
        score: existingScore !== null ? parseInt(existingScore) : 0,
        isNewUser,
        gamesPlayed: existingGamesPlayed ? parseInt(existingGamesPlayed) : 0
      }
    };
    
    console.log(`Login successful for ${username} (${userIdStr}): ${isNewUser ? 'New user' : 'Existing user'}`);
    return NextResponse.json(responseData, { status: isNewUser ? 201 : 200 });
  } catch (error) {
    console.error('Error in /api/login:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', error: error.message },
      { status: 500 }
    );
  }
} 