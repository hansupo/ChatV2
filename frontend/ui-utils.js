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

let isDarkMode = localStorage.getItem('darkMode') === 'true';
let currentBackground = localStorage.getItem('currentBackground') || 'none';
let gradientColor = localStorage.getItem('gradientColor') || (isDarkMode ? '#000000' : '#ffffff');
let gradientOpacity = parseFloat(localStorage.getItem('gradientOpacity') || '1');

function getRGBFromHex(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

function getGradients(isDark) {
    // Always use the selected gradient color, regardless of dark/light mode
    const color = getRGBFromHex(gradientColor);
    
    const topGradient = `linear-gradient(
        to top,
        rgba(${color}, 0) 0%,
        rgba(${color}, ${gradientOpacity * 0.1}) 25%,
        rgba(${color}, ${gradientOpacity}) 88%,
        rgba(${color}, ${gradientOpacity}) 100%
    )`;

    const bottomGradient = `linear-gradient(
        to bottom,
        rgba(${color}, 0) 0%,
        rgba(${color}, ${gradientOpacity * 0.1}) 25%,
        rgba(${color}, ${gradientOpacity}) 88%,
        rgba(${color}, ${gradientOpacity}) 100%
    )`;
    
    return { topGradient, bottomGradient };
}

export function setGradientColor(color) {
    gradientColor = color;
    setBackground(currentBackground);
}

export function setBackground(bgName) {
    const { topGradient, bottomGradient } = getGradients(isDarkMode);
    currentBackground = bgName;
    localStorage.setItem('currentBackground', bgName);

    if (!bgName || bgName === 'none') {
        const backgroundColor = isDarkMode ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
        document.body.style.backgroundColor = backgroundColor;
        document.body.style.backgroundImage = `${topGradient}, ${bottomGradient}`;
        return;
    }

    const img = new Image();
    img.onload = () => {
        document.body.style.backgroundImage = `${topGradient}, ${bottomGradient}, url('/media/backgrounds/${bgName}.png')`;
    };
    img.onerror = () => {
        document.body.style.backgroundImage = `${topGradient}, ${bottomGradient}, url('/media/backgrounds/${bgName}.jpg')`;
    };
    img.src = `/media/backgrounds/${bgName}.png`;
}

export function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    setBackground(currentBackground);
    document.body.classList.toggle('dark-mode');
}

export function setGradientOpacity(opacity) {
    gradientOpacity = opacity;
    setBackground(currentBackground);
}
