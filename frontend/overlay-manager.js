import { blurOverlay } from './types.js';
import { clearLongPress } from './message-handlers.js';

export function createBlurOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'blur-overlay';
  document.body.appendChild(overlay);
  
  // Add click handler to close overlay
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      clearLongPress();
    }
  });
  
  return overlay;
}
