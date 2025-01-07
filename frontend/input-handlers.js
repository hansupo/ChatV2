import { messages, chatInput, fileInput, sendButton, messagesContainer } from './types.js';
import { createMessageElement, clearActiveReply } from './message-handlers.js';

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
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return;
    }
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
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    fileInput.value = '';
    // TODO: Handle file upload
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
