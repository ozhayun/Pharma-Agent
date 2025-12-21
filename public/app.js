/**
 * Main application entry point
 */

import { detectTextDirection } from './utils/dom.js';
import {
  initializeInput,
  updateInputDirection,
  updateSendButtonState,
  autoResizeTextarea,
  updateLanguageFromInput,
  getCurrentLanguage,
  getMessageInput
} from './utils/input.js';
import {
  initializeMessages,
  addMessage,
  updateMessageContent,
  showLoading,
  removeLoading
} from './ui/messages.js';
import {
  initializeContext,
  setupContextPanelHandlers,
  updateContext
} from './ui/context.js';
import {
  initializeSuggestions,
  loadSuggestions,
  renderSuggestions,
  setLanguage
} from './ui/suggestions.js';
import { sendMessage, initializeChat } from './chat/api.js';

const API_URL = window.location.origin;

let chatContainer;
let messageInput;
let sendButton;
let suggestionsBubbles;

let ctxMedication;
let ctxFlow;
let ctxStep;
let ctxLang;
let ctxMedicationDisplay;
let contextPanel;
let contextToggle;
let closeContextBtn;

function initializeApp() {
  chatContainer = document.getElementById('chatContainer');
  messageInput = document.getElementById('messageInput');
  sendButton = document.getElementById('sendButton');
  suggestionsBubbles = document.getElementById('suggestionsBubbles');

  ctxMedication = document.getElementById('ctx-medication');
  ctxFlow = document.getElementById('ctx-flow');
  ctxStep = document.getElementById('ctx-step');
  ctxLang = document.getElementById('ctx-lang');
  ctxMedicationDisplay = document.getElementById('ctx-medication-display');
  const toolHistoryContainer = document.getElementById('toolHistoryContainer');
  const medicationHistoryContainer = document.getElementById('medicationHistoryContainer');
  const flowHistoryContainer = document.getElementById('flowHistoryContainer');
  const stepHistoryContainer = document.getElementById('stepHistoryContainer');
  contextPanel = document.getElementById('contextPanel');
  contextToggle = document.getElementById('contextToggle');
  closeContextBtn = document.getElementById('closeContext');
  const tabInfo = document.getElementById('tabInfo');
  const tabHistory = document.getElementById('tabHistory');
  const tabContentInfo = document.getElementById('tabContentInfo');
  const tabContentHistory = document.getElementById('tabContentHistory');

  if (!chatContainer || !messageInput || !sendButton) return;

  initializeMessages(chatContainer, sendMessage);
  initializeInput(messageInput, sendButton, renderSuggestions);
  initializeContext({
    ctxMedication,
    ctxFlow,
    ctxStep,
    ctxLang,
    ctxMedicationDisplay,
    ctxFlowDisplay: null,
    toolHistoryContainer,
    medicationHistoryContainer,
    flowHistoryContainer,
    stepHistoryContainer,
    contextPanel,
    contextToggle,
    closeContextBtn,
    tabInfo,
    tabHistory,
    tabContentInfo,
    tabContentHistory
  });
  initializeSuggestions(suggestionsBubbles, 'en', {
    messageInput,
    autoResizeTextarea,
    updateInputDirection,
    updateLanguageFromInput,
    updateSendButtonState
  });
  initializeChat({
    updateContext: (context) => {
      return updateContext(context);
    },
    addMessage,
    updateMessageContent,
    showLoading,
    removeLoading,
    getMessageInput,
    updateInput: {
      updateInputDirection,
      updateSendButtonState
    }
  });

  sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message && !sendButton.disabled) {
      sendMessage(message);
    }
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const message = messageInput.value.trim();
      if (message && !sendButton.disabled) {
        sendMessage(message);
      }
    }
  });

  messageInput.addEventListener('input', () => {
    updateInputDirection();
    updateSendButtonState();
    updateLanguageFromInput();
    autoResizeTextarea();
    
    setLanguage(getCurrentLanguage());
  });

  fetch(`${API_URL}/config`)
    .then(res => res.json())
    .then(config => {
      if (config.isDebug === true) {
        if (contextToggle) {
          contextToggle.classList.add('debug-enabled');
        }
        setupContextPanelHandlers();
      }
    })
    .catch(() => {
    });

  messageInput.focus();
  updateSendButtonState();
  
  loadSuggestions(API_URL).then(() => {
    showWelcomeMessage();
  });
}

function showWelcomeMessage() {
  const emptyState = chatContainer.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }
  
  const loadingId = showLoading();
  
  setTimeout(() => {
    removeLoading(loadingId);
    const welcomeMessage = "Hello! I'm an AI-powered pharmacist assistant, and I'm here to help you get the information you need about medications. Is there something I can help you with?";
    addMessage('assistant', welcomeMessage);
  }, 750); 
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
