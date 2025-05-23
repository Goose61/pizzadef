const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Ensure data directory exists
const dataDir = path.join(__dirname, '../public');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// API Routes - Import the API handlers
const simpleSubmit = require('../pages/api/simple-submit.js');
const simpleLeaderboard = require('../pages/api/simple-leaderboard.js');
const simpleLogin = require('../pages/api/simple-login.js');
const simpleDebug = require('../pages/api/simple-debug.js');
const backupLeaderboard = require('../pages/api/backup-leaderboard.js');

// Convert Next.js API routes to Express routes
app.post('/api/simple-submit', (req, res) => {
  simpleSubmit.default(req, res);
});

app.get('/api/simple-leaderboard', (req, res) => {
  simpleLeaderboard.default(req, res);
});

app.post('/api/simple-login', (req, res) => {
  simpleLogin.default(req, res);
});

app.get('/api/simple-debug', (req, res) => {
  simpleDebug.default(req, res);
});

app.post('/api/backup-leaderboard', (req, res) => {
  backupLeaderboard.default(req, res);
});

app.get('/api/backup-leaderboard', (req, res) => {
  backupLeaderboard.default(req, res);
});

// Serve the main game
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pizza Game server running on port ${PORT}`);
  console.log(`📊 Leaderboard data will be stored in: ${dataDir}`);
  console.log(`🌐 Access your game at: http://localhost:${PORT}`);
}); 