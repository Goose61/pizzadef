import fs from 'fs';
import path from 'path';

// File path for leaderboard data
const dataFilePath = path.join(process.cwd(), 'public', 'leaderboard-data.json');

// Helper function to read data from file
function readDataFromFile() {
  try {
    if (!fs.existsSync(dataFilePath)) {
      // Create initial file structure
      const initialData = {
        scores: [],
        usernames: {},
        gamesPlayed: {},
        highestWave: {},
        lastPlayed: {}
      };
      fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    
    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading data file:', error);
    return {
      scores: [],
      usernames: {},
      gamesPlayed: {},
      highestWave: {},
      lastPlayed: {}
    };
  }
}

// Helper function to write data to file
function writeDataToFile(data) {
  try {
    // Ensure directory exists
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { userId, username, score, highestWave } = req.body;

    if (!userId || !username || score === undefined) {
      return res.status(400).json({ 
        message: 'Missing required fields: userId, username, score' 
      });
    }

    console.log(`Submitting score for user ${userId}: ${score}`);

    // Read current data
    const data = readDataFromFile();
    
    // Update username
    data.usernames[userId] = username;
    
    // Update games played count
    data.gamesPlayed[userId] = (data.gamesPlayed[userId] || 0) + 1;
    
    // Update highest wave if provided and higher than current
    if (highestWave !== undefined) {
      data.highestWave[userId] = Math.max(data.highestWave[userId] || 0, highestWave);
    }
    
    // Update last played timestamp
    data.lastPlayed[userId] = Date.now();
    
    // Find existing score entry for this user
    const existingScoreIndex = data.scores.findIndex(entry => entry.userId === userId);
    
    if (existingScoreIndex !== -1) {
      // Update existing score if new score is higher
      if (score > data.scores[existingScoreIndex].score) {
        data.scores[existingScoreIndex].score = score;
        console.log(`Updated high score for user ${userId}: ${score}`);
      }
    } else {
      // Add new score entry
      data.scores.push({ userId, score });
      console.log(`Added new score for user ${userId}: ${score}`);
    }
    
    // Sort scores in descending order
    data.scores.sort((a, b) => b.score - a.score);
    
    // Write data back to file
    const writeSuccess = writeDataToFile(data);
    
    if (!writeSuccess) {
      return res.status(500).json({ message: 'Failed to save score' });
    }
    
    // Find user's rank
    const userRank = data.scores.findIndex(entry => entry.userId === userId) + 1;
    
    console.log(`Score submitted successfully for user ${userId}, rank: ${userRank}`);
    
    return res.status(200).json({
      message: 'Score submitted successfully',
      userId,
      score,
      rank: userRank,
      gamesPlayed: data.gamesPlayed[userId],
      highestWave: data.highestWave[userId]
    });

  } catch (error) {
    console.error('Error submitting score:', error);
    return res.status(500).json({ 
      message: 'Internal Server Error', 
      error: error.message 
    });
  }
} 