import { messages, activeReplyTo } from './types.js';
import { 
  createMessageElement,
  setActiveReply,
  clearActiveReply,
  clearLongPress,
  updateMessageGrouping
} from './message-handlers.js';

let ws;
let messagesContainer;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

async function initializeChat() {
  messagesContainer = document.querySelector('.messages-container');
  
  // Initialize WebSocket connection
  connectWebSocket();
  
  // Track page visibility and handle badges
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      // Clear badge when app becomes visible
      if ('clearAppBadge' in navigator) {
        try {
          await navigator.clearAppBadge();
          console.log('Badge cleared on visibility change');
        } catch (error) {
          console.error('Error clearing badge:', error);
        }
      }
    }

    if (window.ws && window.ws.readyState === WebSocket.OPEN) {
      window.ws.send(JSON.stringify({
        type: 'visibility',
        state: document.visibilityState,
        userId: window.currentUser.id
      }));
    }
  });

  // Clear badge on startup
  if ('clearAppBadge' in navigator) {
    try {
      await navigator.clearAppBadge();
      console.log('Badge cleared on startup');
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }

  // Track window focus
  window.addEventListener('focus', () => {
    if (window.ws && window.ws.readyState === WebSocket.OPEN) {
      window.ws.send(JSON.stringify({
        type: 'visibility',
        state: 'visible'
      }));
    }
  });

  window.addEventListener('blur', () => {
    if (window.ws && window.ws.readyState === WebSocket.OPEN) {
      window.ws.send(JSON.stringify({
        type: 'visibility',
        state: 'hidden'
      }));
    }
  });
  
  // Get or create user
  const user = await getOrCreateUser();
  window.currentUser = user;
  
  // Wire up existing input elements
  setupInputHandlers();
}

function connectWebSocket() {
  // Use wss:// when the page is served over https://
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  window.ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  window.ws.onopen = () => {
    console.log('WebSocket connected');
    reconnectAttempts = 0;
    
    // Send user identification immediately after connection
    window.ws.send(JSON.stringify({
      type: 'identify',
      userId: window.currentUser.id,
      username: window.currentUser.username
    }));
    
    // Send initial visibility state
    window.ws.send(JSON.stringify({
      type: 'visibility',
      state: document.visibilityState,
      userId: window.currentUser.id
    }));
  };

  window.ws.onclose = async () => {
    console.log('WebSocket closed');
    if (document.visibilityState === 'visible') {
      await attemptReconnect();
    }
  };

  window.ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  window.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received message:', data);
    
    switch (data.type) {
      case 'initial':
        handleInitialMessages(data.messages);
        window.scrollToBottom();
        break;
      case 'message':
        handleNewMessage(data.message);
        break;
    }
  };
}

