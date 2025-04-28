import { kv } from '@vercel/kv';

// Define the keys for our KV data
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { userId, username, score } = request.body;

    // Basic validation
    if (userId === undefined || userId === null || !username || typeof score !== 'number') {
      return response.status(400).json({ message: 'Missing or invalid parameters (userId, username, score)' });
    }
    
    // Ensure score is an integer
    const integerScore = Math.floor(score);
    if (integerScore <= 0) {
        return response.status(200).json({ message: 'Score is zero or negative, not recorded.' });
    }

    // Check existing score using ZSCORE
    const currentHighScore = await kv.zscore(LEADERBOARD_KEY, userId.toString());

    if (currentHighScore === null || integerScore > Number(currentHighScore)) {
      // --- Update Score and Username ---
      // Use pipeline for atomic updates if needed, but separate calls are okay here
      
      // Add/Update the score in the sorted set
      await kv.zadd(LEADERBOARD_KEY, { score: integerScore, member: userId.toString() });
      
      // Store/Update the username in the hash
      await kv.hset(USERNAMES_KEY, { [userId.toString()]: username });
      
      console.log(`Updated score for ${username} (ID: ${userId}) to ${integerScore}`);
      return response.status(200).json({ 
        message: 'High score updated successfully!', 
        newHighScore: integerScore 
      });
    } else {
      console.log(`Score ${integerScore} for ${username} (ID: ${userId}) is not higher than current high score (${currentHighScore}).`);
      return response.status(200).json({ 
        message: 'Score not higher than current high score.',
        currentHighScore: Number(currentHighScore)
       });
    }

  } catch (error) {
    console.error('Error processing score submission:', error);
    return response.status(500).json({ message: 'Internal Server Error processing score' });
  }
} 