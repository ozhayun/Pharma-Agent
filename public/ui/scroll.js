import { getChatContainer } from './state.js';

export function scrollToBottom() {
  const chatContainer = getChatContainer();
  if (!chatContainer) return;
  void chatContainer.offsetHeight;
  chatContainer.scrollTop = chatContainer.scrollHeight;
  requestAnimationFrame(() => {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  });
}

export function forceLayoutAndScroll(callback) {
  const chatContainer = getChatContainer();
  requestAnimationFrame(() => {
    void chatContainer?.offsetHeight;
    requestAnimationFrame(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
        requestAnimationFrame(() => {
          chatContainer.scrollTop = chatContainer.scrollHeight;
          if (callback) callback();
        });
      }
    });
  });
}
