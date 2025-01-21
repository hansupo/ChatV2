import { messages, blurOverlay, chatInput, activeReplyTo } from './types.js';
import { optimizeTextWrapping, isEmojiOnly, formatTimestamp } from './ui-utils.js';
import { openEmojiPicker } from './emoji-handler.js';

// Constants
const LONG_PRESS_DURATION = 300;
let longPressTimer;
const DEFAULT_REACTIONS = ['👍', '❤️', '😆', '😮', '😢', '😠'];
const CONSECUTIVE_BORDER_RADIUS = '0.4em';

export function createMessageElement(message, isOutgoing) {
  const messageGroup = document.createElement('div');
  messageGroup.className = `message-group ${isOutgoing ? 'outgoing' : 'incoming'}`;
  messageGroup.dataset.sender = message.senderId;
  messageGroup.dataset.timestamp = message.timestamp;
  messageGroup.style.display = 'flex';
  messageGroup.style.flexDirection = 'column';
  messageGroup.style.alignSelf = isOutgoing ? 'flex-end' : 'flex-start';
  messageGroup.style.maxWidth = '70%';
  
  // We'll handle sender info differently for incoming messages
  if (!isOutgoing && message.senderName) {
    // Create sender name container
    const senderName = document.createElement('div');
    senderName.className = 'sender-name';
    senderName.textContent = message.senderName;
    messageGroup.appendChild(senderName);
    
    // Create profile picture container (now separate)
    const profilePicContainer = document.createElement('div');
    profilePicContainer.className = 'profile-pic-container';
    
    const profilePic = document.createElement('img');
    profilePic.className = 'sender-profile-pic';
    const picFileName = message.senderName.replace(' ', '_');
    profilePic.src = `media/profile_pictures/${picFileName}.png`;
    profilePic.alt = message.senderName;
    
    profilePicContainer.appendChild(profilePic);
    messageGroup.appendChild(profilePicContainer);
  }
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
  messageElement.dataset.messageId = message.id;
  
  // Add emoji-only class if applicable
  if (message.type === 'text' && isEmojiOnly(message.content)) {
    messageElement.classList.add('emoji-only');
  }
  
  // Add reply preview if it exists
  if (message.replyTo) {
    const replyPreview = document.createElement('div');
    replyPreview.className = 'reply-preview';
    replyPreview.dataset.replyId = message.replyTo;
    
    const previewContent = document.createElement('div');
    previewContent.className = 'preview-content';
    previewContent.textContent = optimizeTextWrapping(message.replyToContent, 2);
    
    replyPreview.appendChild(previewContent);
    messageGroup.appendChild(replyPreview);
  }
  
  // Create message content
  const messageContent = createMessageContent(message);
  
  messageElement.appendChild(messageContent);
  messageGroup.appendChild(messageElement);
  

  
  // Add event listeners for long press
  messageElement.addEventListener('touchstart', handlePressStart);
  messageElement.addEventListener('touchend', handlePressEnd);
  messageElement.addEventListener('touchmove', handlePressCancel);
  // messageElement.addEventListener('mousedown', handlePressStart);
  // messageElement.addEventListener('mouseup', handlePressEnd);
  // messageElement.addEventListener('mouseleave', handlePressCancel);
  
  return messageGroup;
}

