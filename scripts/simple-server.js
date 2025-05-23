// Simple debug server for Railway
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🔧 Simple Debug Server Starting...');
console.log('🌐 Port:', PORT);
console.log('📁 Working directory:', process.cwd());

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('🏠 Root endpoint requested');
  res.status(200).send(`
    <html>
      <head><title>Pizza Game Debug</title></head>
      <body>
        <h1>🍕 Pizza Game Debug Server</h1>
        <p>Server is running on port ${PORT}</p>
        <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
        <p>Uptime: ${process.uptime()} seconds</p>
        <p><a href="/health">Health Check</a></p>
      </body>
    </html>
  `);
});

// Catch all other routes
app.get('*', (req, res) => {
  console.log('🔍 Unknown route requested:', req.path);
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Simple debug server running on port ${PORT}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
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