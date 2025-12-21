let chatContainer = null;
let sendMessageCallback = null;

export function getChatContainer() {
  return chatContainer;
}

export function getSendMessageCallback() {
  return sendMessageCallback;
}

export function initializeState(container, callback) {
  chatContainer = container;
  sendMessageCallback = callback;
}

