import { getChatContainer } from './state.js';

export function disableAllOptionBubbles() {
  const chatContainer = getChatContainer();
  if (!chatContainer) return;
  const allBubbles = chatContainer.querySelectorAll('.message-option-bubble');
  allBubbles.forEach(bubble => {
    bubble.classList.add('disabled');
    bubble.onclick = null;
  });
}

export function disableBubblesInContainer(container) {
  const bubbles = container.querySelectorAll('.message-option-bubble');
  bubbles.forEach(bubble => {
    bubble.classList.add('disabled');
    bubble.onclick = null;
  });
}

export function createOptionBubbles(options, onSelect) {
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'message-options';
  
  options.forEach(option => {
    const bubble = document.createElement('div');
    bubble.className = 'message-option-bubble';
    bubble.textContent = option;
    bubble.onclick = () => {
      disableBubblesInContainer(optionsContainer);
      if (onSelect) {
        onSelect(option);
      }
    };
    optionsContainer.appendChild(bubble);
  });
  
  return optionsContainer;
}
