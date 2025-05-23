import { kv } from '@vercel/kv';

// Define the keys for our KV data (same as other APIs)
const LEADERBOARD_KEY = 'leaderboard:scores'; // Sorted Set: userId -> score
const USERNAMES_KEY = 'leaderboard:usernames'; // Hash: userId -> username
const GAMES_PLAYED_KEY = 'leaderboard:games_played'; // Hash: userId -> games_played
const HIGHEST_WAVE_KEY = 'leaderboard:highest_wave'; // Hash: userId -> highest_wave
const LAST_PLAYED_KEY = 'leaderboard:last_played'; // Hash: userId -> timestamp

export default async function handler(request, response) {
  try {
    // Security check - in production, you'd want better security
    const { secret } = request.query;
    if (secret !== 'pizza') {
      return response.status(401).json({ message: 'Unauthorized access' });
    }

    console.log('Starting database diagnostics...');
    const diagnostics = {
      databaseConnection: 'Unknown',
      databaseStats: {},
      leaderboardEntries: [],
      usernameEntries: [],
      gamesPlayedEntries: [],
      highestWaveEntries: [],
      lastPlayedEntries: [],
      errors: [],
      testWrite: { status: 'Not attempted', message: '' }
    };

    // 1. Test database connection with ping
    try {
      const pingResult = await kv.ping();
      diagnostics.databaseConnection = pingResult === 'PONG' ? 'Connected' : 'Error';
      console.log(`Database connection: ${diagnostics.databaseConnection}`);
    } catch (error) {
      diagnostics.errors.push(`DB Connection Error: ${error.message}`);
      console.error('Database connection error:', error);
      diagnostics.databaseConnection = 'Error';
    }

    // 2. Get database statistics if connected
    if (diagnostics.databaseConnection === 'Connected') {
      try {
        // Get counts for each key
        const [leaderboardCount, usernamesCount, gamesPlayedCount, highestWaveCount, lastPlayedCount] = await Promise.all([
          kv.zcard(LEADERBOARD_KEY),
          kv.hlen(USERNAMES_KEY),
          kv.hlen(GAMES_PLAYED_KEY),
          kv.hlen(HIGHEST_WAVE_KEY),
          kv.hlen(LAST_PLAYED_KEY)
        ]);

        diagnostics.databaseStats = {
          leaderboardCount,
          usernamesCount,
          gamesPlayedCount,
          highestWaveCount,
          lastPlayedCount
        };
        console.log('Database stats:', diagnostics.databaseStats);

        // 3. Get entries for each key (limited to top 10)
        if (leaderboardCount > 0) {
          const leaderboardEntries = await kv.zrange(LEADERBOARD_KEY, 0, 9, {
            withScores: true,
            rev: true
          });
          diagnostics.leaderboardEntries = leaderboardEntries.map(([member, score]) => ({ 
            userId: member, 
            score: parseInt(score) 
          }));
        }

        if (usernamesCount > 0) {
          const usernameEntries = await kv.hgetall(USERNAMES_KEY);
          diagnostics.usernameEntries = Object.entries(usernameEntries || {})
            .map(([key, value]) => ({ userId: key, username: value }))
            .slice(0, 10);
        }

        if (gamesPlayedCount > 0) {
          const gamesPlayedEntries = await kv.hgetall(GAMES_PLAYED_KEY);
          diagnostics.gamesPlayedEntries = Object.entries(gamesPlayedEntries || {})
            .map(([key, value]) => ({ userId: key, gamesPlayed: parseInt(value) }))
            .slice(0, 10);
        }

        if (highestWaveCount > 0) {
          const highestWaveEntries = await kv.hgetall(HIGHEST_WAVE_KEY);
          diagnostics.highestWaveEntries = Object.entries(highestWaveEntries || {})
            .map(([key, value]) => ({ userId: key, highestWave: parseInt(value) }))
            .slice(0, 10);
        }

        if (lastPlayedCount > 0) {
          const lastPlayedEntries = await kv.hgetall(LAST_PLAYED_KEY);
          diagnostics.lastPlayedEntries = Object.entries(lastPlayedEntries || {})
            .map(([key, value]) => ({ 
              userId: key, 
              lastPlayed: new Date(parseInt(value)).toISOString() 
            }))
            .slice(0, 10);
        }

        // 4. Test write capabilities
        const testUserId = `test_${Date.now()}`;
        const testUsername = `test_user_${Date.now()}`;
        
        await kv.pipeline()
          .zadd(LEADERBOARD_KEY, { score: 1, member: testUserId })
          .hset(USERNAMES_KEY, { [testUserId]: testUsername })
          .hset(GAMES_PLAYED_KEY, { [testUserId]: 1 })
          .hset(HIGHEST_WAVE_KEY, { [testUserId]: 1 })
          .hset(LAST_PLAYED_KEY, { [testUserId]: Date.now() })
          .exec();
          
        // Verify write
        const verifyScore = await kv.zscore(LEADERBOARD_KEY, testUserId);
        const verifyUsername = await kv.hget(USERNAMES_KEY, testUserId);
        
        if (verifyScore === '1' && verifyUsername === testUsername) {
          diagnostics.testWrite = { 
            status: 'Success', 
            message: `Successfully wrote test user ${testUserId} to database` 
          };
          
          // Clean up test data
          await kv.pipeline()
            .zrem(LEADERBOARD_KEY, testUserId)
            .hdel(USERNAMES_KEY, testUserId)
            .hdel(GAMES_PLAYED_KEY, testUserId)
            .hdel(HIGHEST_WAVE_KEY, testUserId)
            .hdel(LAST_PLAYED_KEY, testUserId)
            .exec();
        } else {
          diagnostics.testWrite = { 
            status: 'Failed', 
            message: `Failed to verify test data. Score: ${verifyScore}, Username: ${verifyUsername}` 
          };
        }
      } catch (error) {
        diagnostics.errors.push(`Diagnostics Error: ${error.message}`);
        console.error('Error during diagnostics:', error);
      }
    }

    // Return diagnostics results
    return response.status(200).json(diagnostics);
  } catch (error) {
    console.error('Critical error in debug API:', error);
    return response.status(500).json({ 
      message: 'Internal Server Error during diagnostics',
      error: error.message
    });
  }
} 