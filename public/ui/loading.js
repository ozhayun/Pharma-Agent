import { getChatContainer } from './state.js';
import { forceLayoutAndScroll } from './scroll.js';

export function showLoading() {
  const chatContainer = getChatContainer();
  if (!chatContainer) return null;
  
  const id = `loading-${Date.now()}`;
  const div = document.createElement('div');
  div.className = 'message assistant loading-msg';
  div.id = id;

  const avatarDiv = document.createElement('div');
  avatarDiv.className = 'message-avatar';
  const avatarImg = document.createElement('img');
  avatarImg.src = '/icons/icon-ai-agent.webp';
  avatarImg.alt = 'AI Agent';
  avatarDiv.appendChild(avatarImg);
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading';
  loadingDiv.innerHTML = `
    <div class="loading-dot"></div>
    <div class="loading-dot"></div>
    <div class="loading-dot"></div>
  `;
  contentDiv.appendChild(loadingDiv);
  
  div.appendChild(avatarDiv);
  div.appendChild(contentDiv);
  chatContainer.appendChild(div);
  forceLayoutAndScroll();
  return id;
}

export function removeLoading(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
