let messages = [];
const MAX_MESSAGES = 100;

async function getMessages() {
  return messages;
}

async function getMessagesSince(timestamp) {
  if (!timestamp) {
    return messages;
  }
  
  // Convert timestamp to Date object for comparison
  const sinceDate = new Date(timestamp);
  
  // Filter messages that are newer than the provided timestamp
  return messages.filter(message => {
    const messageDate = new Date(message.timestamp);
    return messageDate > sinceDate;
  });
}

async function addMessage(messageData) {
  const message = {
    id: `msg_${Date.now()}`,
    ...messageData,
    timestamp: new Date().toISOString(),
    status: 'sent',
    reactions: messageData.reactions || {},
    // Preserve reply information
    replyTo: messageData.replyTo || null,
    replyToContent: messageData.replyToContent || null
  };

  messages.push(message);

  // Keep only last MAX_MESSAGES
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(-MAX_MESSAGES);
  }

  return message;
}

module.exports = { 
  getMessages, 
  addMessage,
  getMessagesSince  // Export the new function
};