// Keep only the necessary functions for message UI handling
export function handlePressStart(e) {
  const messageElement = e.currentTarget;
  
  longPressTimer = setTimeout(() => {
    const messageId = messageElement.dataset.messageId;
    const message = messages.find(m => m.id === messageId);
    
    if (message) {
      // Get the entire message group and its position
      const messageGroup = messageElement.closest('.message-group');
      const messageRect = messageGroup.getBoundingClientRect();
      const isOutgoing = messageGroup.classList.contains('outgoing');
      
      // Create container
      const longPressContainer = document.createElement('div');
      longPressContainer.className = 'long-press-container';
      
      // Position container exactly where the message group is
      Object.assign(longPressContainer.style, {
        position: 'fixed',
        top: `${messageRect.top}px`,
        minHeight: `${messageRect.height}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      });
      
      // Create floating message (exact clone of original)
      const floatingMessage = messageGroup.cloneNode(true);
      floatingMessage.classList.add('floating-message');
      
      // Add click handler to floating message
      floatingMessage.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from bubbling to overlay
        clearLongPress();
      });
      
      // Create reaction bar
      const reactionBar = createReactionBar(message);
      reactionBar.classList.add('reaction-bar-floating');
      
      // Create message tools and add alignment class
      const toolsMenu = document.createElement('div');
      toolsMenu.className = `message-tools-floating ${isOutgoing ? 'outgoing' : 'incoming'}`;
      addMessageTools(toolsMenu, messageElement);
      
      // Add elements to container in correct order
      longPressContainer.appendChild(reactionBar);
      longPressContainer.appendChild(floatingMessage);
      longPressContainer.appendChild(toolsMenu);
      
      document.body.appendChild(longPressContainer);
      
      // Check and adjust position if needed
      const containerRect = longPressContainer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const minTopSpace = 80;
      const minBottomSpace = 150;
      
      let offsetY = 0;
      
      if (containerRect.top < minTopSpace) {
        offsetY = minTopSpace - containerRect.top;
      } else if (containerRect.bottom > viewportHeight - minBottomSpace) {
        offsetY = (viewportHeight - minBottomSpace) - containerRect.bottom;
      }
      
      if (offsetY !== 0) {
        longPressContainer.style.transform = `translateY(${offsetY}px)`;
      }
    }
    
    // Show blur overlay
    if (window.blurOverlay) {
      window.blurOverlay.classList.add('active');
    }
  }, LONG_PRESS_DURATION);
}

export function handlePressEnd(e) {
  const messageElement = e.currentTarget;
  
  // Clear the long press timer
  clearTimeout(longPressTimer);
  
  // Get the touch/click coordinates
  const touchEndX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
  const touchEndY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY;
  
  // Get the element's bounding rectangle
  const rect = messageElement.getBoundingClientRect();
  
  // Check if the touch/click ended within the message element
  const isWithinBounds = (
    touchEndX >= rect.left &&
    touchEndX <= rect.right &&
    touchEndY >= rect.top &&
    touchEndY <= rect.bottom
  );
  
  // If this was a short tap (not a long press) and ended within bounds
  if (!document.querySelector('.floating-message') && isWithinBounds) {
    const messageId = messageElement.dataset.messageId;
    const message = messages.find(m => m.id === messageId);
    
    // Toggle existing timestamp if it exists
    const existingTimestamp = messageElement.querySelector('.message-timestamp');
    if (existingTimestamp) {
      existingTimestamp.remove();
    } else {
      // Create and add new timestamp
      const timestamp = document.createElement('div');
      timestamp.className = 'message-timestamp';
      timestamp.textContent = formatTimestamp(message.timestamp);
      messageElement.appendChild(timestamp);
      
      // Auto-hide timestamp after 15 seconds
      setTimeout(() => {
        if (timestamp && timestamp.parentNode) {
          timestamp.remove();
        }
      }, 15000);
    }
  }
}

export function handlePressCancel(e) {
  clearTimeout(longPressTimer);
}

export function clearLongPress() {
  // Remove long-press container (which includes floating message, reaction bar, and tools)
  const container = document.querySelector('.long-press-container');
  if (container) {
    container.remove();
  }
  
  // Hide blur overlay
  if (window.blurOverlay) {
    window.blurOverlay.classList.remove('active');
  }
}

export function setActiveReply(messageElement) {
  clearActiveReply();
  
  const messageId = messageElement.dataset.messageId;
  const message = messages.find(m => m.id === messageId);
  
  const replyPreview = document.createElement('div');
  replyPreview.className = 'active-reply-preview';
  replyPreview.innerHTML = `
    <div class="replying-to">Replying to ${message.senderName || 'User'}:</div>
    <div class="reply-content">${message.content}</div>
    <button class="cancel-reply" tabindex="-1"></button>
  `;
  
  const cancelButton = replyPreview.querySelector('.cancel-reply');
  cancelButton.addEventListener('click', (e) => {
    e.preventDefault();
    clearActiveReply();
    // Refocus the chat input to keep keyboard open
    chatInput.focus();
  });
  
  window.activeReplyTo = {
    id: messageId,
    content: message.content
  };
  
  const inputContainer = document.querySelector('.input-container');
  inputContainer.insertAdjacentElement('afterbegin', replyPreview);
  
  chatInput.click();
  chatInput.focus();
}

export function clearActiveReply() {
  const existingPreview = document.querySelector('.active-reply-preview');
  if (existingPreview) {
    existingPreview.remove();
  }
  window.activeReplyTo = null;
}

function showReactionBar(message) {
  console.log('Showing reaction bar for message:', message);
  const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
  const messageGroup = messageElement.closest('.message-group');
  const messageRect = messageGroup.getBoundingClientRect();
  
  // Create and position reaction bar
  const reactionBar = createReactionBar(message);
  Object.assign(reactionBar.style, {
    position: 'fixed',
    top: `${messageRect.top - 70}px`, // Increased distance from message
    zIndex: '1103'
  });
  
  document.body.appendChild(reactionBar);
}

function createReactionBar(message) {
  console.log('Creating reaction bar for message:', message);
  
  const reactionBar = document.createElement('div');
  reactionBar.className = 'reaction-bar';
  
  // Add default reactions
  DEFAULT_REACTIONS.forEach(emoji => {
    console.log('Adding reaction button for emoji:', emoji);
    const reaction = document.createElement('button');
    reaction.className = 'reaction-button';
    reaction.textContent = emoji;
    reaction.addEventListener('click', () => addReaction(message, emoji));
    reactionBar.appendChild(reaction);
  });
  
  // Add custom reaction button
  const customReaction = document.createElement('button');
  customReaction.className = 'reaction-button custom-reaction';
  customReaction.textContent = '';
  customReaction.addEventListener('click', () => openEmojiPicker(message));
  reactionBar.appendChild(customReaction);
  
  return reactionBar;
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
  clearLongPress();
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
        reaction.textContent = `${emoji}`;
        reactionsContainer.appendChild(reaction);
      }
    });
    
    messageElement.appendChild(reactionsContainer);
  }
}

function showMessageTools(messageElement, container) {
  const toolsMenu = document.createElement('div');
  toolsMenu.className = 'message-tools';
  
  // Create tools with SVG icons
  const tools = [
    { 
      text: 'Reply', 
      svg: `<svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M6.4 3.80353C7.55322 2.26658 10 3.08182 10 5.00302V8.00928C14.6772 7.86093 17.7771 9.50672 19.7796 11.7657C21.8614 14.1142 22.6633 17.0184 22.9781 18.9028C23.116 19.7283 22.5806 20.3237 22.0149 20.5275C21.4711 20.7234 20.7467 20.6283 20.2749 20.0531C18.6945 18.1261 15.5 15.4884 10 15.4884V18.997C10 20.9182 7.55321 21.7334 6.4 20.1965L1.6 13.7992C0.800001 12.733 0.800001 11.267 1.6 10.2008L6.4 3.80353ZM8 5.00302L3.2 11.4003C2.93333 11.7557 2.93333 12.2443 3.2 12.5997L8 18.997V14.5C8 13.9477 8.44772 13.5 9 13.5H10C17 13.5 20.6009 17.4621 20.6009 17.4621C20.1828 16.0361 19.4749 14.4371 18.2829 13.0924C16.7183 11.3273 14.5 10 10 10H9C8.44772 10 8 9.55228 8 9V5.00302Z" fill="#FFFFFF"/>
      </svg>`,
      action: () => {
        setActiveReply(messageElement);
        clearLongPress();
      }
    },
    { 
      text: 'Copy', 
      svg: `<svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g id="Edit / Copy">
      <path id="Vector" d="M9 9V6.2002C9 5.08009 9 4.51962 9.21799 4.0918C9.40973 3.71547 9.71547 3.40973 10.0918 3.21799C10.5196 3 11.0801 3 12.2002 3H17.8002C18.9203 3 19.4801 3 19.9079 3.21799C20.2842 3.40973 20.5905 3.71547 20.7822 4.0918C21.0002 4.51962 21.0002 5.07967 21.0002 6.19978V11.7998C21.0002 12.9199 21.0002 13.48 20.7822 13.9078C20.5905 14.2841 20.2839 14.5905 19.9076 14.7822C19.4802 15 18.921 15 17.8031 15H15M9 9H6.2002C5.08009 9 4.51962 9 4.0918 9.21799C3.71547 9.40973 3.40973 9.71547 3.21799 10.0918C3 10.5196 3 11.0801 3 12.2002V17.8002C3 18.9203 3 19.4801 3.21799 19.9079C3.40973 20.2842 3.71547 20.5905 4.0918 20.7822C4.5192 21 5.07899 21 6.19691 21H11.8036C12.9215 21 13.4805 21 13.9079 20.7822C14.2842 20.5905 14.5905 20.2839 14.7822 19.9076C15 19.4802 15 18.921 15 17.8031V15M9 9H11.8002C12.9203 9 13.4801 9 13.9079 9.21799C14.2842 9.40973 14.5905 9.71547 14.7822 10.0918C15 10.5192 15 11.079 15 12.1969L15 15" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      </svg>`,
      action: () => {
        navigator.clipboard.writeText(messageElement.querySelector('.message-content').textContent);
        clearLongPress();
      }
    },
    { 
      text: 'Pin', 
      svg: `<svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.37658 15.6162L2.71973 21.273M11.6943 6.64169L10.1334 8.20258C10.0061 8.3299 9.9424 8.39357 9.86986 8.44415C9.80548 8.48905 9.73604 8.52622 9.66297 8.55488C9.58065 8.58717 9.49236 8.60482 9.3158 8.64014L5.65133 9.37303C4.69903 9.56349 4.22288 9.65872 4.00012 9.90977C3.80605 10.1285 3.71743 10.4212 3.75758 10.7108C3.80367 11.0433 4.14703 11.3866 4.83375 12.0733L11.9195 19.1591C12.6062 19.8458 12.9496 20.1891 13.282 20.2352C13.5716 20.2754 13.8643 20.1868 14.083 19.9927C14.3341 19.7699 14.4293 19.2938 14.6198 18.3415L15.3527 14.677C15.388 14.5005 15.4056 14.4122 15.4379 14.3298C15.4666 14.2568 15.5038 14.1873 15.5487 14.123C15.5992 14.0504 15.6629 13.9868 15.7902 13.8594L17.3511 12.2985C17.4325 12.2171 17.4732 12.1764 17.518 12.1409C17.5577 12.1093 17.5998 12.0808 17.6439 12.0557C17.6935 12.0273 17.7464 12.0046 17.8522 11.9593L20.3466 10.8903C21.0743 10.5784 21.4381 10.4225 21.6034 10.1705C21.7479 9.95013 21.7996 9.68163 21.7473 9.42335C21.6874 9.12801 21.4075 8.8481 20.8477 8.28827L15.7045 3.14514C15.1447 2.58531 14.8648 2.3054 14.5695 2.24552C14.3112 2.19317 14.0427 2.24488 13.8223 2.38941C13.5703 2.55469 13.4144 2.91854 13.1025 3.64624L12.0335 6.14059C11.9882 6.24641 11.9655 6.29932 11.9372 6.34893C11.912 6.393 11.8835 6.4351 11.8519 6.47484C11.8164 6.51958 11.7757 6.56029 11.6943 6.64169Z" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      action: () => {
        // TODO: Implement pin functionality
        clearLongPress();
      }
    }
  ];

  tools.forEach(tool => {
    const button = document.createElement('button');
    button.className = 'message-tool-button';
    button.innerHTML = `
      <span class="tool-text">${tool.text}</span>
      <span class="tool-icon">${tool.svg}</span>
    `;
    button.addEventListener('click', tool.action);
    toolsMenu.appendChild(button);
  });

  Object.assign(toolsMenu.style, {
    position: 'absolute',
    top: '100%',
    marginTop: '10px',
    left: messageElement.classList.contains('outgoing') ? 'auto' : '0',
    right: messageElement.classList.contains('outgoing') ? '0' : 'auto'
  });
  
  container.appendChild(toolsMenu);
}

// Helper function to add message tools
function addMessageTools(toolsMenu, messageElement) {
  const tools = [
    { 
      text: 'Reply', 
      svg: `<svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M6.4 3.80353C7.55322 2.26658 10 3.08182 10 5.00302V8.00928C14.6772 7.86093 17.7771 9.50672 19.7796 11.7657C21.8614 14.1142 22.6633 17.0184 22.9781 18.9028C23.116 19.7283 22.5806 20.3237 22.0149 20.5275C21.4711 20.7234 20.7467 20.6283 20.2749 20.0531C18.6945 18.1261 15.5 15.4884 10 15.4884V18.997C10 20.9182 7.55321 21.7334 6.4 20.1965L1.6 13.7992C0.800001 12.733 0.800001 11.267 1.6 10.2008L6.4 3.80353ZM8 5.00302L3.2 11.4003C2.93333 11.7557 2.93333 12.2443 3.2 12.5997L8 18.997V14.5C8 13.9477 8.44772 13.5 9 13.5H10C17 13.5 20.6009 17.4621 20.6009 17.4621C20.1828 16.0361 19.4749 14.4371 18.2829 13.0924C16.7183 11.3273 14.5 10 10 10H9C8.44772 10 8 9.55228 8 9V5.00302Z" fill="#FFFFFF"/>
      </svg>`,
      action: () => {
        setActiveReply(messageElement);
        clearLongPress();
      }
    },
    { 
      text: 'Copy', 
      svg: `<svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g id="Edit / Copy">
      <path id="Vector" d="M9 9V6.2002C9 5.08009 9 4.51962 9.21799 4.0918C9.40973 3.71547 9.71547 3.40973 10.0918 3.21799C10.5196 3 11.0801 3 12.2002 3H17.8002C18.9203 3 19.4801 3 19.9079 3.21799C20.2842 3.40973 20.5905 3.71547 20.7822 4.0918C21.0002 4.51962 21.0002 5.07967 21.0002 6.19978V11.7998C21.0002 12.9199 21.0002 13.48 20.7822 13.9078C20.5905 14.2841 20.2839 14.5905 19.9076 14.7822C19.4802 15 18.921 15 17.8031 15H15M9 9H6.2002C5.08009 9 4.51962 9 4.0918 9.21799C3.71547 9.40973 3.40973 9.71547 3.21799 10.0918C3 10.5196 3 11.0801 3 12.2002V17.8002C3 18.9203 3 19.4801 3.21799 19.9079C3.40973 20.2842 3.71547 20.5905 4.0918 20.7822C4.5192 21 5.07899 21 6.19691 21H11.8036C12.9215 21 13.4805 21 13.9079 20.7822C14.2842 20.5905 14.5905 20.2839 14.7822 19.9076C15 19.4802 15 18.921 15 17.8031V15M9 9H11.8002C12.9203 9 13.4801 9 13.9079 9.21799C14.2842 9.40973 14.5905 9.71547 14.7822 10.0918C15 10.5192 15 11.079 15 12.1969L15 15" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      </svg>`,
      action: () => {
        navigator.clipboard.writeText(messageElement.querySelector('.message-content').textContent);
        clearLongPress();
      }
    },
    { 
      text: 'Pin', 
      svg: `<svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.37658 15.6162L2.71973 21.273M11.6943 6.64169L10.1334 8.20258C10.0061 8.3299 9.9424 8.39357 9.86986 8.44415C9.80548 8.48905 9.73604 8.52622 9.66297 8.55488C9.58065 8.58717 9.49236 8.60482 9.3158 8.64014L5.65133 9.37303C4.69903 9.56349 4.22288 9.65872 4.00012 9.90977C3.80605 10.1285 3.71743 10.4212 3.75758 10.7108C3.80367 11.0433 4.14703 11.3866 4.83375 12.0733L11.9195 19.1591C12.6062 19.8458 12.9496 20.1891 13.282 20.2352C13.5716 20.2754 13.8643 20.1868 14.083 19.9927C14.3341 19.7699 14.4293 19.2938 14.6198 18.3415L15.3527 14.677C15.388 14.5005 15.4056 14.4122 15.4379 14.3298C15.4666 14.2568 15.5038 14.1873 15.5487 14.123C15.5992 14.0504 15.6629 13.9868 15.7902 13.8594L17.3511 12.2985C17.4325 12.2171 17.4732 12.1764 17.518 12.1409C17.5577 12.1093 17.5998 12.0808 17.6439 12.0557C17.6935 12.0273 17.7464 12.0046 17.8522 11.9593L20.3466 10.8903C21.0743 10.5784 21.4381 10.4225 21.6034 10.1705C21.7479 9.95013 21.7996 9.68163 21.7473 9.42335C21.6874 9.12801 21.4075 8.8481 20.8477 8.28827L15.7045 3.14514C15.1447 2.58531 14.8648 2.3054 14.5695 2.24552C14.3112 2.19317 14.0427 2.24488 13.8223 2.38941C13.5703 2.55469 13.4144 2.91854 13.1025 3.64624L12.0335 6.14059C11.9882 6.24641 11.9655 6.29932 11.9372 6.34893C11.912 6.393 11.8835 6.4351 11.8519 6.47484C11.8164 6.51958 11.7757 6.56029 11.6943 6.64169Z" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      action: () => {
        // TODO: Implement pin functionality
        clearLongPress();
      }
    }
  ];

  tools.forEach(tool => {
    const button = document.createElement('button');
    button.className = 'message-tool-button';
    button.innerHTML = `
      <span class="tool-text">${tool.text}</span>
      <span class="tool-icon">${tool.svg}</span>
    `;
    button.addEventListener('click', tool.action);
    toolsMenu.appendChild(button);
  });
}

export function updateMessageGrouping() {
  const messageGroups = document.querySelectorAll('.message-group');
  
  messageGroups.forEach((group, index) => {
    // Reset all border radius modifications first
    const message = group.querySelector('.message');
    message.style.borderTopLeftRadius = '';
    message.style.borderBottomLeftRadius = '';
    message.style.borderTopRightRadius = '';
    message.style.borderBottomRightRadius = '';
    message.style.marginBottom = ''; // Reset margin
    
    const isOutgoing = group.classList.contains('outgoing');
    const previousGroup = index > 0 ? messageGroups[index - 1] : null;
    const nextGroup = index < messageGroups.length - 1 ? messageGroups[index + 1] : null;
    
    // Check consecutive status with previous and next messages
    const isPreviousConsecutive = previousGroup && 
      previousGroup.dataset.sender === group.dataset.sender &&
      (new Date(group.dataset.timestamp) - new Date(previousGroup.dataset.timestamp)) < 120000;
    
    const isNextConsecutive = nextGroup && 
      nextGroup.dataset.sender === group.dataset.sender &&
      (new Date(nextGroup.dataset.timestamp) - new Date(group.dataset.timestamp)) < 120000;
    
    // Handle single messages (not part of a consecutive group)
    if (!isPreviousConsecutive && !isNextConsecutive) {
      message.style.marginBottom = '1em';
    }

    
    // Apply border radius based on position in consecutive chain
    if (isOutgoing) {
      if (isPreviousConsecutive && isNextConsecutive) {
        // Middle message
        message.style.borderTopRightRadius = CONSECUTIVE_BORDER_RADIUS;
        message.style.borderBottomRightRadius = CONSECUTIVE_BORDER_RADIUS;
      } else if (isPreviousConsecutive) {
        // Last message in chain
        message.style.borderTopRightRadius = CONSECUTIVE_BORDER_RADIUS;
        message.style.marginBottom = '1em'; // Add margin to last message in chain
      } else if (isNextConsecutive) {
        // First message in chain
        message.style.borderBottomRightRadius = CONSECUTIVE_BORDER_RADIUS;
      }
    } else {
      if (isPreviousConsecutive && isNextConsecutive) {
        // Middle message
        message.style.borderTopLeftRadius = CONSECUTIVE_BORDER_RADIUS;
        message.style.borderBottomLeftRadius = CONSECUTIVE_BORDER_RADIUS;
      } else if (isPreviousConsecutive) {
        // Last message in chain
        message.style.borderTopLeftRadius = CONSECUTIVE_BORDER_RADIUS;
        message.style.marginBottom = '1em'; // Add margin to last message in chain
      } else if (isNextConsecutive) {
        // First message in chain
        message.style.borderBottomLeftRadius = CONSECUTIVE_BORDER_RADIUS;
      }
    }
    
    // Handle sender info components separately
    const senderName = group.querySelector('.sender-name');
    const profilePic = group.querySelector('.sender-profile-pic');
    
    if (senderName) {
      // Keep original behavior for sender name - show only on first message in chain
      senderName.style.display = isPreviousConsecutive ? 'none' : '';
    }
    
    if (profilePic) {
      // Show profile pic if it's the last message in chain or a single message
      profilePic.style.display = !isNextConsecutive ? '' : 'none';
    }
  });
}

function createMessageContent(message) {
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  if (message.type === 'image') {
    const img = document.createElement('img');
    img.src = message.content;
    img.className = 'message-image';
    img.alt = 'Sent image';
    
    // Add loading state
    img.style.opacity = '0.5';
    img.onload = () => {
      img.style.opacity = '1';
      // Scroll to bottom after image loads
      window.scrollToBottom();
    };
    
    messageContent.appendChild(img);
  } else {
    if (isEmojiOnly(message.content)) {
      messageContent.textContent = message.content;
    } else {
      // First optimize text wrapping
      const wrappedContent = optimizeTextWrapping(message.content, 1);
      
      // Then convert URLs to clickable links
      const linkedContent = wrappedContent.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );
      messageContent.innerHTML = linkedContent;
      
      // Add click handler for all links
      const links = messageContent.querySelectorAll('a');
      links.forEach(link => {
        link.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent message interaction when clicking links
        });
      });
    }
  }
  
  return messageContent;
}
