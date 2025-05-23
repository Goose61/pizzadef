const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting Pizza Game Railway Server...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 Port: ${PORT}`);
console.log('📁 Working directory:', process.cwd());
console.log('📋 Process arguments:', process.argv);

// Add startup timing
const startTime = Date.now();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Ensure data directory exists
const dataDir = path.join(__dirname, '../public');
console.log('🔍 Checking data directory:', dataDir);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`📁 Created data directory: ${dataDir}`);
} else {
  console.log('✅ Data directory exists');
}

// Check dist directory
const distDir = path.join(__dirname, '../dist');
console.log('🔍 Checking dist directory:', distDir);
if (!fs.existsSync(distDir)) {
  console.error('❌ Dist directory not found:', distDir);
  process.exit(1);
} else {
  console.log('✅ Dist directory exists');
  try {
    const distContents = fs.readdirSync(distDir);
    console.log('📄 Dist contents:', distContents);
  } catch (error) {
    console.error('❌ Error reading dist directory:', error);
  }
}

// API Routes - Import the API handlers
let apiHandlers;
try {
  console.log('📦 Loading API handlers...');
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
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

// Convert Next.js API routes to Express routes
app.post('/api/simple-submit', (req, res) => {
  console.log('📝 POST /api/simple-submit');
  apiHandlers.simpleSubmit.default(req, res);
});

app.get('/api/simple-leaderboard', (req, res) => {
  console.log('📊 GET /api/simple-leaderboard');
  apiHandlers.simpleLeaderboard.default(req, res);
});

app.post('/api/simple-login', (req, res) => {
  console.log('🔐 POST /api/simple-login');
  apiHandlers.simpleLogin.default(req, res);
});

app.get('/api/simple-debug', (req, res) => {
  console.log('🐛 GET /api/simple-debug');
  apiHandlers.simpleDebug.default(req, res);
});

app.post('/api/backup-leaderboard', (req, res) => {
  console.log('💾 POST /api/backup-leaderboard');
  apiHandlers.backupLeaderboard.default(req, res);
});

app.get('/api/backup-leaderboard', (req, res) => {
  console.log('💾 GET /api/backup-leaderboard');
  apiHandlers.backupLeaderboard.default(req, res);
});

// Health check endpoint - MUST respond quickly
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: uptime,
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    startupTime: Date.now() - startTime
  };
  
  console.log('🏥 Health check requested - uptime:', uptime, 'seconds');
  res.status(200).json(healthData);
});

// Serve the main game
app.get('*', (req, res) => {
  console.log('🎮 Serving game for path:', req.path);
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

// Add error handlers for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
console.log('🚀 Starting Express server...');
const server = app.listen(PORT, '0.0.0.0', () => {
  const startupTime = Date.now() - startTime;
  console.log(`🚀 Pizza Game server running on port ${PORT}`);
  console.log(`📊 Leaderboard data will be stored in: ${dataDir}`);
  console.log(`🌐 Access your game at: http://localhost:${PORT}`);
  console.log(`🏥 Health check available at: http://localhost:${PORT}/health`);
  console.log(`⏱️ Server startup completed in ${startupTime}ms`);
  console.log('✅ Server startup complete!');
});

// Handle server startup errors
server.on('error', (error) => {
  console.error('💥 Server startup error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
  process.exit(1);
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