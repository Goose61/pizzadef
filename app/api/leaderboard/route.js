import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Define the keys for our KV data (same as submit-score)
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username
const GAMES_PLAYED_KEY = 'leaderboard:games_played'; // Hash: userId -> games_played
const HIGHEST_WAVE_KEY = 'leaderboard:highest_wave'; // Hash: userId -> highest_wave
const LAST_PLAYED_KEY = 'leaderboard:last_played'; // Hash: userId -> timestamp

export async function GET(request) {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const countParam = url.searchParams.get('count');
    const offsetParam = url.searchParams.get('offset');
    const period = url.searchParams.get('period') || 'all'; // all, day, week, month
    
    // Parse parameters
    const count = countParam ? parseInt(countParam, 10) : 100;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    console.log(`Fetching leaderboard with params: count=${count}, offset=${offset}, period=${period}`);

    // Get scores with ranks
    let leaderboardEntries;
    
    // Use different time periods for filtering if requested
    if (period !== 'all') {
      console.log(`Filtering by time period: ${period}`);
      const now = Date.now();
      let cutoffTime;
      
      // Calculate cutoff time based on period
      switch (period) {
        case 'day':
          cutoffTime = now - 24 * 60 * 60 * 1000; // 24 hours ago
          break;
        case 'week':
          cutoffTime = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago
          break;
        case 'month':
          cutoffTime = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
          break;
        default:
          cutoffTime = 0; // Default to all time
      }
      
      // Get users who played in this time period
      const lastPlayedData = await kv.hgetall(LAST_PLAYED_KEY);
      console.log(`Found ${lastPlayedData ? Object.keys(lastPlayedData).length : 0} users with last played data`);
      
      if (!lastPlayedData) {
        return NextResponse.json({ 
          entries: [],
          total: 0,
          period
        });
      }
      
      // Filter users who played in this period
      const recentUsers = Object.entries(lastPlayedData)
        .filter(([, timestamp]) => parseInt(timestamp) >= cutoffTime)
        .map(([userId]) => userId);
      
      console.log(`Found ${recentUsers.length} users who played in the ${period} period`);
      
      if (recentUsers.length === 0) {
        return NextResponse.json({ 
          entries: [],
          total: 0,
          period
        });
      }
      
      // Get scores for these users
      const scores = await Promise.all(recentUsers.map(userId => 
        kv.zscore(LEADERBOARD_KEY, userId)
      ));
      
      // Create array of [userId, score] pairs and sort by score
      const userScores = recentUsers
        .map((userId, index) => [userId, scores[index]])
        .filter(([, score]) => score !== null)  // Filter out null scores
        .sort((a, b) => b[1] - a[1]);          // Sort by score descending
      
      leaderboardEntries = userScores.slice(offset, offset + count).map(([userId, score], index) => ({
        userId,
        score: parseInt(score),
        rank: offset + index + 1
      }));
    } else {
      // Get top scores from the sorted set (for all time)
      leaderboardEntries = await kv.zrange(LEADERBOARD_KEY, 0, count + offset - 1, {
        withScores: true,
        rev: true
      });
      
      if (!leaderboardEntries) {
        console.log('No leaderboard entries found');
        return NextResponse.json({ 
          entries: [],
          total: 0,
          period
        });
      }
      
      // Transform to array of objects with userId, score, and rank
      leaderboardEntries = leaderboardEntries.map(([userId, score], index) => ({
        userId,
        score: parseInt(score),
        rank: offset + index + 1
      }));
      
      // Skip entries based on offset
      leaderboardEntries = leaderboardEntries.slice(offset);
    }
    
    console.log(`Found ${leaderboardEntries.length} leaderboard entries after filtering/pagination`);
    
    // If no entries, return empty array
    if (leaderboardEntries.length === 0) {
      return NextResponse.json({ 
        entries: [],
        total: await kv.zcard(LEADERBOARD_KEY),
        period
      });
    }

    // Get usernames for these user IDs
    const userIds = leaderboardEntries.map(entry => entry.userId);
    console.log(`Fetching usernames for ${userIds.length} users:`, userIds);
    
    const usernames = await kv.hmget(USERNAMES_KEY, ...userIds);
    console.log(`Fetched usernames:`, usernames);

    // Get games played for these user IDs 
    const gamesPlayed = await kv.hmget(GAMES_PLAYED_KEY, ...userIds);
    
    // Get highest wave for these user IDs
    const highestWaves = await kv.hmget(HIGHEST_WAVE_KEY, ...userIds);

    // Combine all data
    const entries = leaderboardEntries.map((entry, index) => {
      return {
        userId: entry.userId,
        username: usernames[index] || `unknown_${entry.userId}`,
        score: entry.score,
        rank: entry.rank,
        gamesPlayed: gamesPlayed[index] ? parseInt(gamesPlayed[index]) : 1,
        highestWave: highestWaves[index] ? parseInt(highestWaves[index]) : 0
      };
    });

    // Get total number of entries
    const total = await kv.zcard(LEADERBOARD_KEY);

    // Return the leaderboard data
    console.log(`Successfully returning ${entries.length} entries out of ${total} total`);
    return NextResponse.json({ 
      entries,
      total,
      period
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 