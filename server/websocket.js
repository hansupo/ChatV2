const WebSocket = require('ws');
const { getMessages, addMessage, getMessagesSince } = require('./messageStore');
const { getAllSubscriptions } = require('./subscriptionStore');
const webPush = require('web-push');

let wss;
const activeUsers = new Map(); // userId -> Set of WebSocket connections

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
    // Initialize connection state
    ws.isAlive = true;
    ws.isActive = false;
    ws.deviceType = getDeviceType(req);
    
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

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        
        switch (message.type) {
          case 'identify':
            ws.userId = message.userId;
            ws.username = message.username;
            // Initialize user's connection set
            if (!activeUsers.has(message.userId)) {
              activeUsers.set(message.userId, new Set());
            }
            activeUsers.get(message.userId).add(ws);
            console.log(`User identified: ${message.username} (${message.userId})`);
            logActiveUsers();
            break;

          case 'chat':
            console.log('Received chat message:', message);
            const savedMessage = await addMessage(message.content);
            broadcastMessage(savedMessage);
            
            if (!isUserActive(message.content.userId)) {
              await sendNotifications({
                ...savedMessage,
                content: {
                  text: message.content.content,
                  username: message.content.senderName,
                  userId: message.content.senderId
                }
              }, message.content.senderId);
            }
            break;

          case 'visibility':
            if (!ws.userId) {
              console.warn('Received visibility update for unidentified connection');
              break;
            }
            ws.isActive = message.state === 'visible';
            
            // Special handling for iOS PWA
            if (ws.deviceType === 'iOS_PWA') {
              ws.isActive = message.state === 'visible';
            }
            
            console.log(`Visibility update for ${ws.username} (${ws.userId}): ${message.state}`);
            logActiveUsers();
            break;

          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        const userConnections = activeUsers.get(ws.userId);
        if (userConnections) {
          userConnections.delete(ws);
          if (userConnections.size === 0) {
            activeUsers.delete(ws.userId);
          }
          logActiveUsers();
        }
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Clean up dead connections every 30 seconds
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        if (ws.userId) {
          const userConnections = activeUsers.get(ws.userId);
          if (userConnections) {
            userConnections.delete(ws);
            if (userConnections.size === 0) {
              activeUsers.delete(ws.userId);
            }
          }
        }
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
    logActiveUsers();
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

function getDeviceType(req) {
  const userAgent = req.headers['user-agent'] || '';
  if (/iPhone|iPad|iPod/.test(userAgent) && /AppleWebKit/.test(userAgent)) {
    return 'iOS_PWA';
  }
  return 'browser';
}

function isUserActive(userId) {
  const userConnections = activeUsers.get(userId);
  if (!userConnections) return false;
  return Array.from(userConnections).some(ws => ws.isActive);
}

function logActiveUsers() {
  console.log('\n=== Active Users Status ===');
  
  activeUsers.forEach((connections, userId) => {
    const userConnections = Array.from(connections);
    const user = userConnections[0]; // Get first connection for user info
    
    console.log(`\nUser ${user.username} (${userId}):`);
    userConnections.forEach(ws => {
      const status = ws.isActive ? 'active' : 'inactive';
      const device = ws.deviceType || 'unknown';
      console.log(`- ${device} [${status}]`);
    });
  });

  const totalConnections = Array.from(wss.clients).length;
  const activeConnections = Array.from(wss.clients)
    .filter(ws => ws.isActive).length;

  console.log(`\nTotal connections [${totalConnections}], active [${activeConnections}]`);
  console.log('========================\n');
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

async function sendNotifications(message, senderId) {
  try {
    console.log('Sending notification for message:', JSON.stringify(message, null, 2));
    const subscriptions = getAllSubscriptions();
    
    for (const [userId, subscription] of subscriptions) {
      if (userId === senderId || isUserActive(userId)) {
        console.log(`Skipping notification for user ${userId} (sender or active)`);
        continue;
      }

      // Get message content and sender info
      const senderUsername = message.content.username || 
                           message.content.senderName || 
                           'Unknown User';
      
      const messageText = message.content.text || 
                         message.content.content || 
                         (message.content.imageUrl ? 'Sent an image' : 'New message');

      console.log('Notification content:', {
        senderUsername,
        messageText
      });

      const payload = JSON.stringify({
        title: senderUsername,
        body: messageText,
        timestamp: message.timestamp,
        badge: 1,
        data: {
          messageId: message.id,
          timestamp: message.timestamp,
          senderId: senderId,
          senderUsername: senderUsername
        }
      });

      try {
        await webPush.sendNotification(subscription, payload);
        console.log(`Notification sent to user ${userId}:`, {
          title: `${senderUsername} from Chat`,
          body: messageText
        });
      } catch (error) {
        if (error.statusCode === 410) {
          removeSubscription(userId);
          console.log(`Removed expired subscription for user ${userId}`);
        }
        console.error(`Failed to send notification to user ${userId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error sending notifications:', error);
  }
}

module.exports = { initializeWebSocket }; 