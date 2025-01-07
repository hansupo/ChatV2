// Export utility functions
export function calculateMaxWidth() {
  const windowWidth = window.innerWidth;
  // For mobile (~375px) we want around 20-25 chars for optimal bubble shape
  return Math.floor(windowWidth * 0.06); // Further reduced for more compact bubbles
}

export function optimizeTextWrapping(text, widthModifier = 1) {
  // First split into lines to count them
  const lines = text.split('\n');
  // If more than 4 lines, return the original text without optimization
  if (lines.length > 4) {
    return text;
  }
  
  // Dynamic width adjustment based on content length
  let dynamicModifier;
  if (text.length < 50) {
    dynamicModifier = 1; // Most compact for short messages
  } else if (lines.length > 2) {
    dynamicModifier = 3; // Wider for longer messages
  } else {
    dynamicModifier = 1.5; // Medium width for medium messages
  }
  
  const maxWidth = calculateMaxWidth() * dynamicModifier * widthModifier;
  const words = text.split(' ');
  let optimizedLines = [];
  let currentLine = [];
  let currentWidth = 0;
  
  words.forEach(word => {
    const wordWidth = word.length;
    
    if (currentWidth + wordWidth <= maxWidth) {
      currentLine.push(word);
      currentWidth += wordWidth + 1;
    } else {
      if (currentLine.length > 0) {
        optimizedLines.push(currentLine.join(' '));
      }
      currentLine = [word];
      currentWidth = wordWidth;
    }
  });
  
  if (currentLine.length > 0) {
    optimizedLines.push(currentLine.join(' '));
  }
  
  return optimizedLines.join('\n');
}

export function isEmojiOnly(text) { 
  // Remove variation selectors and zero-width joiners
  const strippedText = text.replace(/[\uFE00-\uFE0F\u200D]/g, '');
  
  // Check if each remaining character is an emoji
  const isEmoji = Array.from(strippedText).every(char => {
    const code = char.codePointAt(0);
    return (
      // Basic emoji & symbols
      (code >= 0x2600 && code <= 0x27BF) ||
      // Supplemental symbols and pictographs
      (code >= 0x1F300 && code <= 0x1F9FF) ||
      // Emoticons
      (code >= 0x1F600 && code <= 0x1F64F) ||
      // Transport and map symbols
      (code >= 0x1F680 && code <= 0x1F6FF) ||
      // Misc symbols
      (code >= 0x2300 && code <= 0x23FF) ||
      // Dingbats
      (code >= 0x2700 && code <= 0x27BF)
    );
  });
  
  return isEmoji;
}

export function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Check if the message is from today
  if (date.toDateString() === now.toDateString()) {
    return time;
  } else {
    // For different days, include the date
    // Format: "Jan 15, 12:34"
    const dateStr = date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric'
    });
    return `${dateStr}, ${time}`;
  }
}

let backgrounds = [];
let currentBgIndex = 0;

export async function initializeBackground() {
  try {
    // Fetch available backgrounds from server
    const response = await fetch('/api/backgrounds');
    backgrounds = await response.json();
    
    // Get DOM elements
    const select = document.getElementById('background-select');
    const bgButton = document.querySelector('.background-button');
    
    // Detect platform
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Populate dropdown
    backgrounds.forEach((bg, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = bg.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      select.appendChild(option);
    });
    
    // Load saved index or default to 0
    const savedIndex = localStorage.getItem('currentBgIndex');
    if (savedIndex !== null) {
      currentBgIndex = parseInt(savedIndex);
      if (currentBgIndex >= backgrounds.length) {
        currentBgIndex = 0;
      }
    }
    
    // Set initial background and dropdown value
    if (backgrounds.length > 0) {
      select.value = currentBgIndex;
      setBackground(backgrounds[currentBgIndex]);
    }
    
    // Add click event listener to button
    bgButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (isAndroid) {
        // For Android, show the select element and let the native UI handle it
        select.hidden = false;
        select.focus();
      } else {
        // For iOS and desktop, trigger the dropdown directly
        select.hidden = false;
        select.focus();
        select.click();
      }
    });
    
    // Hide select when an option is chosen
    select.addEventListener('change', (e) => {
      currentBgIndex = parseInt(e.target.value);
      setBackground(backgrounds[currentBgIndex]);
      localStorage.setItem('currentBgIndex', currentBgIndex.toString());
      select.hidden = true;
    });
    
    // Hide select when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target !== bgButton && e.target !== select) {
        select.hidden = true;
      }
    });
    
    // Prevent select from closing when clicking inside it
    select.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
  } catch (error) {
    console.error('Failed to load backgrounds:', error);
  }
}

export function cycleBackground() {
  if (backgrounds.length === 0) return;
  
  currentBgIndex = (currentBgIndex + 1) % backgrounds.length;
  const select = document.getElementById('background-select');
  select.value = currentBgIndex;
  setBackground(backgrounds[currentBgIndex]);
  localStorage.setItem('currentBgIndex', currentBgIndex.toString());
}

// Helper function to try both PNG and JPG
function setBackground(bgName) {
  const topGradient = `linear-gradient(
    to top,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.1) 25%,
    rgba(0, 0, 0, 0.75) 88%,
    rgba(0, 0, 0, 0.75) 100%
  )`;

  const bottomGradient = `linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.1) 25%,
    rgba(0, 0, 0, 0.75) 88%,
    rgba(0, 0, 0, 0.75) 100%
  )`;

  const img = new Image();
  img.onload = () => {
    document.body.style.backgroundImage = `${topGradient}, ${bottomGradient}, url('/media/backgrounds/${bgName}.png')`;
  };
  img.onerror = () => {
    document.body.style.backgroundImage = `${topGradient}, ${bottomGradient}, url('/media/backgrounds/${bgName}.jpg')`;
  };
  img.src = `/media/backgrounds/${bgName}.png`;
}
