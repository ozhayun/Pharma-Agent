# Complete Explanation of All JavaScript Files

This document explains every JavaScript file in the frontend of the Pharma Agent project.

---

## 📁 File Structure

```
public/
├── app.js                    # Main entry point
├── chat/
│   └── api.js               # API communication & SSE streaming
├── utils/
│   ├── input.js             # Input field management
│   └── dom.js               # DOM utilities
└── ui/
    ├── state.js             # Global state management
    ├── messages.js          # Message display facade
    ├── message.js           # Individual message creation/updates
    ├── loading.js           # Loading indicator
    ├── context.js           # Debug context panel
    ├── suggestions.js       # Medication suggestion bubbles
    ├── bubbles.js           # Option bubble buttons
    ├── options.js           # Option parsing
    └── scroll.js            # Scroll management
```

---

## 📄 1. `public/app.js` - Main Application Entry Point

**Purpose**: Initializes the entire application and wires all components together.

**Key Responsibilities**:
- **DOM Element Selection**: Gets references to all UI elements (chat container, input, buttons, context panel)
- **Component Initialization**: Calls `initialize*()` functions for all modules
- **Event Listeners**: Sets up click handlers for send button, Enter key, input changes
- **Debug Mode**: Checks `/config` endpoint to enable debug features
- **Welcome Message**: Shows initial greeting after suggestions load

**Key Functions**:
- `initializeApp()`: Main initialization function
- `showWelcomeMessage()`: Displays welcome message after 750ms delay

**Dependencies**:
- Imports from all UI modules
- Uses `sendMessage` from `chat/api.js`

**Flow**:
1. Wait for DOM ready
2. Get all DOM elements
3. Initialize all modules
4. Set up event listeners
5. Check debug mode
6. Load suggestions
7. Show welcome message

---

## 📄 2. `public/chat/api.js` - API Communication & SSE Streaming

**Purpose**: Handles all communication with the backend API, manages SSE streaming, and maintains conversation state.

**Key Responsibilities**:
- **SSE Streaming**: Connects to `/chat` endpoint, reads Server-Sent Events
- **State Management**: Maintains `currentContext` (flowState) between requests
- **Request Abortion**: Can cancel in-flight requests
- **Stream Parsing**: Parses SSE chunks (`data: {...}` format)
- **Message Updates**: Updates UI as chunks arrive (streaming text)
- **Context Updates**: Updates flowState from server responses

**Key Variables**:
- `currentContext`: Stores flowState object (stateless architecture - passed to server)
- `activeRequest`: AbortController for canceling requests
- `activeReader`: ReadableStream reader for SSE
- `isWaitingForResponse`: Flag to prevent multiple simultaneous requests

**Key Functions**:
- `initializeChat(handlers)`: Sets up callback functions for UI updates
- `sendMessage(message)`: Main function - sends message, handles SSE stream
- `getIsWaitingForResponse()`: Returns if request is in progress

**SSE Format**:
```javascript
data: {"content": "text chunk", "done": false, "context": {...}, "options": [...]}
```

**Flow**:
1. User sends message → `sendMessage()`
2. Abort any active request
3. Add user message to UI
4. Show loading indicator
5. POST to `/chat` with `{message, context: currentContext}`
6. Read SSE stream chunks
7. Parse each `data:` line as JSON
8. Update assistant message content incrementally
9. Update context (flowState) when received
10. Update options when received
11. On `done: true`, cleanup and re-enable input

**Stateless Architecture**: 
- `currentContext` (flowState) is sent to server in each request
- Server returns updated `flowState` in response
- Client persists it for next request
- No server-side sessions

---

## 📄 3. `public/utils/input.js` - Input Field Management

**Purpose**: Manages the message input textarea, handles language detection, text direction, and send button state.

**Key Responsibilities**:
- **Text Direction**: Detects RTL (Hebrew) vs LTR (English), updates CSS
- **Send Button State**: Enables/disables based on input content and request status
- **Auto-Resize**: Textarea grows/shrinks with content (max 200px)
- **Language Detection**: Detects Hebrew characters, updates current language
- **Language Change Callback**: Notifies suggestions module when language changes

**Key Variables**:
- `messageInput`: Reference to textarea element
- `sendButton`: Reference to send button
- `currentLanguage`: 'en' or 'he'
- `renderSuggestionsCallback`: Function to update suggestions when language changes

