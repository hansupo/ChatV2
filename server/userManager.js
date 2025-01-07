const fs = require('fs').promises;
const path = require('path');

let usernames = [];

async function loadUsernames() {
  const data = await fs.readFile(path.join(__dirname, '../frontend/random-usernames.json'), 'utf8');
  usernames = JSON.parse(data);
}

// Load usernames when module is imported
loadUsernames();

function generateUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function createUser() {
  const randomUsername = usernames[Math.floor(Math.random() * usernames.length)];
  const userId = generateUserId();
  
  return {
    id: userId,
    username: randomUsername
  };
}

module.exports = { createUser };