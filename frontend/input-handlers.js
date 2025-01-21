import { messages, chatInput, fileInput, sendButton, messagesContainer } from './types.js';
import { createMessageElement, clearActiveReply } from './message-handlers.js';
import { sendMessage } from './chat-core.js';

// Add window resize handler
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    initializeChat();
  }, 250);
});

// Add enter key handler
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    // Always allow new lines on mobile devices
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return;
    }
    // Only desktop should auto-send on Enter
    e.preventDefault();
    sendButton.click();
  }
});

export function handleAddButtonClick(e) {
  e.preventDefault();
  // Keep keyboard visible if it's already shown
  if (window.isKeyboardVisible) {
    chatInput.focus();
  }
  fileInput.click();
}

// Add file input handler
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    fileInput.value = '';
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const { imageUrl } = await response.json();
      
      // Use the existing sendMessage function with type: 'image'
      sendMessage(imageUrl, 'image');
      
    } catch (error) {
      console.error('Error uploading image:', error);
      // TODO: Show error message to user
    }
  }
});

// Add send button handler
sendButton.addEventListener('click', (e) => {
  e.preventDefault();
  const content = chatInput.value.trim();
  if (!content) return;
  
  // Use the consolidated sendMessage function from chat-core.js
  sendMessage(content);
});