**Key Functions**:
- `initializeInput(inputElement, buttonElement, onLanguageChange)`: Sets up input
- `updateInputDirection()`: Detects and sets text direction (RTL/LTR)
- `updateSendButtonState()`: Enables/disables send button
- `autoResizeTextarea()`: Adjusts textarea height (max 200px)
- `updateLanguageFromInput()`: Detects Hebrew, updates language, triggers suggestions update
- `getCurrentLanguage()`: Returns current language
- `getMessageInput()`: Returns input element reference

**Hebrew Detection**: Uses regex `/[\u0590-\u05FF]/` to detect Hebrew Unicode range

---

## 📄 4. `public/utils/dom.js` - DOM Utilities

**Purpose**: Provides utility functions for DOM manipulation and text formatting.

**Key Functions**:
- `detectTextDirection(text)`: Returns 'rtl' or 'ltr' based on Hebrew characters
- `formatFlowName(flowType)`: Converts `medication_info` → `MEDICATION INFO`
- `formatStepName(step)`: Converts `collect_medication_name` → `COLLECT MEDICATION NAME`

**Usage**: Used by input.js for direction detection, context.js for displaying flow/step names

---

## 📄 5. `public/ui/state.js` - Global State Management

**Purpose**: Simple state management - stores references to chat container and send message callback.

**Key Variables**:
- `chatContainer`: Reference to main chat container DOM element
- `sendMessageCallback`: Function to send messages (passed from app.js)

**Key Functions**:
- `initializeState(container, callback)`: Sets up global state
- `getChatContainer()`: Returns chat container reference
- `getSendMessageCallback()`: Returns send message function

**Why**: Centralized access to shared state - avoids passing through many function parameters

---

## 📄 6. `public/ui/messages.js` - Message Display Facade

**Purpose**: Facade module that provides a clean API for message operations, delegates to other modules.

**Key Functions**:
- `initializeMessages(container, sendMessageFn)`: Initializes state
- `addMessage(role, content, returnId)`: Creates new message (delegates to message.js)
- `updateMessageContent(id, content, options)`: Updates existing message (delegates to message.js)
- Re-exports: `showLoading`, `removeLoading`, `scrollToBottom`

**Why Facade**: Provides simple API, hides complexity of message.js, loading.js, scroll.js

---

## 📄 7. `public/ui/message.js` - Individual Message Creation/Updates

**Purpose**: Creates and updates individual message DOM elements in the chat.

**Key Responsibilities**:
- **Message Creation**: Creates DOM structure for user/assistant messages
- **Avatar Display**: Shows user/AI avatar images
- **Text Direction**: Sets RTL/LTR based on content
- **Options Parsing**: Extracts options from assistant messages (JSON format)
- **Options Display**: Creates clickable option bubbles
- **Streaming Updates**: Updates message content as chunks arrive

**Key Functions**:
- `createMessage(role, content, returnId)`: Creates new message element
- `updateMessage(id, content, optionsFromStream)`: Updates existing message (for streaming)

**Message Structure**:
```html
<div class="message user|assistant" id="msg-...">
  <div class="message-avatar">
    <img src="/icons/icon-user.webp|icon-ai-agent.webp">
  </div>
  <div class="message-wrapper">
    <div class="message-content" dir="ltr|rtl">Text content</div>
    <div class="message-options"> <!-- if options exist -->
      <div class="message-option-bubble">Option 1</div>
      ...
    </div>
  </div>
</div>
```

**Options Format**: 
- Assistant messages can contain JSON: `{"response": "text", "options": ["opt1", "opt2"]}`
- Options parsed by `parseOptions()` from options.js
- Options displayed as clickable bubbles

**Streaming**: 
- `updateMessage()` called repeatedly as chunks arrive
- Updates `message-content` text incrementally
- Updates options when received from stream

**Helper Functions**:
- `createAvatar(role)`: Creates avatar element
- `createContentDiv(text, isHebrew)`: Creates content div with direction
- `createMessageWrapper(contentDiv, options, role)`: Wraps content + options
- `ensureMessageStructure(div)`: Ensures message has correct DOM structure

---

## 📄 8. `public/ui/loading.js` - Loading Indicator

**Purpose**: Shows/hides loading animation while waiting for AI response.

