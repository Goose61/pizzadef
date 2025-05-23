// Railway startup script with proper initialization
const fs = require('fs');
const path = require('path');

console.log('🚀 Railway Pizza Game Startup Script');
console.log('📋 Performing pre-startup checks...');

// Check if dist directory exists
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ Dist directory not found. Build may have failed.');
  process.exit(1);
}

// Check if index.html exists
const indexPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('❌ index.html not found in dist directory.');
  process.exit(1);
}

// Check if API files exist
const apiDir = path.join(__dirname, '../pages/api');
if (!fs.existsSync(apiDir)) {
  console.error('❌ API directory not found.');
  process.exit(1);
}

// Ensure public directory exists
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('📁 Created public directory');
}

// Create initial leaderboard data if needed
const leaderboardPath = path.join(publicDir, 'leaderboard-data.json');
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
}

console.log('✅ Pre-startup checks completed successfully');
console.log('🚀 Starting Railway server...');

// Small delay to ensure everything is ready
setTimeout(() => {
  require('./railway-server.js');
}, 2000); 