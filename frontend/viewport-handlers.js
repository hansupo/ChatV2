import { isKeyboardVisible } from './types.js';

export function initializeViewportHandlers() {
  if (window.visualViewport) {
    let lastHeight = window.innerHeight;
    
    window.visualViewport.addEventListener('resize', () => {
      const inputContainer = document.querySelector('.input-container');
      const heightDifference = lastHeight - window.visualViewport.height;
      
      window.isKeyboardVisible = heightDifference > 150;
      
      if (window.isKeyboardVisible) {
        inputContainer.style.paddingBottom = '0.5em';
      } else {
        if (window.matchMedia('(display-mode: standalone)').matches) {
          inputContainer.style.paddingBottom = '2.25em';
        } else {
          inputContainer.style.paddingBottom = '0.5em';
        }
      }
      
      lastHeight = window.visualViewport.height;
    });
  }
  
  const inputContainer = document.querySelector('.input-container');
  if (window.matchMedia('(display-mode: standalone)').matches && !window.isKeyboardVisible) {
    inputContainer.style.paddingBottom = '2.25em';
  }
}