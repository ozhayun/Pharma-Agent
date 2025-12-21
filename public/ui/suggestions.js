/**
 * Medication suggestions UI
 */

let suggestionsBubbles;
let medicationsData = [];
let currentLanguage = 'en';
let inputHandlers = {};

export function initializeSuggestions(bubblesElement, language, handlers) {
  suggestionsBubbles = bubblesElement;
  currentLanguage = language;
  inputHandlers = handlers;
}

export async function loadSuggestions(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/medications`);
    const data = await res.json();
    medicationsData = data.medications || [];
    renderSuggestions();
  } catch (e) {
    console.error('Suggestions error', e);
  }
}

export function renderSuggestions() {
  if (!suggestionsBubbles) return;
  suggestionsBubbles.innerHTML = '';

  const isHebrew = currentLanguage === 'he';

  medicationsData.forEach(med => {
    const el = document.createElement('div');
    el.className = 'suggestion-bubble';

    const displayName = (isHebrew && med.hebrewName) ? med.hebrewName : med.name;
    el.textContent = displayName;

    el.onclick = () => {
      if (!inputHandlers.messageInput) return;
      
      const currentVal = inputHandlers.messageInput.value;
      const trimmedVal = currentVal.trim();
      
      const words = trimmedVal.split(/\s+/).filter(w => w.length > 0);
      const wordCount = words.length;
      
      if (!trimmedVal) {
        inputHandlers.messageInput.value = displayName;
      }
      else if (currentVal.endsWith(' ')) {
        inputHandlers.messageInput.value = currentVal + displayName;
      }
      else if (wordCount === 1) {
        inputHandlers.messageInput.value = displayName;
      }
      else {
        inputHandlers.messageInput.value = currentVal + ' ' + displayName;
      }

      inputHandlers.messageInput.focus();
      if (inputHandlers.autoResizeTextarea) inputHandlers.autoResizeTextarea();
      if (inputHandlers.updateInputDirection) inputHandlers.updateInputDirection();
      if (inputHandlers.updateLanguageFromInput) inputHandlers.updateLanguageFromInput();
      if (inputHandlers.updateSendButtonState) inputHandlers.updateSendButtonState();
    };
    suggestionsBubbles.appendChild(el);
  });
}

export function hideSuggestions() {
  if (!suggestionsBubbles) return;
  suggestionsBubbles.innerHTML = '';
}

export function setLanguage(language) {
  if (currentLanguage !== language) {
    currentLanguage = language;
    renderSuggestions();
  }
}

