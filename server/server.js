const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { initializeWebSocket } = require('./websocket');
const { createUser } = require('./userManager.js');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize WebSocket server
initializeWebSocket(server, app);

// Route to create/get user
app.get('/api/user', async (req, res) => {
  const user = await createUser();
  res.json(user);
});

app.get('/api/backgrounds', async (req, res) => {
  try {
    const backgroundsDir = path.join(__dirname, '../frontend/media/backgrounds');
    const files = await fs.readdir(backgroundsDir);
    const backgrounds = files
      .filter(file => file.match(/\.(jpg|jpeg|png)$/i))
      .map(file => path.parse(file).name);
    res.json(backgrounds);
  } catch (error) {
    console.error('Error reading backgrounds directory:', error);
    res.status(500).json({ error: 'Failed to load backgrounds' });
  }
});

const PORT = process.env.PORT || 6969;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 