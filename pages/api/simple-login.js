import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

// Define KV storage keys
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username
const SCORES_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const GAMES_PLAYED_KEY = 'leaderboard:games_played'; // Hash: userId -> games_played
const HIGHEST_WAVE_KEY = 'leaderboard:highest_wave'; // Hash: userId -> highest_wave
const LAST_PLAYED_KEY = 'leaderboard:last_played'; // Hash: userId -> timestamp

// Fallback file path when KV is not available
const dataFilePath = path.join(process.cwd(), 'public', 'leaderboard-data.json');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { userId, username } = req.body;
    console.log(`Received login request for userId=${userId}, username=${username}`);

    if (!userId || !username) {
      return res.status(400).json({ message: 'Missing userId or username' });
    }

    // Ensure userId is a string
    const userIdStr = String(userId);
    
    // Check if KV environment variables are available
    const useKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
    
    if (useKV) {
      console.log('Using Vercel KV for login');
      // Check if user already exists
      const existingUsername = await kv.hget(USERNAMES_KEY, userIdStr);
      const existingScore = await kv.zscore(SCORES_KEY, userIdStr);
      const existingGamesPlayed = await kv.hget(GAMES_PLAYED_KEY, userIdStr) || 0;
      
      console.log(`User lookup results - Username: ${existingUsername ? existingUsername : 'not found'}, 
                  Score: ${existingScore !== null ? existingScore : 'not found'}, 
                  Games Played: ${existingGamesPlayed}`);
  
      // Create a pipeline for batch operations
      const pipeline = kv.pipeline();
  
      // Update username
      pipeline.hset(USERNAMES_KEY, { [userIdStr]: username });
  
      // If user doesn't have a score yet, add a default of 0
      if (existingScore === null) {
        pipeline.zadd(SCORES_KEY, { score: 0, member: userIdStr });
      }
  
      // Initialize games played if needed
      if (!existingGamesPlayed) {
        pipeline.hset(GAMES_PLAYED_KEY, { [userIdStr]: 0 });
      }
  
      // Execute all commands
      await pipeline.exec();
  
      // Determine if this was a new user creation or an existing user
      const isNewUser = !existingUsername && existingScore === null;
      
      // Create response object
      const responseData = {
        message: isNewUser ? 'New user created' : 'User logged in successfully',
        user: {
          userId: userIdStr,
          username,
          score: existingScore !== null ? parseInt(existingScore) : 0,
          isNewUser,
          gamesPlayed: parseInt(existingGamesPlayed)
        }
      };
      
      console.log(`Login successful for ${username} (${userIdStr}): ${isNewUser ? 'New user' : 'Existing user'}`);
      return res.status(isNewUser ? 201 : 200).json(responseData);
    } else {
      console.log('Vercel KV not configured, using file-based fallback');
      // Fallback to file-based storage
      let data;
      try {
        // Read data from file
        const fileContents = fs.readFileSync(dataFilePath, 'utf8');
        data = JSON.parse(fileContents);
      } catch (error) {
        // If file doesn't exist or is invalid, create a new data structure
        data = {
          scores: [],
          usernames: {},
          gamesPlayed: {},
          highestWave: {},
          lastPlayed: {}
        };
      }
      
      // Check if user already exists
      const existingUsername = data.usernames[userIdStr];
      const existingScoreIndex = data.scores.findIndex(entry => entry.userId === userIdStr);
      const existingScore = existingScoreIndex !== -1 ? data.scores[existingScoreIndex].score : null;
      const existingGamesPlayed = data.gamesPlayed[userIdStr] || 0;
      
      console.log(`User lookup results - Username: ${existingUsername ? existingUsername : 'not found'}, 
                  Score: ${existingScore !== null ? existingScore : 'not found'}, 
                  Games Played: ${existingGamesPlayed}`);
                  
      // Update username
      data.usernames[userIdStr] = username;
      
      // If user doesn't have a score yet, add a default of 0
      if (existingScoreIndex === -1) {
        data.scores.push({
          userId: userIdStr,
          score: 0
        });
      }
      
      // Initialize games played if needed
      if (!data.gamesPlayed[userIdStr]) {
        data.gamesPlayed[userIdStr] = 0;
      }
      
      try {
        // Write updated data back to file
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
      } catch (writeError) {
        console.error('Warning: Could not write to fallback file (read-only filesystem):', writeError);
        // Continue anyway since we want to return a response even if we can't write
      }
      
      // Determine if this was a new user creation or an existing user
      const isNewUser = !existingUsername && existingScore === null;
      
      // Create response object
      const responseData = {
        message: isNewUser ? 'New user created' : 'User logged in successfully',
        user: {
          userId: userIdStr,
          username,
          score: existingScore !== null ? existingScore : 0,
          isNewUser,
          gamesPlayed: existingGamesPlayed
        }
      };
      
      console.log(`Login successful for ${username} (${userIdStr}): ${isNewUser ? 'New user' : 'Existing user'}`);
      return res.status(isNewUser ? 201 : 200).json(responseData);
    }
  } catch (error) {
    console.error('Error in login API:', error);
    return res.status(500).json({ 
      message: 'Internal Server Error', 
      error: error.message 
    });
  }
} 