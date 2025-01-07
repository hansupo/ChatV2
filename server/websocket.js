const WebSocket = require('ws');
const { getMessages, addMessage, getMessagesSince } = require('./messageStore');
const { getUser } = require('./userManager.js');

let wss;
let clientCount = 0;

function initializeWebSocket(server, app) {
  wss = new WebSocket.Server({ server });

  app.get('/api/messages', async (req, res) => {
    try {
      const since = req.query.since;
      console.log('Fetching messages since:', since || 'beginning');
      const messages = await getMessagesSince(since);
      console.log(`Returning ${messages.length} messages`);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  wss.on('connection', async (ws, req) => {
    clientCount++;
    ws.clientId = `client_${Date.now()}_${clientCount}`;
    console.log(`Client connected (${ws.clientId}), total clients: ${clientCount}`);

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    try {
      const messages = await getMessages();
      ws.send(JSON.stringify({
        type: 'initial',
        messages
      }));
    } catch (error) {
      console.error('Error sending initial messages:', error);
    }

    ws.on('close', () => {
      clientCount--;
      console.log(`Client disconnected (${ws.clientId}), remaining clients: ${clientCount}`);
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        
        switch (message.type) {
          case 'chat':
            const savedMessage = await addMessage(message.content);
            broadcastMessage(savedMessage);
            break;
          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Increase ping frequency for better connection tracking
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log(`Terminating inactive client (${ws.clientId})`);
        clientCount--;
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 15000); // Check every 15 seconds

  wss.on('close', () => {
    clearInterval(interval);
  });
}

function broadcastMessage(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({
          type: 'message',
          message
        }));
      } catch (error) {
        console.error('Error broadcasting message:', error);
      }
    }
  });
}

module.exports = { initializeWebSocket }; 