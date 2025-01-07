// Shared state variables
export let messages = [];
export let activeReplyTo = null;
export let blurOverlay = null;
export let isKeyboardVisible = false;

// DOM elements
export const messagesContainer = document.querySelector('.messages-content');
export const chatInput = document.getElementById('chat-input');
export const sendButton = document.querySelector('.send-button');
export const addButton = document.querySelector('.add-button');
export const fileInput = document.getElementById('file-input');