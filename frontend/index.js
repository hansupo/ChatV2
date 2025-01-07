export * from './types.js';
export * from './chat-core.js';
export * from './message-handlers.js';
export * from './ui-utils.js';
export * from './input-handlers.js';
export * from './viewport-handlers.js';
export * from './overlay-manager.js';

// Initialize everything when DOM is ready
import { createBlurOverlay } from './overlay-manager.js';
import { initializeChat } from './chat-core.js';
import { initializeViewportHandlers } from './viewport-handlers.js';
import { handleAddButtonClick } from './input-handlers.js';
import { addButton } from './types.js';
import { initializeEmojiButton } from './emoji-handler.js';
import { initializeBackground, cycleBackground } from './ui-utils.js';

document.addEventListener('DOMContentLoaded', () => {
  window.blurOverlay = createBlurOverlay();
  initializeChat();
  initializeViewportHandlers();
  addButton.addEventListener('click', handleAddButtonClick);
  initializeEmojiButton();
  initializeBackground();
  
  // Make cycleBackground available globally
  window.cycleBackground = cycleBackground;
}); 