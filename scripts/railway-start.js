// Railway startup script with proper initialization
const fs = require('fs');
const path = require('path');

console.log('🚀 Railway Pizza Game Startup Script');
console.log('📋 Performing minimal pre-startup checks...');
console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 Port:', process.env.PORT || '3000');
console.log('📁 Working directory:', process.cwd());

// Ensure public directory exists
const publicDir = path.join(__dirname, '../public');
console.log('🔍 Checking/creating public directory:', publicDir);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('📁 Created public directory');
} else {
  console.log('✅ Public directory exists');
}

// Create initial leaderboard data if needed
const leaderboardPath = path.join(publicDir, 'leaderboard-data.json');
console.log('🔍 Checking leaderboard data:', leaderboardPath);
if (!fs.existsSync(leaderboardPath)) {
  const initialData = {
    scores: [],
    usernames: {},
    gamesPlayed: {},
    highestWave: {},
    lastPlayed: {}
  };
  fs.writeFileSync(leaderboardPath, JSON.stringify(initialData, null, 2));
  console.log('📊 Created initial leaderboard data');
} else {
  console.log('✅ Leaderboard data exists');
}

console.log('✅ Pre-startup checks completed successfully');
console.log('🚀 Starting Railway server...');

// Add error handling for the server startup
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server with error handling
try {
  console.log('📦 Loading railway-server.js...');
  require('./railway-server.js');
} catch (error) {
  console.error('💥 Failed to start server:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
} 