**Key Functions**:
- `showLoading()`: Creates loading message element, returns ID
- `removeLoading(id)`: Removes loading element by ID

**Loading Structure**:
```html
<div class="message assistant loading-msg" id="loading-...">
  <div class="message-avatar">...</div>
  <div class="message-content">
    <div class="loading">
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
    </div>
  </div>
</div>
```

**Usage**: 
- Shown before API request
- Removed when first chunk arrives
- Also removed on error

---

## 📄 9. `public/ui/context.js` - Debug Context Panel

**Purpose**: Displays debug information about current flow state (only visible in debug mode).

**Key Responsibilities**:
- **Context Display**: Shows medication name, flow type, step, language
- **History Tabs**: Displays tool history, medication history, flow history, step history
- **Panel Toggle**: Shows/hides debug panel (Ctrl+D or button click)
- **Tab Switching**: Switches between Info and History tabs

**Key Variables**:
- Context elements: `ctxMedication`, `ctxFlow`, `ctxStep`, `ctxLang`
- History containers: `toolHistoryContainer`, `medicationHistoryContainer`, etc.
- Panel elements: `contextPanel`, `contextToggle`, `closeContextBtn`

**Key Functions**:
- `initializeContext(elements)`: Sets up all DOM references
- `setupContextPanelHandlers()`: Sets up event listeners (only called in debug mode)
- `updateContext(newContext)`: Updates all context displays from flowState

**Context Updates**:
- Extracts data from `flowState.sharedSlots` and `flowState.flows`
- Formats flow/step names (e.g., `medication_info` → `MEDICATION INFO`)
- Updates history lists from `flowState.toolHistory`, etc.

**Keyboard Shortcuts**:
- `Ctrl+D` / `Cmd+D`: Toggle context panel
- `Escape`: Close context panel

**Helper Functions**:
- `updateToolHistory(toolHistory)`: Renders tool call history
- `updateMedicationHistory(medicationHistory)`: Renders medication history
- `updateFlowHistory(flowHistory)`: Renders flow history
- `updateStepHistory(stepHistory)`: Renders step history
- `updateContextItem(element, value)`: Updates individual context item with animation
- `escapeHtml(text)`: Escapes HTML to prevent XSS

---

## 📄 10. `public/ui/suggestions.js` - Medication Suggestion Bubbles

**Purpose**: Displays clickable medication name suggestions above input field.

**Key Responsibilities**:
- **Load Medications**: Fetches medication list from `/medications` endpoint
- **Language-Aware Display**: Shows Hebrew names when language is Hebrew, English otherwise
- **Click Handler**: Inserts medication name into input field
- **Smart Insertion**: Handles word boundaries, spaces, existing text

**Key Variables**:
- `suggestionsBubbles`: Container element for suggestions
- `medicationsData`: Array of medication objects `[{name, hebrewName}, ...]`
- `currentLanguage`: 'en' or 'he'
- `inputHandlers`: Object with input manipulation functions

**Key Functions**:
- `initializeSuggestions(bubblesElement, language, handlers)`: Sets up suggestions
- `loadSuggestions(apiUrl)`: Fetches medications from API
- `renderSuggestions()`: Renders suggestion bubbles based on current language
- `setLanguage(language)`: Updates language and re-renders
- `hideSuggestions()`: Clears suggestions

**Suggestion Click Logic**:
- If input empty → replace with medication name
- If input ends with space → append medication name
- If single word → replace with medication name
- Otherwise → append space + medication name

**After Click**: 
- Updates input direction
- Updates language detection
- Updates send button state
- Auto-resizes textarea

---

## 📄 11. `public/ui/bubbles.js` - Option Bubble Buttons

**Purpose**: Creates clickable option bubbles for assistant message options.

**Key Responsibilities**:
- **Create Bubbles**: Creates clickable option buttons
- **Disable Bubbles**: Disables all bubbles when one is clicked (prevents double-clicks)
- **Click Handler**: Calls callback with selected option

**Key Functions**:
- `createOptionBubbles(options, onSelect)`: Creates container with option bubbles
- `disableAllOptionBubbles()`: Disables all bubbles in chat
- `disableBubblesInContainer(container)`: Disables bubbles in specific container

**Bubble Structure**:
```html
<div class="message-options">
  <div class="message-option-bubble">Option 1</div>
  <div class="message-option-bubble">Option 2</div>
  ...
</div>
```

