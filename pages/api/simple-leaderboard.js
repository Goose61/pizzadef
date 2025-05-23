import fs from 'fs';
import path from 'path';

// File path for leaderboard data
const dataFilePath = path.join(process.cwd(), 'public', 'leaderboard-data.json');

// Helper function to read data from file
function readDataFromFile() {
  try {
    if (!fs.existsSync(dataFilePath)) {
      // Return sample data if file doesn't exist
      return {
        scores: [
          { userId: "sample1", score: 5000 },
          { userId: "sample2", score: 3500 },
          { userId: "sample3", score: 2000 }
        ],
        usernames: {
          "sample1": "PizzaMaster",
          "sample2": "CheeseKing", 
          "sample3": "PepperoniLover"
        },
        gamesPlayed: {
          "sample1": 5,
          "sample2": 3,
          "sample3": 2
        },
        highestWave: {
          "sample1": 10,
          "sample2": 7,
          "sample3": 4
        },
        lastPlayed: {
          "sample1": Date.now() - 86400000,
          "sample2": Date.now() - 172800000,
          "sample3": Date.now() - 259200000
        }
      };
    }
    
    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading data file:', error);
    // Return empty structure on error
    return {
      scores: [],
      usernames: {},
      gamesPlayed: {},
      highestWave: {},
      lastPlayed: {}
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    console.log('Fetching leaderboard data from file...');

    // Read data from file
    const data = readDataFromFile();
    
    if (!data.scores || data.scores.length === 0) {
      console.log('No scores found in leaderboard');
      return res.status(200).json([]);
    }
    
    // Transform the data into the expected format
    const entries = data.scores.map((scoreEntry, index) => {
      const userId = scoreEntry.userId;
      return {
        userId,
        username: data.usernames[userId] || `Player_${userId}`,
        score: scoreEntry.score,
        rank: index + 1,
        gamesPlayed: data.gamesPlayed[userId] || 1,
        highestWave: data.highestWave[userId] || 0,
        lastPlayed: data.lastPlayed ? data.lastPlayed[userId] : null
      };
    });
    
    console.log(`Successfully returning ${entries.length} leaderboard entries from file`);
    return res.status(200).json(entries);

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ 
      message: 'Internal Server Error', 
      error: error.message 
    });
  }
} 