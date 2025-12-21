import { detectTextDirection } from '../utils/dom.js';
import { parseOptions } from './options.js';
import { createOptionBubbles, disableAllOptionBubbles } from './bubbles.js';
import { forceLayoutAndScroll } from './scroll.js';
import { getChatContainer, getSendMessageCallback } from './state.js';

function createAvatar(role) {
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  const avatarImg = document.createElement('img');
  avatarImg.src = role === 'user' ? '/icons/icon-user.webp' : '/icons/icon-ai-agent.webp';
  avatarImg.alt = role === 'user' ? 'User' : 'AI Agent';
  avatar.appendChild(avatarImg);
  return avatar;
}

function createContentDiv(text, isHebrew) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.setAttribute('dir', isHebrew ? 'rtl' : 'ltr');
  const normalizedText = text.replace(/\n{3,}/g, '\n\n');
  contentDiv.textContent = normalizedText || '';
  return contentDiv;
}

function createMessageWrapper(contentDiv, options, role) {
  const messageWrapper = document.createElement('div');
  messageWrapper.className = 'message-wrapper';
  messageWrapper.appendChild(contentDiv);

  if (options && options.length >= 2 && role === 'assistant') {
    disableAllOptionBubbles();
    const sendMessageCallback = getSendMessageCallback();
    const optionsContainer = createOptionBubbles(options, sendMessageCallback);
    messageWrapper.appendChild(optionsContainer);
  }

  return messageWrapper;
}

export function createMessage(role, content, returnId = false) {
  const chatContainer = getChatContainer();
  if (!chatContainer) return;
  
  const emptyState = chatContainer.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const parsed = role === 'assistant' ? parseOptions(content) : { text: content, options: null };
  const displayText = parsed.text || content;
  const options = parsed.options;
  const isHebrew = detectTextDirection(displayText) === 'rtl';
  const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.id = id;

  const avatar = createAvatar(role);
  const contentDiv = createContentDiv(displayText, isHebrew);
  const messageWrapper = createMessageWrapper(contentDiv, options, role);

  if (role === 'user') {
    div.appendChild(messageWrapper);
    div.appendChild(avatar);
  } else {
    div.appendChild(avatar);
    div.appendChild(messageWrapper);
  }

  chatContainer.appendChild(div);
  forceLayoutAndScroll();

  return returnId ? id : undefined;
}

function ensureMessageStructure(div) {
  let messageWrapper = div.querySelector('.message-wrapper');
  let contentDiv = div.querySelector('.message-content');
  
  if (!contentDiv) {
    if (!messageWrapper) {
      messageWrapper = document.createElement('div');
      messageWrapper.className = 'message-wrapper';
      div.appendChild(messageWrapper);
    }
    contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    messageWrapper.appendChild(contentDiv);
  }
  
  if (!messageWrapper) {
    messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';
    
    if (contentDiv && contentDiv.parentNode) {
      contentDiv.parentNode.replaceChild(messageWrapper, contentDiv);
      messageWrapper.appendChild(contentDiv);
    } else {
      contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      messageWrapper.appendChild(contentDiv);
    }
    
    const avatar = div.querySelector('.message-avatar');
    if (avatar) {
      if (div.classList.contains('user')) {
        div.insertBefore(messageWrapper, avatar);
      } else {
        div.appendChild(messageWrapper);
      }
    }
  } else {
    contentDiv = messageWrapper.querySelector('.message-content');
  }
  
  return { messageWrapper, contentDiv };
}

export function updateMessage(id, content, optionsFromStream = null) {
  const chatContainer = getChatContainer();
  if (!chatContainer) return;
  const div = document.getElementById(id);
  if (!div) return;
  
  const isAssistant = div.classList.contains('assistant');
  
  if (isAssistant) {
    const parsed = parseOptions(content);
    const displayText = parsed.text || content;
    const options = (optionsFromStream !== null && optionsFromStream !== undefined) 
      ? optionsFromStream 
      : parsed.options;
    
    const { messageWrapper, contentDiv } = ensureMessageStructure(div);
    
    requestAnimationFrame(() => {
      if (contentDiv) {
        contentDiv.textContent = displayText;
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    });
    
    if (contentDiv) {
      const normalizedText = displayText.replace(/\n{3,}/g, '\n\n');
      
      requestAnimationFrame(() => {
        contentDiv.textContent = normalizedText;
        contentDiv.setAttribute('dir', detectTextDirection(displayText) === 'rtl' ? 'rtl' : 'ltr');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      });
    }
    
    const existingOptions = messageWrapper.querySelector('.message-options');
    if (existingOptions) {
      existingOptions.remove();
    }
    
    if (options && options.length >= 2) {
      disableAllOptionBubbles();
      const sendMessageCallback = getSendMessageCallback();
      const optionsContainer = createOptionBubbles(options, sendMessageCallback);
      messageWrapper.appendChild(optionsContainer);
    }
  } else {
    const contentDiv = div.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.textContent = content;
      contentDiv.setAttribute('dir', detectTextDirection(content) === 'rtl' ? 'rtl' : 'ltr');
    }
  }
  
  forceLayoutAndScroll();
}
