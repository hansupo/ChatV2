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