**Behavior**:
- When bubble clicked → disables all bubbles in container
- Calls `onSelect(option)` callback (sends message)
- Bubbles get `.disabled` class and `onclick` removed

---

## 📄 12. `public/ui/options.js` - Option Parsing

**Purpose**: Parses JSON options from assistant message content.

**Key Function**:
- `parseOptions(content)`: Extracts `{response, options}` from JSON string

**Parsing Logic**:
1. Checks if content is string
2. Removes markdown code fences (```json or ```)
3. Parses JSON
4. Validates `response` is string
5. Validates `options` is array with ≥2 valid strings
6. Returns `{text: response, options: options}` or `{text: content, options: null}`

**Input Formats Supported**:
- Plain JSON: `{"response": "...", "options": [...]}`
- Markdown JSON: ` ```json {"response": "...", "options": [...]} ``` `
- Plain text: Returns as-is with `options: null`

**Usage**: Called by `message.js` when creating/updating assistant messages

---

## 📄 13. `public/ui/scroll.js` - Scroll Management

**Purpose**: Manages auto-scrolling to bottom of chat container.

**Key Functions**:
- `scrollToBottom()`: Scrolls chat container to bottom
- `forceLayoutAndScroll(callback)`: Forces layout recalculation then scrolls (more reliable)

**Why `forceLayoutAndScroll`**:
- Uses `requestAnimationFrame` to ensure DOM updates complete
- Reads `offsetHeight` to force layout recalculation
- Multiple `requestAnimationFrame` calls ensure scroll happens after all updates
- More reliable than `scrollToBottom()` for dynamic content

**Usage**: 
- Called after adding messages
- Called after updating message content (streaming)
- Called after adding options

---

## 🔄 Data Flow Summary

### User Sends Message:
1. **app.js**: User clicks send or presses Enter
2. **input.js**: Validates input, disables send button
3. **api.js**: `sendMessage()` called
4. **messages.js**: Adds user message to UI
5. **api.js**: POST to `/chat` with `{message, context: currentContext}`
6. **api.js**: Reads SSE stream chunks
7. **messages.js**: Updates assistant message incrementally
8. **context.js**: Updates context panel from `flowState`
9. **options.js**: Parses options from message
10. **bubbles.js**: Creates option bubbles if options exist
11. **scroll.js**: Scrolls to bottom

### Language Detection:
1. **input.js**: User types → `updateLanguageFromInput()`
2. **input.js**: Detects Hebrew characters → updates `currentLanguage`
3. **suggestions.js**: `setLanguage()` called → re-renders suggestions
4. **message.js**: Sets `dir="rtl"` for Hebrew messages

### Option Selection:
1. **bubbles.js**: User clicks option bubble
2. **bubbles.js**: Disables all bubbles
3. **api.js**: `sendMessage(option)` called
4. Flow continues as "User Sends Message"

---

## 🎯 Key Design Patterns

1. **Facade Pattern**: `messages.js` provides simple API, delegates to other modules
2. **State Management**: `state.js` centralizes shared state
3. **Callback Pattern**: Modules register callbacks (e.g., `initializeChat(handlers)`)
4. **Module Pattern**: Each file exports specific functions, no global pollution
5. **Stateless Architecture**: `currentContext` passed to server, returned in response

---

## 🔑 Important Concepts

### Stateless Architecture:
- No server-side sessions
- `flowState` stored in `currentContext` variable
- Sent to server in each request: `{message, context: {flowState}}`
- Server returns updated `flowState` in SSE `context` field
- Client persists it for next request

### SSE Streaming:
- Server sends chunks: `data: {"content": "chunk", "done": false}\n\n`
- Client reads stream, parses JSON
- Updates message content incrementally
- On `done: true`, finalizes message

### Language Support:
- Detects Hebrew via Unicode range `/[\u0590-\u05FF]/`
- Sets `dir="rtl"` for Hebrew text
- Shows Hebrew medication names when language is Hebrew
- Updates suggestions based on language

### Debug Mode:
- Enabled via `/config` endpoint (`isDebug: true`)
- Shows context panel with flow state
- Keyboard shortcut: `Ctrl+D` / `Cmd+D`
- Displays tool history, medication history, flow history

---

This completes the explanation of all JavaScript files in the Pharma Agent frontend!

