const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const { initializeWebSocket } = require('./websocket');
const { createUser } = require('./userManager.js');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../frontend/media/uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize WebSocket server
initializeWebSocket(server, app);

// Route to create/get user
app.get('/api/user', async (req, res) => {
  const user = await createUser();
  res.json(user);
});

// Add image upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const imageUrl = `/media/uploads/${req.file.filename}`;
  res.json({ imageUrl });
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