const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies
app.use(express.json());

// Directory where API handlers are located
const apiDir = path.join(process.cwd(), 'pages', 'api');

console.log(`Starting API server on port ${PORT}`);
console.log(`Looking for API handlers in: ${apiDir}`);

// List available API routes
const apiFiles = fs.readdirSync(apiDir).filter(file => file.endsWith('.js'));
console.log('Available API routes:');
apiFiles.forEach(file => console.log(`- /api/${file.replace('.js', '')}`));

// Serve public files
app.use(express.static(path.join(process.cwd(), 'public')));

// Handle API routes
app.all('/api/:endpoint', async (req, res) => {
  const endpoint = req.params.endpoint;
  const handlerPath = path.join(apiDir, `${endpoint}.js`);
  
  try {
    if (!fs.existsSync(handlerPath)) {
      console.error(`API handler not found: ${handlerPath}`);
      return res.status(404).json({ message: 'API endpoint not found' });
    }
    
    console.log(`Processing ${req.method} request to /api/${endpoint}`);
    
    // Clear require cache to allow for hot reloading
    delete require.cache[require.resolve(handlerPath)];
    
    // Import the handler
    const handler = require(handlerPath).default;
    
    // Call the handler with request and response
    await handler(req, res);
    
  } catch (error) {
    console.error(`Error processing API request to /api/${endpoint}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
}); 