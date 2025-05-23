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
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Security check - simple password protection
    const { secret } = req.query;
    if (secret !== 'pizza') {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    console.log('Starting database diagnostics...');
    const diagnostics = {
      databaseConnection: 'Unknown',
      databaseType: 'Unknown',
      environment: process.env.NODE_ENV || 'unknown',
      vercelKvConfigured: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
      databaseStats: {},
      leaderboardEntries: [],
      usernameEntries: [],
      gamesPlayedEntries: [],
      highestWaveEntries: [],
      lastPlayedEntries: [],
      fallbackFileStats: {},
      errors: [],
      testWrite: { status: 'Not attempted', message: '' }
    };

    // Check fallback file status
    try {
      const fileExists = fs.existsSync(dataFilePath);
      diagnostics.fallbackFileStats = {
        exists: fileExists,
        path: dataFilePath,
        sizeBytes: fileExists ? fs.statSync(dataFilePath).size : 0,
        writable: fileExists ? true : false // We can't actually check this without trying to write
      };
    } catch (fsError) {
      diagnostics.fallbackFileStats = {
        error: fsError.message
      };
    }

    // Check if KV environment variables are available
    const useKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
    
    if (useKV) {
      diagnostics.databaseType = 'Vercel KV';
      try {
        // Check KV connection by getting a test value
        const connectionTest = await kv.ping();
        
        // Set connection status
        diagnostics.databaseConnection = connectionTest === 'PONG' ? 'Connected' : 'Error';
        
        // Get database stats
        const leaderboardCount = await kv.zcard(SCORES_KEY);
        
        // Get counts for various hash data types
        const usernamesCount = await kv.hlen(USERNAMES_KEY);
        const gamesPlayedCount = await kv.hlen(GAMES_PLAYED_KEY);
        const highestWaveCount = await kv.hlen(HIGHEST_WAVE_KEY);
        const lastPlayedCount = await kv.hlen(LAST_PLAYED_KEY);
        
        // Set stats in response
        diagnostics.databaseStats = {
          leaderboardCount: leaderboardCount || 0,
          usernamesCount: usernamesCount || 0,
          gamesPlayedCount: gamesPlayedCount || 0,
          highestWaveCount: highestWaveCount || 0,
          lastPlayedCount: lastPlayedCount || 0
        };
        
        // Get leaderboard entries (top 10)
        const leaderboardScores = await kv.zrange(SCORES_KEY, 0, 9, {
          withScores: true,
          rev: true // Get in descending order (highest scores first)
        });
        
        if (leaderboardScores && leaderboardScores.length > 0) {
          diagnostics.leaderboardEntries = leaderboardScores.map(([userId, score]) => ({
            userId,
            score: parseInt(score)
          }));
        }
        
        // Get username entries (top 10)
        // For hash data in KV, we need to get all entries and then slice
        if (usernamesCount > 0) {
          const allUsernames = await kv.hgetall(USERNAMES_KEY);
          if (allUsernames) {
            diagnostics.usernameEntries = Object.entries(allUsernames)
              .map(([userId, username]) => ({ userId, username }))
              .slice(0, 10);
          }
        }
        
        // Get games played entries (top 10)
        if (gamesPlayedCount > 0) {
          const allGamesPlayed = await kv.hgetall(GAMES_PLAYED_KEY);
          if (allGamesPlayed) {
            diagnostics.gamesPlayedEntries = Object.entries(allGamesPlayed)
              .map(([userId, gamesPlayed]) => ({ userId, gamesPlayed: parseInt(gamesPlayed) }))
              .slice(0, 10);
          }
        }
        
        // Get highest wave entries (top 10)
        if (highestWaveCount > 0) {
          const allHighestWaves = await kv.hgetall(HIGHEST_WAVE_KEY);
          if (allHighestWaves) {
            diagnostics.highestWaveEntries = Object.entries(allHighestWaves)
              .map(([userId, highestWave]) => ({ userId, highestWave: parseInt(highestWave) }))
              .slice(0, 10);
          }
        }
        
        // Get last played entries (top 10)
        if (lastPlayedCount > 0) {
          const allLastPlayed = await kv.hgetall(LAST_PLAYED_KEY);
          if (allLastPlayed) {
            diagnostics.lastPlayedEntries = Object.entries(allLastPlayed)
              .map(([userId, lastPlayed]) => ({
                userId,
                lastPlayed: new Date(parseInt(lastPlayed)).toISOString()
              }))
              .slice(0, 10);
          }
        }
        
        // Test write to KV
        const testUserId = `test_${Date.now()}`;
        const testUsername = `test_user_${Date.now()}`;
        
        // Add test data using pipeline for atomicity
        const pipeline = kv.pipeline();
        pipeline.zadd(SCORES_KEY, { score: 1, member: testUserId });
        pipeline.hset(USERNAMES_KEY, { [testUserId]: testUsername });
        pipeline.hset(GAMES_PLAYED_KEY, { [testUserId]: 1 });
        pipeline.hset(HIGHEST_WAVE_KEY, { [testUserId]: 1 });
        pipeline.hset(LAST_PLAYED_KEY, { [testUserId]: Date.now() });
        
        await pipeline.exec();
        
        // Verify the write worked
        const verifyUsername = await kv.hget(USERNAMES_KEY, testUserId);
        const testUserExists = verifyUsername === testUsername;
        
        // Clean up test data
        const cleanupPipeline = kv.pipeline();
        cleanupPipeline.zrem(SCORES_KEY, testUserId);
        cleanupPipeline.hdel(USERNAMES_KEY, testUserId);
        cleanupPipeline.hdel(GAMES_PLAYED_KEY, testUserId);
        cleanupPipeline.hdel(HIGHEST_WAVE_KEY, testUserId);
        cleanupPipeline.hdel(LAST_PLAYED_KEY, testUserId);
        
        await cleanupPipeline.exec();
        
        // Set test write status
        diagnostics.testWrite = {
          status: testUserExists ? 'Success' : 'Failed',
          message: testUserExists 
            ? `Successfully wrote test user ${testUserId} to KV database` 
            : 'Failed to verify test data in the KV database'
        };
        
      } catch (error) {
        diagnostics.databaseConnection = 'Error';
        diagnostics.errors.push(`Database Error: ${error.message}`);
        console.error('Error accessing KV database:', error);
      }
    } else {
      // Using fallback file storage
      diagnostics.databaseType = 'File-based (fallback)';
      try {
        // Check if file exists and is readable
        if (fs.existsSync(dataFilePath)) {
          const fileContents = fs.readFileSync(dataFilePath, 'utf8');
          const data = JSON.parse(fileContents);
          
          // Set connection status
          diagnostics.databaseConnection = 'Connected';
          
          // Get stats
          diagnostics.databaseStats = {
            leaderboardCount: data.scores ? data.scores.length : 0,
            usernamesCount: data.usernames ? Object.keys(data.usernames).length : 0,
            gamesPlayedCount: data.gamesPlayed ? Object.keys(data.gamesPlayed).length : 0,
            highestWaveCount: data.highestWave ? Object.keys(data.highestWave).length : 0,
            lastPlayedCount: data.lastPlayed ? Object.keys(data.lastPlayed).length : 0
          };
          
          // Get leaderboard entries (top 10)
          if (data.scores && data.scores.length > 0) {
            diagnostics.leaderboardEntries = data.scores.slice(0, 10).map(entry => ({
              userId: entry.userId,
              score: entry.score
            }));
          }
          
          // Get username entries (top 10)
          if (data.usernames) {
            diagnostics.usernameEntries = Object.entries(data.usernames)
              .map(([userId, username]) => ({ userId, username }))
              .slice(0, 10);
          }
          
          // Get games played entries (top 10)
          if (data.gamesPlayed) {
            diagnostics.gamesPlayedEntries = Object.entries(data.gamesPlayed)
              .map(([userId, gamesPlayed]) => ({ userId, gamesPlayed }))
              .slice(0, 10);
          }
          
          // Get highest wave entries (top 10)
          if (data.highestWave) {
            diagnostics.highestWaveEntries = Object.entries(data.highestWave)
              .map(([userId, highestWave]) => ({ userId, highestWave }))
              .slice(0, 10);
          }
          
          // Get last played entries (top 10)
          if (data.lastPlayed) {
            diagnostics.lastPlayedEntries = Object.entries(data.lastPlayed)
              .map(([userId, lastPlayed]) => ({
                userId,
                lastPlayed: new Date(parseInt(lastPlayed)).toISOString()
              }))
              .slice(0, 10);
          }
          
          // Test write to file
          try {
            const testUserId = `test_${Date.now()}`;
            const testUsername = `test_user_${Date.now()}`;
            
            // Create a copy of data for testing
            const testData = JSON.parse(JSON.stringify(data));
            
            // Add test data
            testData.scores.push({ userId: testUserId, score: 1 });
            testData.usernames[testUserId] = testUsername;
            testData.gamesPlayed[testUserId] = 1;
            testData.highestWave[testUserId] = 1;
            testData.lastPlayed[testUserId] = Date.now();
            
            // Write test data to file
            fs.writeFileSync(dataFilePath, JSON.stringify(testData, null, 2));
            
            // Read back to verify
            const verifyFileContents = fs.readFileSync(dataFilePath, 'utf8');
            const verifyData = JSON.parse(verifyFileContents);
            
            const testUserExists = verifyData.usernames[testUserId] === testUsername;
            
            // Clean up by removing test data
            const cleanData = JSON.parse(JSON.stringify(verifyData));
            cleanData.scores = cleanData.scores.filter(entry => entry.userId !== testUserId);
            delete cleanData.usernames[testUserId];
            delete cleanData.gamesPlayed[testUserId];
            delete cleanData.highestWave[testUserId];
            delete cleanData.lastPlayed[testUserId];
            
            // Write clean data back to file
            fs.writeFileSync(dataFilePath, JSON.stringify(cleanData, null, 2));
            
            // Set test write status
            diagnostics.testWrite = {
              status: testUserExists ? 'Success' : 'Failed',
              message: testUserExists 
                ? `Successfully wrote test user ${testUserId} to database file` 
                : 'Failed to verify test data in the database file'
            };
          } catch (writeError) {
            diagnostics.testWrite = {
              status: 'Failed',
              message: `Could not write to file: ${writeError.message}`
            };
          }
        } else {
          diagnostics.databaseConnection = 'Not found';
          diagnostics.errors.push(`Database file not found: ${dataFilePath}`);
        }
      } catch (error) {
        diagnostics.databaseConnection = 'Error';
        diagnostics.errors.push(`File database error: ${error.message}`);
        console.error('Error accessing file database:', error);
      }
    }

    // Add KV configuration guidance
    if (!useKV) {
      diagnostics.errors.push(
        "Vercel KV is not configured. You need to set up KV_REST_API_URL and KV_REST_API_TOKEN environment variables. " +
        "Visit your Vercel project dashboard, go to Storage -> KV Database, create a new database, and connect it to your project."
      );
    }

    return res.status(200).json(diagnostics);
  } catch (error) {
    console.error('Critical error in debug API:', error);
    return res.status(500).json({
      message: 'Internal Server Error during diagnostics',
      error: error.message
    });
  }
} 