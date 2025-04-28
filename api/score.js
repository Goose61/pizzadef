// Placeholder for /api/score

import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { userId, score } = request.body;

    if (userId === undefined || score === undefined) {
      return response.status(400).json({ message: 'Missing userId or score' });
    }

    const userKey = `user:${userId}`;

    // Check if user exists
    const userExists = await kv.exists(userKey);
    if (!userExists) {
      return response.status(404).json({ message: 'User not found. Please login first.' });
    }

    // Get current score
    const currentScore = await kv.hget(userKey, 'score') || 0;

    // Only update if the new score is higher (or just update regardless - depends on game logic)
    // Let's update if higher for a typical high-score leaderboard
    if (Number(score) > Number(currentScore)) {
        await kv.hset(userKey, { score: Number(score) });
        console.log(`Updated score for user ${userId} to ${score}`);
        return response.status(200).json({ message: 'Score updated', newScore: score });
    } else {
        console.log(`New score (${score}) not higher than current score (${currentScore}) for user ${userId}. Not updated.`);
        return response.status(200).json({ message: 'Score not updated (new score not higher)', currentScore });
    }

    // --- Alternative: Always update score --- 
    // await kv.hset(userKey, { score: Number(score) });
    // console.log(`Updated score for user ${userId} to ${score}`);
    // return response.status(200).json({ message: 'Score updated', newScore: score });
    // --- End Alternative ---

  } catch (error) {
    console.error('Error in /api/score:', error);
    return response.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
} 