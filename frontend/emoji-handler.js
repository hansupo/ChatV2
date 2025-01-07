import { EmojiButton } from 'https://cdn.jsdelivr.net/npm/@joeattardi/emoji-button@4.6.4/dist/index.js';
import { clearLongPress } from './message-handlers.js';

export function initializeEmojiButton() {
  const button = document.querySelector('.emoji-button');
  const picker = new EmojiButton({
    position: 'top-start',
    theme: 'auto',
    autoHide: false,
    autoFocusSearch: false,
    style: {
      // Make picker smaller and more compact
      width: '280px',
      height: '320px',
      // Customize emoji size
      emojiSize: '1.3rem',
      // Add some custom CSS
      cssVars: {
        '--category-button-height': '2rem',
        '--font-size': '0.9rem',
        '--emoji-padding': '0.3rem',
        '--category-font-size': '0.8rem',
        '--search-height': '2rem'
      }
    },
    // Limit number of emojis per row
    emojisPerRow: 6,
    // Show fewer categories
    categories: ['smileys', 'people', 'animals', 'activities', 'objects', 'flags']
  });

  picker.on('emoji', selection => {
    const chatInput = document.getElementById('chat-input');
    // Get cursor position
    const startPos = chatInput.selectionStart;
    const endPos = chatInput.selectionEnd;
    
    // Insert emoji at cursor position
    const before = chatInput.value.substring(0, startPos);
    const after = chatInput.value.substring(endPos, chatInput.value.length);
    chatInput.value = before + selection.emoji + after;
    
    // Move cursor after emoji
    const newPos = startPos + selection.emoji.length;
    chatInput.setSelectionRange(newPos, newPos);
    
    // Focus back on input
    chatInput.focus();
  });

  button.addEventListener('click', () => {
    picker.togglePicker(button);
  });
}

// Add this function to handle custom reactions
export function openEmojiPicker(message) {
  console.log('Opening emoji picker for message:', message);
  const picker = new EmojiButton({
    position: 'top-start',
    theme: 'light',
    autoHide: false,
    autoFocusSearch: false,
    style: {
      width: '280px',
      height: '320px',
      emojiSize: '1.3rem'
    }
  });

  picker.on('emoji', selection => {
    console.log('Emoji selected:', selection.emoji);
    addReaction(message, selection.emoji);
    picker.hidePicker();
    clearLongPress(); // Clear the long press state after adding reaction
  });

  const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
  const customButton = messageElement.querySelector('.custom-reaction');
  picker.togglePicker(customButton);
}

function addReaction(message, emoji) {
  if (!message.reactions) {
    message.reactions = {};
  }
  
  // Add or remove reaction
  const currentUser = 'user_1'; // Replace with actual user ID
  if (message.reactions[emoji]?.includes(currentUser)) {
    message.reactions[emoji] = message.reactions[emoji].filter(id => id !== currentUser);
    if (message.reactions[emoji].length === 0) {
      delete message.reactions[emoji];
    }
  } else {
    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }
    message.reactions[emoji].push(currentUser);
  }
  
  updateReactionDisplay(message);
}

function updateReactionDisplay(messageData) {
  const messageElement = document.querySelector(`[data-message-id="${messageData.id}"]`);
  const existingReactions = messageElement.querySelector('.message-reactions');
  if (existingReactions) {
    existingReactions.remove();
  }
  
  if (messageData.reactions && Object.keys(messageData.reactions).length > 0) {
    const reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    
    Object.entries(messageData.reactions).forEach(([emoji, users]) => {
      if (users.length > 0) {
        const reaction = document.createElement('div');
        reaction.className = 'reaction';
        reaction.textContent = `${emoji} ${users.length}`;
        reactionsContainer.appendChild(reaction);
      }
    });
    
    messageElement.appendChild(reactionsContainer);
  }
} 