const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting Pizza Game Railway Server...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 Port: ${PORT}`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Ensure data directory exists
const dataDir = path.join(__dirname, '../public');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`📁 Created data directory: ${dataDir}`);
}

// API Routes - Import the API handlers
let apiHandlers;
try {
  apiHandlers = {
    simpleSubmit: require('../pages/api/simple-submit.js'),
    simpleLeaderboard: require('../pages/api/simple-leaderboard.js'),
    simpleLogin: require('../pages/api/simple-login.js'),
    simpleDebug: require('../pages/api/simple-debug.js'),
    backupLeaderboard: require('../pages/api/backup-leaderboard.js')
  };
  console.log('✅ API handlers loaded successfully');
} catch (error) {
  console.error('❌ Error loading API handlers:', error);
  process.exit(1);
}

// Convert Next.js API routes to Express routes
app.post('/api/simple-submit', (req, res) => {
  apiHandlers.simpleSubmit.default(req, res);
});

app.get('/api/simple-leaderboard', (req, res) => {
  apiHandlers.simpleLeaderboard.default(req, res);
});

app.post('/api/simple-login', (req, res) => {
  apiHandlers.simpleLogin.default(req, res);
});

app.get('/api/simple-debug', (req, res) => {
  apiHandlers.simpleDebug.default(req, res);
});

app.post('/api/backup-leaderboard', (req, res) => {
  apiHandlers.backupLeaderboard.default(req, res);
});

app.get('/api/backup-leaderboard', (req, res) => {
  apiHandlers.backupLeaderboard.default(req, res);
});

// Health check endpoint - MUST respond quickly
app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  };
  
  console.log('🏥 Health check requested');
  res.status(200).json(healthData);
});

// Serve the main game
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('❌ index.html not found at:', indexPath);
    res.status(404).send('Game files not found');
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pizza Game server running on port ${PORT}`);
  console.log(`📊 Leaderboard data will be stored in: ${dataDir}`);
  console.log(`🌐 Access your game at: http://localhost:${PORT}`);
  console.log(`🏥 Health check available at: http://localhost:${PORT}/health`);
  console.log('✅ Server startup complete!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 