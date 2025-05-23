// This script copies API files to the correct location during build
const fs = require('fs-extra');
const path = require('path');

console.log('Starting API files copy process...');

// Source and destination paths
const sourceDir = path.resolve('./pages/api');
const destDir = path.resolve('./dist/pages/api');

// Ensure the destination directory exists
fs.ensureDirSync(destDir);

// Copy the API files
try {
  fs.copySync(sourceDir, destDir, {
    overwrite: true
  });
  console.log('Successfully copied API files from pages/api to dist/pages/api');
  
  // Also create an api directory directly under dist for vercel routing
  const altDestDir = path.resolve('./dist/api');
  fs.ensureDirSync(altDestDir);
  fs.copySync(sourceDir, altDestDir, {
    overwrite: true
  });
  console.log('Also copied API files to dist/api for compatibility');
  
} catch (err) {
  console.error('Error copying API files:', err);
  process.exit(1);
}

// Ensure leaderboard-data.json exists in the correct location
const leaderboardSourcePath = path.resolve('./public/leaderboard-data.json');
const leaderboardDestPath = path.resolve('./dist/leaderboard-data.json');

try {
  if (fs.existsSync(leaderboardSourcePath)) {
    fs.copySync(leaderboardSourcePath, leaderboardDestPath, { overwrite: true });
    console.log('Successfully copied leaderboard-data.json to dist');
  } else {
    // Create an empty leaderboard file if it doesn't exist
    const emptyData = {
      scores: [],
      usernames: {},
      gamesPlayed: {},
      highestWave: {}
    };
    fs.writeJSONSync(leaderboardDestPath, emptyData);
    console.log('Created empty leaderboard-data.json in dist');
  }
} catch (err) {
  console.error('Error handling leaderboard data file:', err);
}

console.log('API file copy process completed'); 