importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

const CACHE_NAME = 'chat-app-v1';
const MESSAGE_SYNC_TAG = 'message-sync';

// Register for background sync
self.addEventListener('sync', (event) => {
  if (event.tag === MESSAGE_SYNC_TAG) {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  const db = await openDB('chat-store', 1);
  const lastSync = await db.get('meta', 'lastSync');
  
  try {
    const response = await fetch(`/api/messages?since=${lastSync}`);
    const messages = await response.json();
    
    if (messages.length > 0) {
      // Store new messages in IndexedDB
      await db.put('messages', messages);
      // Update clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'sync-messages',
          messages: messages
        });
      });
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

let badgeCount = 0;

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // Increment badge count
    badgeCount++;
    
    // Update badge count
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(badgeCount).then(() => {
        console.log('Badge updated to:', badgeCount);
      }).catch((error) => {
        console.error('Error updating badge:', error);
      });
    }

    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/media/apple-touch-icon.png',
        badge: '/media/favicon-96x96.png',
        timestamp: new Date(data.timestamp).getTime(),
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: 1,
          badgeCount: badgeCount
        }
      })
    );
  }
});

// Reset badge count when notification is clicked
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  badgeCount = 0;
  
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(error => {
      console.error('Error clearing badge:', error);
    });
  }
  
  event.waitUntil(
    clients.matchAll({
      type: 'window'
    })
    .then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
}); 