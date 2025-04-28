import { kv } from '@vercel/kv';

// Define the keys for our KV data (same as submit-score)
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const count = request.query.count ? parseInt(request.query.count, 10) : 100;
    const maxCount = 100; // Limit the number of entries returned
    const numToFetch = Math.min(count, maxCount);

    // Fetch top user IDs and scores (highest first) using ZREVRANGE
    // [userId1, score1, userId2, score2, ...]
    const topEntries = await kv.zrevrange(LEADERBOARD_KEY, 0, numToFetch - 1, { withScores: true });

    if (!topEntries || topEntries.length === 0) {
      return response.status(200).json([]); // Return empty array if no scores
    }

    // Extract user IDs for fetching usernames
    const userIds = [];
    const scores = {};
    for (let i = 0; i < topEntries.length; i += 2) {
        const userId = topEntries[i];
        const score = topEntries[i + 1];
        userIds.push(userId);
        scores[userId] = score;
    }

    let usernames = {};
    if (userIds.length > 0) {
      // Fetch usernames using HMGET
      const usernameResults = await kv.hmget(USERNAMES_KEY, ...userIds);
      userIds.forEach((id, index) => {
          usernames[id] = usernameResults[index] || `User ${id}`; // Fallback username
      });
    }
    
    // Combine into the final leaderboard structure
    const leaderboard = userIds.map((userId, index) => ({
      rank: index + 1,
      userId: userId,
      username: usernames[userId],
      score: scores[userId],
    }));

    return response.status(200).json(leaderboard);

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return response.status(500).json({ message: 'Internal Server Error fetching leaderboard' });
  }
} 