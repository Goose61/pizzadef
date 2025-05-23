// Railway startup script with proper initialization
const fs = require('fs');
const path = require('path');

console.log('🚀 Railway Pizza Game Startup Script');
console.log('📋 Performing pre-startup checks...');
console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 Port:', process.env.PORT || '3000');
console.log('📁 Working directory:', process.cwd());

// Check if dist directory exists
const distDir = path.join(__dirname, '../dist');
console.log('🔍 Checking dist directory:', distDir);
if (!fs.existsSync(distDir)) {
  console.error('❌ Dist directory not found. Build may have failed.');
  console.error('📁 Available directories:', fs.readdirSync(path.join(__dirname, '..')));
  process.exit(1);
}
console.log('✅ Dist directory found');

// Check if index.html exists
const indexPath = path.join(distDir, 'index.html');
console.log('🔍 Checking index.html:', indexPath);
if (!fs.existsSync(indexPath)) {
  console.error('❌ index.html not found in dist directory.');
  console.error('📁 Dist contents:', fs.readdirSync(distDir));
  process.exit(1);
}
console.log('✅ index.html found');

// Check if API files exist
const apiDir = path.join(__dirname, '../pages/api');
console.log('🔍 Checking API directory:', apiDir);
if (!fs.existsSync(apiDir)) {
  console.error('❌ API directory not found.');
  console.error('📁 Available directories:', fs.readdirSync(path.join(__dirname, '..')));
  process.exit(1);
}
console.log('✅ API directory found');

// List API files
try {
  const apiFiles = fs.readdirSync(apiDir);
  console.log('📄 API files found:', apiFiles);
} catch (error) {
  console.error('❌ Error reading API directory:', error);
}

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