import { initializeState } from './state.js';
import { createMessage, updateMessage } from './message.js';
import { showLoading, removeLoading } from './loading.js';
import { scrollToBottom } from './scroll.js';

export function initializeMessages(container, sendMessageFn) {
  initializeState(container, sendMessageFn);
}

export function addMessage(role, content, returnId = false) {
  return createMessage(role, content, returnId);
}

export function updateMessageContent(id, content, options = null) {
  return updateMessage(id, content, options);
}

export { showLoading, removeLoading, scrollToBottom };
