import { detectTextDirection } from './dom.js';
import { getIsWaitingForResponse } from '../chat/api.js';

let messageInput;
let sendButton;
let currentLanguage = 'en';
let renderSuggestionsCallback;

export function initializeInput(inputElement, buttonElement, onLanguageChange) {
  messageInput = inputElement;
  sendButton = buttonElement;
  renderSuggestionsCallback = onLanguageChange;
}

export function updateInputDirection() {
  if (!messageInput) return;
  const dir = detectTextDirection(messageInput.value);
  messageInput.style.direction = dir;
  messageInput.style.textAlign = dir === 'rtl' ? 'right' : 'left';
}

export function updateSendButtonState() {
  if (!sendButton || !messageInput) return;
  const waiting = getIsWaitingForResponse();
  sendButton.disabled = messageInput.value.trim().length === 0 || waiting;
}

export function autoResizeTextarea() {
  if (!messageInput) return;
  messageInput.style.height = 'auto';
  const newHeight = Math.min(messageInput.scrollHeight, 200); 
  messageInput.style.height = `${newHeight}px`;
}

export function updateLanguageFromInput() {
  if (!messageInput) return;
  const isHebrew = /[\u0590-\u05FF]/.test(messageInput.value);
  const detectedLang = isHebrew ? 'he' : 'en';

  if (detectedLang !== currentLanguage) {
    currentLanguage = detectedLang;
    if (renderSuggestionsCallback) {
      renderSuggestionsCallback(); 
    }
  }
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function getMessageInput() {
  return messageInput;
}

