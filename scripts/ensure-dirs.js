// Ensure all required directories exist before build
const fs = require('fs');
const path = require('path');

console.log('Ensuring required directories exist...');

// Directories that need to exist
const requiredDirs = [
  './public',
  './dist',
  './pages/api'
];

requiredDirs.forEach(dir => {
  const fullPath = path.resolve(dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${dir}`);
  } else {
    console.log(`Directory already exists: ${dir}`);
  }
});

// Create initial leaderboard data if it doesn't exist
const leaderboardPath = path.resolve('./public/leaderboard-data.json');
if (!fs.existsSync(leaderboardPath)) {
  const initialData = {
    scores: [],
    usernames: {},
    gamesPlayed: {},
    highestWave: {},
    lastPlayed: {}
  };
  fs.writeFileSync(leaderboardPath, JSON.stringify(initialData, null, 2));
  console.log('Created initial leaderboard-data.json');
}

console.log('Directory setup complete!'); 