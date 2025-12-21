const API_URL = window.location.origin;

let currentContext = {};
let updateContextCallback;
let addMessageCallback;
let updateMessageContentCallback;
let showLoadingCallback;
let removeLoadingCallback;
let getMessageInputCallback;
let updateInputHandlers;

let activeRequest = null;
let activeLoadingId = null;
let activeReader = null;
let isWaitingForResponse = false;

export function initializeChat(handlers) {
  updateContextCallback = handlers.updateContext;
  addMessageCallback = handlers.addMessage;
  updateMessageContentCallback = handlers.updateMessageContent;
  showLoadingCallback = handlers.showLoading;
  removeLoadingCallback = handlers.removeLoading;
  getMessageInputCallback = handlers.getMessageInput;
  updateInputHandlers = handlers.updateInput;
}

export function getIsWaitingForResponse() {
  return isWaitingForResponse;
}

export async function sendMessage(message) {
  if (!message || !message.trim()) return;

  const messageInput = getMessageInputCallback();
  if (!messageInput) return;

  if (isWaitingForResponse) {
    return;
  }

  isWaitingForResponse = true;
  if (updateInputHandlers) {
    updateInputHandlers.updateSendButtonState();
  }

  if (activeRequest) {
    try {
      activeRequest.abort();
    } catch (e) {
    }
    activeRequest = null;
  }

  if (activeReader) {
    try {
      activeReader.cancel();
    } catch (e) {
    }
    activeReader = null;
  }

  if (activeLoadingId) {
    removeLoadingCallback(activeLoadingId);
    activeLoadingId = null;
  }

  addMessageCallback('user', message);
  messageInput.value = '';
  messageInput.style.height = 'auto';
  
  if (updateInputHandlers) {
    updateInputHandlers.updateInputDirection();
    updateInputHandlers.updateSendButtonState();
  }

  const loadingId = showLoadingCallback();
  activeLoadingId = loadingId;

  let assistantMessageId = null;
  let assistantContent = '';
  let assistantOptions = null;
  const abortController = new AbortController();
  activeRequest = abortController;
  let reader = null;

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context: Object.keys(currentContext).length > 0 ? currentContext : undefined
      }),
      signal: abortController.signal,
    });

    if (!response.ok) throw new Error('Failed to connect');

    reader = response.body.getReader();
    activeReader = reader;
    const decoder = new TextDecoder();
    let buffer = '';

    removeLoadingCallback(loadingId);
    activeLoadingId = null;

    while (true) {
      if (activeRequest !== abortController) {
        try {
          reader.cancel();
        } catch (e) {
        }
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.content) {
              assistantContent += data.content;
              if (!assistantMessageId) {
                assistantMessageId = addMessageCallback('assistant', assistantContent, true);
              } else {
                updateMessageContentCallback(assistantMessageId, assistantContent, assistantOptions);
              }
            }

            if (data.options !== undefined) {
              assistantOptions = data.options;
              if (assistantMessageId) {
                updateMessageContentCallback(assistantMessageId, assistantContent, assistantOptions);
              }
            }

            if (data.context) {
              const updatedContext = updateContextCallback(data.context);
              currentContext = { ...currentContext, ...updatedContext };
            }
          } catch (e) { console.error('Parse error', e); }
        }
      }
    }

    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6));
        if (data.content) {
          assistantContent += data.content;
          if (!assistantMessageId) assistantMessageId = addMessageCallback('assistant', assistantContent, true);
          else updateMessageContentCallback(assistantMessageId, assistantContent, assistantOptions);
        }
        if (data.options !== undefined) {
          assistantOptions = data.options;
          if (assistantMessageId) {
            updateMessageContentCallback(assistantMessageId, assistantContent, assistantOptions);
          }
        }
        if (data.context) {
          const updatedContext = updateContextCallback(data.context);
          currentContext = { ...currentContext, ...updatedContext };
        }
      } catch (e) { }
    }

  } catch (error) {
    if (error.name !== 'AbortError') {
      if (activeLoadingId) {
        removeLoadingCallback(activeLoadingId);
        activeLoadingId = null;
      }
      addMessageCallback('assistant', `⚠️ System Error: ${error.message}`);
    }
  } finally {
    // Clear active request if this was the current one
    if (activeRequest === abortController) {
      activeRequest = null;
    }
    if (activeReader === reader) {
      activeReader = null;
    }
    if (activeLoadingId === loadingId) {
      activeLoadingId = null;
    }
    isWaitingForResponse = false;
    if (updateInputHandlers) {
      updateInputHandlers.updateSendButtonState();
    }
    const { renderSuggestions } = await import('../ui/suggestions.js');
    renderSuggestions();
    messageInput.focus();
  }
}

