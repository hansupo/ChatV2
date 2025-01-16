const fs = require('fs').promises;
const path = require('path');

const SUBSCRIPTIONS_FILE = path.join(__dirname, 'data', 'subscriptions.json');
const subscriptions = new Map(); // userId -> PushSubscription

// Ensure the data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load subscriptions from file
async function loadSubscriptions() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(SUBSCRIPTIONS_FILE, 'utf8');
    const loaded = JSON.parse(data);
    
    // Convert the plain object back to Map
    Object.entries(loaded).forEach(([userId, subscription]) => {
      subscriptions.set(userId, subscription);
    });
    
    console.log(`Loaded ${subscriptions.size} push subscriptions`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading subscriptions:', error);
    }
  }
}

// Save subscriptions to file
async function saveSubscriptions() {
  try {
    await ensureDataDirectory();
    // Convert Map to plain object for JSON serialization
    const data = Object.fromEntries(subscriptions);
    await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(data, null, 2));
    console.log(`Saved ${subscriptions.size} push subscriptions`);
  } catch (error) {
    console.error('Error saving subscriptions:', error);
  }
}

// Load subscriptions on startup
loadSubscriptions();

function addSubscription(userId, subscription) {
  subscriptions.set(userId, subscription);
  saveSubscriptions(); // Save after adding
}

function removeSubscription(userId) {
  subscriptions.delete(userId);
  saveSubscriptions(); // Save after removing
}

function getSubscription(userId) {
  return subscriptions.get(userId);
}

function getAllSubscriptions() {
  return Array.from(subscriptions.entries());
}

module.exports = {
  addSubscription,
  removeSubscription,
  getSubscription,
  getAllSubscriptions
}; 