async function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached');
    return;
  }
  
  reconnectAttempts++;
  console.log(`Attempting to reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
  
  await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
  
  // Fetch missed messages before reconnecting
  await syncMissedMessages();
  
  // Attempt to reconnect
  connectWebSocket();
}

async function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    console.log('App became visible, checking connection...');
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('Connection lost, attempting to reconnect...');
      reconnectAttempts = 0; // Reset attempts when manually reconnecting
      await syncMissedMessages();
      connectWebSocket();
    }
  }
}

async function syncMissedMessages() {
  const lastMessage = messages[messages.length - 1];
  const lastTimestamp = lastMessage ? lastMessage.timestamp : null;
  
  try {
    const response = await fetch(`/api/messages?since=${lastTimestamp || ''}`);
    if (!response.ok) throw new Error('Failed to fetch messages');
    
    const newMessages = await response.json();
    console.log(`Synced ${newMessages.length} missed messages`);
    
    newMessages.forEach(message => {
      if (!messages.find(m => m.id === message.id)) {
        handleNewMessage(message);
      }
    });
  } catch (error) {
    console.error('Failed to sync messages:', error);
  }
}

function setupInputHandlers() {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.querySelector('.send-button');

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent new line
      const content = chatInput.value.trim();
      if (content) {
        sendMessage(content);
        chatInput.value = '';
      }
    }
  });

  sendButton.addEventListener('click', () => {
    const content = chatInput.value.trim();
    if (content) {
      sendMessage(content);
      chatInput.value = '';
    }
  });
}

function sendMessage(content, type = 'text') {
  // Create and display message immediately
  const newMessage = createNewMessage(content, type);
  const messageElement = createMessageElement(newMessage, true);
  
  // Get reference to input container
  const inputContainer = document.querySelector('.input-container');
  
  // Add message to UI and messages array
  messages.push(newMessage);
  if (inputContainer) {
    messagesContainer.insertBefore(messageElement, inputContainer);
  } else {
    messagesContainer.appendChild(messageElement);
  }

  updateMessageGrouping();

  // Send to server
  const messageData = {
    type: 'chat',
    content: {
      content: content,
      senderId: window.currentUser.id,
      senderName: window.currentUser.username,
      type: type,
      status: 'sent',
      reactions: {},
      replyTo: window.activeReplyTo ? window.activeReplyTo.id : null,
      replyToContent: window.activeReplyTo ? window.activeReplyTo.content : null
    }
  };
  
  window.ws.send(JSON.stringify(messageData));
  
  // Clear the active reply after sending
  if (window.activeReplyTo) {
    clearActiveReply();
  }

  // Keep focus on input and don't close keyboard
  const chatInput = document.getElementById('chat-input');
  chatInput.value = '';
  chatInput.focus();

  // Scroll to bottom after sending
  window.scrollToBottom();
}

function handleNewMessage(message) {
  // Only handle messages from other users
  if (message.senderId !== window.currentUser.id) {
    messages.push(message);
    const messageElement = createMessageElement(message, false);
    
    // Get reference to input container
    const inputContainer = document.querySelector('.input-container');
    
    // Check if user is near bottom before adding new message
    const isNearBottom = isUserNearBottom();
    
    // Insert new message before the input container
    if (inputContainer) {
      messagesContainer.insertBefore(messageElement, inputContainer);
    } else {
      messagesContainer.appendChild(messageElement);
    }
    
    updateMessageGrouping();
    
    // Only scroll if user was near bottom
    if (isNearBottom) {
      window.scrollToBottom();
    }
  }
}

function handleInitialMessages(initialMessages) {
  // Get reference to input container before clearing
  const inputContainer = document.querySelector('.input-container');
  
  // Clear existing messages
  messagesContainer.innerHTML = '';
  
  // Re-append the input container
  if (inputContainer) {
    messagesContainer.appendChild(inputContainer);
  }
  
  // Add all messages to the UI and our messages array
  initialMessages.forEach(message => {
    messages.push(message);
    const messageElement = createMessageElement(message, message.senderId === window.currentUser.id);
    messagesContainer.insertBefore(messageElement, inputContainer);
  });
  
  updateMessageGrouping();
}

// Helper function to check if user is near bottom
function isUserNearBottom() {
  if (!messagesContainer) return false;
  
  const threshold = 150; // pixels from bottom
  const distanceFromBottom = 
    messagesContainer.scrollHeight - 
    messagesContainer.scrollTop - 
    messagesContainer.clientHeight;
    
  console.log('Distance from bottom:', distanceFromBottom);
  return distanceFromBottom < threshold;
}

// Make scrollToBottom available globally
window.scrollToBottom = function() {
  if (messagesContainer) {
    console.log('Scrolling to bottom, height:', messagesContainer.scrollHeight);
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'smooth'
    });
  } else {
    console.error('Messages container element not found');
  }
}

function createNewMessage(content, type = 'text') {
  return {
    id: `msg_${Date.now()}`,
    content: content,
    timestamp: new Date().toISOString(),
    senderId: window.currentUser.id,
    senderName: window.currentUser.username,
    type: type,
    status: 'sent',
    reactions: {},
    replyTo: window.activeReplyTo ? window.activeReplyTo.id : null,
    replyToContent: window.activeReplyTo ? window.activeReplyTo.content : null
  };
}

async function getOrCreateUser() {
  const savedUser = localStorage.getItem('chatUser');
  if (savedUser) {
    return JSON.parse(savedUser);
  }

  const response = await fetch('/api/user');
  const user = await response.json();
  localStorage.setItem('chatUser', JSON.stringify(user));
  return user;
}

export { 
  initializeChat,
  sendMessage,
  createNewMessage,
  getOrCreateUser
};

