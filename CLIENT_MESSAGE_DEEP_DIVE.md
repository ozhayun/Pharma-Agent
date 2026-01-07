# Deep Dive: Client Message Flow - Functions, Decisions & Logic

This document traces **every function call, every decision point, and every piece of logic** that happens when a client sends a message.

---

## 🎯 Starting Point: Client Sends Message

**Input**: `POST /chat` with `{message: "Tell me about Aspirin", context: {flowState: {...}}}`

---

## 📍 PHASE 1: Request Reception & Validation

### **Function 1: `registerChatRoutes()`**
**File**: `src/routes/chat.ts:23-96`  
**Called by**: Fastify server registration  
**What it does**: Route handler for POST `/chat`

**Decision Point 1.1: Message Validation** (Line 29)
```typescript
if (!message || typeof message !== 'string' || message.trim().length === 0)
```
- **Decision**: Is message valid?
- **If NO**: Return 400 error, **STOP** (no further processing)
- **If YES**: Continue

**Decision Point 1.2: Context Validation** (Line 36)
```typescript
const contextValidation = validateRequestContext(request.body);
```
- **Calls**: `validateRequestContext()` (line 10)
- **Decision**: Is `flowState` structure valid?
- **If NO**: Log warning, **CONTINUE** (doesn't block)
- **If YES**: Continue

**Function 1.1: `validateRequestContext()`**
**File**: `src/routes/chat.ts:10-21`  
**Called by**: `registerChatRoutes()` (line 36)

**Decision Point 1.2.1**: (Line 11)
```typescript
if (payload.context?.flowState)
```
- **Decision**: Does `flowState` exist?
- **If NO**: Return `{valid: true}` (no state is valid)
- **If YES**: Check structure

**Decision Point 1.2.2**: (Line 13)
```typescript
if (!state._activeFlowType)
```
- **Decision**: Does state have `_activeFlowType`?
- **If NO**: Return `{valid: false, warning: '...'}`

**Decision Point 1.2.3**: (Line 16)
```typescript
if (!state.flows || !state.flows[state._activeFlowType])
```
- **Decision**: Does state have active flow?
- **If NO**: Return `{valid: false, warning: '...'}`

**Returns**: `{valid: boolean, warning?: string}`

**Decision Point 1.3: SSE Setup** (Lines 42-45)
- **Decision**: Set SSE headers (always done)
- **No conditional logic** - always sets headers

**Function Call 1.4: `processMessageStream()`** (Line 47)
```typescript
const stream = processMessageStream({ 
  message, 
  context: request.body.context 
});
```
- **Passes**: `{message: string, context?: {flowState?: FlowState}}`
- **Returns**: `AsyncGenerator<StreamChunk>`

---

## 📍 PHASE 2: Agent Processing - Initial Setup

### **Function 2: `processMessageStream()`**
**File**: `src/agent/agent.ts:22-207`  
**Type**: `AsyncGenerator<StreamChunk>`  
**What it does**: Main orchestrator

**Decision Point 2.1: State Initialization** (Line 29)
```typescript
let flowState: FlowState | undefined = request.context?.flowState;
```
- **Decision**: Does request have `flowState`?
- **If NO**: `flowState = undefined`
- **If YES**: `flowState = request.context.flowState`

**Function Call 2.2: `updateFlowStateFromMessage()`** (Line 31)
```typescript
flowState = await updateFlowStateFromMessage(flowState, request.message, []);
```
- **This is the CORE function** - handles all state updates, intent parsing, flow switching
- **Returns**: Updated `FlowState`

**Function Call 2.3: `generateFlowAwarePrompt()`** (Line 34)
```typescript
const systemPrompt = generateFlowAwarePrompt(flowState, request.message);
```
- **Builds**: Context-aware system prompt
- **Uses**: Current flow, step, medication data, requested info type

**Function Call 2.4: `buildInitialMessages()`** (Line 40)
```typescript
let messages = buildInitialMessages(systemPrompt, flowState, request.message);
```
- **Builds**: Message array for OpenAI API
- **Structure**: `[system, assistant (if lastPresentedText), user]`

**Decision Point 2.5: Iteration Loop Setup** (Lines 42-46)
```typescript
let maxIterations = 5;
let maxToolCallsPerRequest = 3;
let toolCallCount = 0;
let toolCallHistory: Array<{ name: string; iteration: number }> = [];
let iteration = 0;
```
- **Constants**: Max iterations (5), max tool calls (3)
- **Counters**: Track iterations, tool calls, history

---

## 📍 PHASE 3: Flow State Management (THE CORE)

### **Function 3: `updateFlowStateFromMessage()`**
**File**: `src/agent/flowManager/state/messageUpdates.ts:14-262`  
**Called by**: `processMessageStream()` (line 31)  
**This is where MOST decisions happen**

**Decision Point 3.1: State Initialization** (Line 20)
```typescript
let state = currentState || initializeFlowState();
```
- **Decision**: Does `currentState` exist?
- **If NO**: Call `initializeFlowState()` → creates new empty state
- **If YES**: Use existing state

**Function 3.1: `initializeFlowState()`**
**File**: `src/agent/flowManager/state/initialization.ts:4-22`  
**Called by**: `updateFlowStateFromMessage()` (line 20)

**Decision**: Creates initial state with:
- Flow: `MEDICATION_INFO` (default)
- Step: `COLLECT_MEDICATION_NAME` (first step)
- Language: `'en'` (default)
- Empty slots, empty history

**Returns**: New `FlowState`

---

**Function Call 3.2: `parseUserIntent()`** (Line 25)
```typescript
const parsedIntent = await parseUserIntent(userMessage, state);
```
- **CRITICAL**: First LLM call (gpt-4o)
- **Extracts**: Intent, medication name, info type, language
- **Returns**: `ParsedUserIntent & {language: 'en' | 'he'}`

**Decision Point 3.3: Language Update** (Line 26)
```typescript
state.language = parsedIntent.language;
```
- **Always updates**: Language from parsed intent

---

### **Function 3.2: `parseUserIntent()`**
**File**: `src/agent/flowManager/intent.ts:18-88`  
**Called by**: `updateFlowStateFromMessage()` (line 25)

**Decision Point 3.2.1: Context Building** (Lines 23-26)
```typescript
const hasLastPresentedText = !!flowState.sharedSlots.lastPresentedText;
const previousMessage = hasLastPresentedText ? `Previous assistant message: "${flowState.sharedSlots.lastPresentedText?.content}"` : undefined;
const activeFlowType = flowState._activeFlowType;
const currentStep = (activeFlowType && flowState.flows[activeFlowType]?.step) || 'none';
```
- **Decision**: Does `lastPresentedText` exist?
- **If YES**: Include in prompt for context
- **If NO**: `previousMessage = undefined`

**Function Call 3.2.2: `getIntentPrompt()`** (Line 28)
```typescript
const intentPrompt = getIntentPrompt(
  userMessage,
  currentStep,
  flowState.sharedSlots.medicationName || 'none',
  previousMessage
);
```
- **Builds**: Prompt for intent parsing LLM

**Function 3.2.3: `getIntentPrompt()`**
**File**: `src/agent/flowManager/utils.ts:28-81`  
**Called by**: `parseUserIntent()` (line 28)

**Decision**: Builds prompt with:
- User message
- Current step
- Medication context
- Previous assistant message (if exists)

**Returns**: Prompt string

**Decision Point 3.2.4: LLM API Call** (Line 38)
```typescript
const response = await openai.responses.create({
  model: process.env.OPENAI_SMALL_MODEL || 'gpt-4o',
  input: [...],
  text: { format: { type: 'json_object' } },
  temperature: !supportsReasoning(...) ? 0.0 : undefined,
});
```
- **Model**: `OPENAI_SMALL_MODEL` (gpt-4o) - fast, deterministic
- **Format**: JSON object (structured output)
- **Temperature**: 0.0 for non-reasoning models (deterministic)

**Decision Point 3.2.5: Response Parsing** (Lines 56-65)
```typescript
const output = response.output || [];
const outputMessage = output.find((o: any) => o.type === 'message');
const textOutput = outputMessage?.content?.find((c: any) => c.type === 'output_text');
const content = textOutput?.text;
if (!content) {
  // Fallback
  return { intent: 'unknown', language: detectedLang };
}
```
- **Decision**: Does response have content?
- **If NO**: Return `{intent: 'unknown', language: detectedLang}` - **FALLBACK**
- **If YES**: Parse JSON

**Decision Point 3.2.6: Language Detection** (Line 68)
```typescript
const detectedLang = detectLanguage(userMessage);
```
- **Function**: `detectLanguage()` (line 16)
- **Logic**: Checks for Hebrew Unicode range `/[\u0590-\u05FF]/`
- **Returns**: `'he'` if Hebrew found, `'en'` otherwise

**Returns**: `ParsedUserIntent & {language: 'en' | 'he'}`

---

**Back to `updateFlowStateFromMessage()`:**

**Decision Point 3.4: Pending Intent Recovery** (Lines 30-46)
```typescript
if (parsedIntent.intent === 'unknown' || parsedIntent.intent === 'confirm_yes') {
  if (state.sharedSlots.pendingIntent && state.sharedSlots.pendingInfoType) {
    // Use pending intent
    parsedIntent.intent = state.sharedSlots.pendingIntent;
    parsedIntent.requestedInfoType = state.sharedSlots.pendingInfoType;
    // Clear pending
    state.sharedSlots.pendingIntent = null;
    state.sharedSlots.pendingInfoType = null;
    // Switch flow
    const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
    if (targetFlowType) {
      return handleFlowSwitch(state, targetFlowType, parsedIntent);
    }
  }
}
```

**Decision Tree**:
1. **Is intent `unknown` or `confirm_yes`?**
   - **If NO**: Skip this block, continue to line 78
   - **If YES**: Check for pending intent

2. **Does `pendingIntent` exist?**
   - **If YES**: Use pending intent, clear it, switch flow
   - **If NO**: Check context-aware recovery (line 48)

**Decision Point 3.5: Context-Aware Recovery** (Lines 48-75)
```typescript
else if (parsedIntent.intent === 'confirm_yes' && state.sharedSlots.lastPresentedText) {
  const lastText = state.sharedSlots.lastPresentedText.content.toLowerCase();
  if (lastText.includes('dosage') || lastText.includes('dose')) {
    parsedIntent.intent = 'request_medication_info';
    parsedIntent.requestedInfoType = 'dosage';
    // Switch flow if needed
  } else if (lastText.includes('stock') || lastText.includes('availability')) {
    parsedIntent.intent = 'check_stock';
    parsedIntent.requestedInfoType = 'stock';
    // Switch flow if needed
  } else if (lastText.includes('prescription')) {
    parsedIntent.intent = 'check_prescription';
    parsedIntent.requestedInfoType = 'prescription';
    // Switch flow if needed
  }
}
```

**Decision Logic**:
- **If user says "yes"** AND `lastPresentedText` exists:
  - **Check last message content**:
    - Contains "dosage"/"dose" → `intent: 'request_medication_info'`, `requestedInfoType: 'dosage'`
    - Contains "stock"/"availability" → `intent: 'check_stock'`, `requestedInfoType: 'stock'`
    - Contains "prescription" → `intent: 'check_prescription'`, `requestedInfoType: 'prescription'`
  - **If flow needs to switch**: Call `handleFlowSwitch()`

**Why**: User said "yes" but we need to know what they're confirming

---

**Decision Point 3.6: Intent to Flow Type Mapping** (Line 78)
```typescript
const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
```

**Function 3.3: `mapIntentToFlowType()`**
**File**: `src/agent/flowManager/utils.ts:21-26`  
**Called by**: `updateFlowStateFromMessage()` (multiple times)

**Decision Logic**:
```typescript
if (intent === 'check_stock') return FlowTypeEnum.INVENTORY_CHECK;
if (intent === 'check_prescription') return FlowTypeEnum.PRESCRIPTION_CONFIRMATION;
if (intent === 'request_medication_info') return FlowTypeEnum.MEDICATION_INFO;
return null;
```

**Returns**: `FlowType | null`

---

**Decision Point 3.7: Intent Analysis** (Lines 81-85)
```typescript
const hasSpecificIntent = targetFlowType !== null;
const hasRequestedInfoType = parsedIntent.requestedInfoType !== null && parsedIntent.requestedInfoType !== undefined;
const hasMedicationInMessage = parsedIntent.containsMedicationName && parsedIntent.extractedMedicationName;
```

**Three boolean flags**:
- `hasSpecificIntent`: Can we map intent to a flow?
- `hasRequestedInfoType`: Did user request specific info type?
- `hasMedicationInMessage`: Did user mention medication name?

**Decision Point 3.8: RequestedInfoType Override** (Lines 87-90)
```typescript
if (parsedIntent.requestedInfoType) {
  state.sharedSlots.requestedInfoType = parsedIntent.requestedInfoType;
  logger.debug(`[FLOW_STATE] HARD OVERRIDE: Setting requestedInfoType to "${parsedIntent.requestedInfoType}" from intent`);
}
```
- **Always sets**: `requestedInfoType` if present in parsed intent
- **Why**: Intent parser is authoritative source

---

**Decision Point 3.9: Intent Dominance Check** (Lines 92-107)
```typescript
if (hasSpecificIntent && hasRequestedInfoType) {
  if (targetFlowType !== state._activeFlowType) {
    // INTENT DOMINANCE: New command detected
    const newState = handleFlowSwitch(state, targetFlowType, parsedIntent);
    
    if (!parsedIntent.extractedMedicationName && !newState.sharedSlots.medicationName) {
      // Save pending intent
      newState.sharedSlots.pendingIntent = parsedIntent.intent;
      newState.sharedSlots.pendingInfoType = parsedIntent.requestedInfoType;
    }
    
    return newState;
  } else {
    // Same flow but new requestedInfoType
  }
}
```

**Decision Logic**:
1. **Does user have specific intent AND requestedInfoType?**
   - **If NO**: Continue to line 109
   - **If YES**: Check if flow needs to switch

2. **Is target flow different from current flow?**
   - **If YES**: 
     - Call `handleFlowSwitch()` → switch flows
     - **If no medication name**: Save `pendingIntent` (user said "check stock" before medication name)
     - **Return new state** (early exit)
   - **If NO**: Same flow, just update `requestedInfoType`

**Why "Intent Dominance"**: User explicitly stated new command (e.g., "check stock"), overrides current flow

---

**Decision Point 3.10: Flow Switch Check** (Lines 109-120)
```typescript
if (targetFlowType && targetFlowType !== state._activeFlowType) {
  logger.debug(`[FLOW_STATE] Flow switch detected: ${state._activeFlowType} -> ${targetFlowType}`);
  const newState = handleFlowSwitch(state, targetFlowType, parsedIntent);
  
  if (parsedIntent.requestedInfoType && !parsedIntent.extractedMedicationName && !newState.sharedSlots.medicationName) {
    newState.sharedSlots.pendingIntent = parsedIntent.intent;
    newState.sharedSlots.pendingInfoType = parsedIntent.requestedInfoType;
  }
  
  return newState;
}
```

**Decision Logic**:
1. **Does target flow exist AND differ from current flow?**
   - **If YES**: Switch flows
   - **If NO**: Continue to line 122

2. **After switching, if no medication name**: Save pending intent

**Why**: User switched flows mid-conversation (e.g., "Tell me about Aspirin" → "Is it in stock?")

---

**Decision Point 3.11: Pending Intent Storage** (Lines 122-126)
```typescript
if (targetFlowType && parsedIntent.requestedInfoType && !parsedIntent.extractedMedicationName && !state.sharedSlots.medicationName) {
  state.sharedSlots.pendingIntent = parsedIntent.intent;
  state.sharedSlots.pendingInfoType = parsedIntent.requestedInfoType;
}
```

**Decision Logic**:
- **If**: Flow exists + user requested info type + no medication name in message + no medication in state
- **Then**: Save pending intent (user said "check stock" but no medication yet)

**Why**: User stated intent before medication name (e.g., "check stock" → later "Aspirin")

---

**Decision Point 3.12: Inferred Flow Switch** (Lines 128-145)
```typescript
if (parsedIntent.intent === 'unknown' && 
    parsedIntent.containsMedicationName && 
    parsedIntent.extractedMedicationName &&
    state.sharedSlots.requestedInfoType) {
  let inferredFlowType: FlowType | null = null;
  if (state.sharedSlots.requestedInfoType === 'stock') {
    inferredFlowType = FlowTypeEnum.INVENTORY_CHECK;
  } else if (state.sharedSlots.requestedInfoType === 'prescription') {
    inferredFlowType = FlowTypeEnum.PRESCRIPTION_CONFIRMATION;
  } else if (['dosage', 'active_ingredients'].includes(state.sharedSlots.requestedInfoType)) {
    inferredFlowType = FlowTypeEnum.MEDICATION_INFO;
  }
  
  if (inferredFlowType && inferredFlowType !== state._activeFlowType) {
    return handleFlowSwitch(state, inferredFlowType, parsedIntent);
  }
}
```

**Decision Logic**:
- **If**: Intent is `unknown` + medication name in message + `requestedInfoType` exists in state
- **Then**: Infer flow type from `requestedInfoType`
- **If inferred flow differs**: Switch flows

**Example**: User said "check stock" (no medication) → state has `requestedInfoType: 'stock'` → user says "Aspirin" → infer `INVENTORY_CHECK` flow

---

**Decision Point 3.13: Active Flow Processing** (Lines 147-149)
```typescript
const activeFlowType = state._activeFlowType!;
const activeFlow = state.flows[activeFlowType]!;
const flowDef = FLOW_DEFINITIONS[activeFlowType];
```
- **Gets**: Current flow, flow definition
- **No decision** - just data access

**Decision Point 3.14: Intent Validation** (Line 154)
```typescript
const validation = validateSingleIntent(activeFlow, state, parsedIntent);
if (!validation.isValid) {
  return { ...state, language: parsedIntent.language };
}
```

**Function 3.4: `validateSingleIntent()`**
**File**: `src/agent/flowManager/state/validation.ts:3-16`  
**Called by**: `updateFlowStateFromMessage()` (line 154)

**Decision Logic**:
```typescript
if (parsedIntent.requestedInfoType) {
  const existingInfoType = activeFlow.slots.requestedInfoType || state.sharedSlots.requestedInfoType;
  if (existingInfoType && existingInfoType !== parsedIntent.requestedInfoType) {
    return { isValid: false };
  }
}
return { isValid: true };
```

**Decision**:
- **If**: User requests different `requestedInfoType` than existing
- **Then**: Invalid (reject intent)
- **Else**: Valid

**Why**: Prevents conflicting info type requests (e.g., user asked for dosage, then asks for stock in same turn)

**If invalid**: Return state unchanged (early exit)

---

**Function Call 3.5: `updateSlotsFromIntent()`** (Line 162)
```typescript
Object.assign(updatedSlots, updateSlotsFromIntent(updatedSlots, state, parsedIntent));
```

**Function 3.5: `updateSlotsFromIntent()`**
**File**: `src/agent/flowManager/state/slotUpdates.ts:3-25`  
**Called by**: `updateFlowStateFromMessage()` (line 162)

**Decision Logic**:

**Decision 3.5.1: RequestedInfoType Update** (Lines 10-14)
```typescript
if (parsedIntent.requestedInfoType) {
  updatedSlots.requestedInfoType = parsedIntent.requestedInfoType;
} else if (state.sharedSlots.requestedInfoType && !updatedSlots.requestedInfoType) {
  updatedSlots.requestedInfoType = state.sharedSlots.requestedInfoType;
}
```
- **Priority**: Parsed intent > shared slots > current slots

**Decision 3.5.2: Medication Name Update** (Lines 16-22)
```typescript
if (parsedIntent.extractedMedicationName && parsedIntent.containsMedicationName) {
  const currentMedicationName = state.sharedSlots.medicationName;
  if (!currentMedicationName ||
      parsedIntent.extractedMedicationName.toLowerCase() !== currentMedicationName.toLowerCase()) {
    updatedSlots.medicationName = parsedIntent.extractedMedicationName;
  }
}
```
- **Decision**: Is medication name different from current?
- **If YES**: Update slot
- **If NO**: Keep current

**Returns**: Updated slots object

---

**Decision Point 3.15: RequestedInfoType Override in Slots** (Lines 164-167)
```typescript
if (parsedIntent.requestedInfoType) {
  updatedSlots.requestedInfoType = parsedIntent.requestedInfoType;
  logger.debug(`[FLOW_STATE] Overriding requestedInfoType in slots to "${parsedIntent.requestedInfoType}"`);
}
```
- **Always overrides**: If parsed intent has `requestedInfoType`

---

**Decision Point 3.16: Medication Name Change Detection** (Lines 169-181)
```typescript
if (parsedIntent.extractedMedicationName && parsedIntent.containsMedicationName) {
  const currentMedicationName = state.sharedSlots.medicationName;
  if (!currentMedicationName ||
      parsedIntent.extractedMedicationName.toLowerCase() !== currentMedicationName.toLowerCase()) {
    // Medication name changed
    updatedSlots.medicationName = parsedIntent.extractedMedicationName;
    state.sharedSlots.medicationName = undefined;
    state.sharedSlots.medicationId = undefined;
    state.sharedSlots.lastToolResult = undefined;
  }
}
```

**Decision Logic**:
1. **Does parsed intent have medication name?**
   - **If NO**: Skip
   - **If YES**: Check if different

2. **Is medication name different?**
   - **If YES**: 
     - Update slot
     - **Clear shared slots** (medicationName, medicationId, lastToolResult)
     - **Why**: New medication = need new tool calls
   - **If NO**: Keep existing

---

**Decision Point 3.17: Info Type Extraction from Confirmation** (Lines 183-191)
```typescript
if (activeFlow.step === MedicationInfoStep.ASK_INFO_TYPE || 
    (parsedIntent.containsMedicationName && parsedIntent.extractedMedicationName && !parsedIntent.requestedInfoType)) {
  const infoType = extractInfoTypeFromConfirmation(activeFlow, parsedIntent, state);
  if (infoType) {
    updatedSlots.requestedInfoType = infoType;
    state.sharedSlots.requestedInfoType = infoType;
  }
}
```

**Function 3.6: `extractInfoTypeFromConfirmation()`**
**File**: `src/agent/flowManager/state/slotUpdates.ts:27-58`  
**Called by**: `updateFlowStateFromMessage()` (line 185)

**Decision Logic** (Priority Order):

1. **If `parsedIntent.requestedInfoType` exists**: Return it (highest priority)

2. **If `state.sharedSlots.requestedInfoType` exists**: Return it

3. **If `activeFlow.slots.requestedInfoType` exists**: Return it

4. **If `parsedIntent.intent === 'confirm_yes'` AND `lastPresentedText` exists**:
   - Check `lastPresentedText.content`:
     - Contains "prescription" → return `'prescription'`
     - Contains "stock"/"availability" → return `'stock'`
     - Contains "dosage"/"dose" → return `'dosage'`
     - Contains "ingredient"/"active" → return `'active_ingredients'`

5. **Otherwise**: Return `undefined`

**Why**: User said "yes" but we need to infer what they're confirming from last message

---

**Decision Point 3.18: Intent Validity for Step** (Lines 193-202)
```typescript
const isValidIntent = flowDef.isValidIntentForStep
  ? flowDef.isValidIntentForStep(activeFlow.step, parsedIntent)
  : true;

if (!isValidIntent) {
  return { ...state, language: parsedIntent.language };
}
```

**Function Call**: `flowDef.isValidIntentForStep()` (if exists)

**Example** (from `medicationInfo.ts:17-36`):
```typescript
isValidIntentForStep: (step, parsedIntent) => {
  if (step === MedicationInfoStep.ASK_INFO_TYPE) {
    if (parsedIntent.intent === 'confirm_yes') {
      return true;
    }
    if (parsedIntent.intent === 'request_medication_info') {
      return !!parsedIntent.requestedInfoType;
    }
    return false;
  }
  // ... other steps
}
```

**Decision**: Is intent valid for current step?
- **If NO**: Return state unchanged (early exit)
- **If YES**: Continue

**Why**: Prevents invalid intents in wrong steps (e.g., "check stock" in `ASK_INFO_TYPE` step)

---

**Decision Point 3.19: Step Transition** (Lines 219-225)
```typescript
const transitionResult = flowDef.transitions(activeFlow.step, stateForTransition, parsedIntent);
if (transitionResult !== null) {
  nextStep = transitionResult;
  logger.debug(`[FLOW_STATE] Step transition: ${activeFlow.step} -> ${nextStep}`);
} else {
  logger.debug(`[FLOW_STATE] No step transition - staying at: ${activeFlow.step}`);
}
```

**Function Call**: `flowDef.transitions()` - **CODE-CONTROLLED**

**Example** (from `medicationInfo.ts:52-97`):
```typescript
transitions: (currentStep, state, parsedIntent) => {
  if (currentStep === MedicationInfoStep.COLLECT_MEDICATION_NAME) {
    if (state.sharedSlots.medicationName) {
      const hasRequestedInfoType = currentFlow?.slots.requestedInfoType || state.sharedSlots.requestedInfoType;
      if (hasRequestedInfoType) {
        return MedicationInfoStep.PROVIDE_INFO; // Skip ASK_INFO_TYPE
      }
      return MedicationInfoStep.ASK_INFO_TYPE;
    }
    return currentStep; // Stay here
  }
  // ... other steps
}
```

**Decision Logic**:
- **Checks**: Current step, state slots, parsed intent
- **Returns**: Next step OR `null` (stay current)
- **Code-controlled**: LLM doesn't decide transitions

**Why**: Ensures required slots filled before advancing

---

**Decision Point 3.20: Pending Intent Clearing** (Lines 229-236)
```typescript
let clearedPendingIntent = false;
const hasMedication = state.sharedSlots.medicationName || updatedSlots.medicationName;
if (state.sharedSlots.pendingIntent && 
    hasMedication &&
    (finalRequestedInfoType || updatedSlots.requestedInfoType)) {
  clearedPendingIntent = true;
  logger.debug(`[FLOW_STATE] Cleared PENDING INTENT - both medication and requestedInfoType are now available`);
}
```

**Decision Logic**:
- **If**: `pendingIntent` exists + medication exists + `requestedInfoType` exists
- **Then**: Clear pending intent (we have everything now)

**Why**: User said "check stock" (pending) → now said "Aspirin" → clear pending, proceed

---

**Returns**: Updated `FlowState` with new step, updated slots

---

## 📍 PHASE 4: Prompt Generation

### **Function 4: `generateFlowAwarePrompt()`**
**File**: `src/agent/flowManager/prompt/index.ts:23-70`  
**Called by**: `processMessageStream()` (lines 34/55/94/161)

**Decision Point 4.1: Active Flow Detection** (Lines 25-27)
```typescript
const activeFlowType = flowState._activeFlowType!;
const activeFlow = flowState.flows[activeFlowType]!;
const flowDef = FLOW_DEFINITIONS[activeFlowType];
```

**Decision Point 4.2: Step Description** (Line 28)
```typescript
const stepDescription = activeFlow.step ? flowDef.getStepDescription(activeFlow.step) : 'Completed';
```
- **If step exists**: Get description
- **If no step**: "Completed"

**Function Calls** (Lines 32-60):
- `buildBasicContext()` - basic context
- `buildMedicationContext()` - medication data
- `buildRequestedInfoContext()` - requested info type
- Flow-specific builders (inventory, prescription, medication info)
- `buildPromptEnding()` - ending instructions

**Returns**: Complete system prompt string

---

## 📍 PHASE 5: Message Building

### **Function 5: `buildInitialMessages()`**
**File**: `src/agent/core/messageBuilder.ts:4-23`  
**Called by**: `processMessageStream()` (line 40)

**Decision Point 5.1: Last Presented Text** (Lines 13-18)
```typescript
if (flowState?.sharedSlots.lastPresentedText) {
  messages.push({
    role: 'assistant',
    content: flowState.sharedSlots.lastPresentedText.content,
  });
}
```
- **Decision**: Does `lastPresentedText` exist?
- **If YES**: Add to messages (for context)
- **If NO**: Skip

**Returns**: Message array `[system, assistant?, user]`

---

## 📍 PHASE 6: Tool Choice Decision

### **Function 6: `determineToolChoice()`**
**File**: `src/agent/core/toolChoice.ts:4-62`  
**Called by**: `processMessageStream()` (line 58)  
**CRITICAL DECISION POINT**

**Decision Point 6.1: Initial Values** (Lines 9-11)
```typescript
let toolChoice: 'auto' | 'required' | { type: 'function'; name: string } | null = 'auto';
let allowTools = true;
let expectingToolCall = false;
```

**Decision Point 6.2: Flow State Check** (Line 13)
```typescript
if (flowState) {
  // Process flow state
}
```
- **If NO flowState**: Return defaults (`toolChoice: 'auto'`, `allowTools: true`, `expectingToolCall: false`)

**Decision Point 6.3: Active Flow Check** (Line 18)
```typescript
if (activeFlow.step) {
  // Check step-specific tool requirements
}
```

**Decision Point 6.4: COLLECT_MEDICATION_NAME Step** (Lines 19-29)
```typescript
if ((activeFlowType === FlowTypeEnum.MEDICATION_INFO &&
    activeFlow.step === MedicationInfoStep.COLLECT_MEDICATION_NAME) ||
    (activeFlowType === FlowTypeEnum.INVENTORY_CHECK &&
    activeFlow.step === InventoryCheckStep.COLLECT_MEDICATION_NAME) ||
    (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION &&
    activeFlow.step === PrescriptionConfirmationStep.COLLECT_MEDICATION_NAME)) {
  if (activeFlow.slots.medicationName && !flowState.sharedSlots.medicationName) {
    toolChoice = { type: 'function', name: 'getMedicationByName' };
    expectingToolCall = true;
  }
}
```

**Decision Logic**:
- **If**: In `COLLECT_MEDICATION_NAME` step + `medicationName` in slot + no `medicationName` in shared slots
- **Then**: **FORCE** `getMedicationByName` tool call
- **Why**: Need to resolve medication name → medication ID

**Decision Point 6.5: PROVIDE_INFO Step with Stock/Prescription** (Lines 30-42)
```typescript
else if (activeFlowType === FlowTypeEnum.MEDICATION_INFO &&
         activeFlow.step === MedicationInfoStep.PROVIDE_INFO &&
         flowState.sharedSlots.medicationId) {
  const requestedInfoType = activeFlow.slots.requestedInfoType || flowState.sharedSlots.requestedInfoType;
  if (requestedInfoType === 'stock') {
    toolChoice = { type: 'function', name: 'checkInventory' };
    expectingToolCall = true;
  }
  else if (requestedInfoType === 'prescription') {
    toolChoice = { type: 'function', name: 'requiresPrescription' };
    expectingToolCall = true;
  }
}
```

**Decision Logic**:
- **If**: In `PROVIDE_INFO` step + `medicationId` exists + `requestedInfoType === 'stock'`
- **Then**: **FORCE** `checkInventory` tool call

- **If**: In `PROVIDE_INFO` step + `medicationId` exists + `requestedInfoType === 'prescription'`
- **Then**: **FORCE** `requiresPrescription` tool call

**Why**: User requested stock/prescription info, need to call tool

**Decision Point 6.6: Flow-Specific Tool Requirements** (Lines 43-49)
```typescript
else {
  const forcedTool = flowDef.getToolForStep?.(activeFlow.step);
  if (forcedTool) {
    toolChoice = { type: 'function', name: forcedTool };
    expectingToolCall = true;
  }
}
```

**Decision Logic**:
- **If**: Flow definition has `getToolForStep()` for current step
- **Then**: **FORCE** that tool
- **Why**: Some steps require specific tools (e.g., `CHECK_INVENTORY` step requires `checkInventory`)

**Decision Point 6.7: Disable Tools in Final Steps** (Lines 52-58)
```typescript
if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK && 
    activeFlow.step === InventoryCheckStep.PROVIDE_RESULT) {
  allowTools = false;
} else if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION && 
           activeFlow.step === PrescriptionConfirmationStep.PROVIDE_RESULT) {
  allowTools = false;
}
```

**Decision Logic**:
- **If**: In `PROVIDE_RESULT` step (final step before COMPLETE)
- **Then**: `allowTools = false`
- **Why**: No more tools needed, just provide result

**Returns**: `{toolChoice, allowTools, expectingToolCall}`

**Critical**: This determines which handler to use (non-streaming vs streaming)

---

## 📍 PHASE 7: Model Selection

**Decision Point 7.1: Model Selection** (Lines 60-62 in agent.ts)
```typescript
const modelForToolCalls = process.env.OPENAI_SMALL_MODEL || 'gpt-4o';
const modelForResponses = process.env.OPENAI_MODEL || 'gpt-4o';
const selectedModel = expectingToolCall ? modelForToolCalls : modelForResponses;
```

**Decision Logic**:
- **If `expectingToolCall === true`**: Use `OPENAI_SMALL_MODEL` (gpt-4o)
- **If `expectingToolCall === false`**: Use `OPENAI_MODEL` (gpt-5)

**Why**: Fast model for tools, quality model for responses

---

## 📍 PHASE 8: Handler Selection

**Decision Point 8.1: Handler Branch** (Line 64 in agent.ts)
```typescript
if (expectingToolCall) {
  // Non-streaming handler
} else {
  // Streaming handler
}
```

**Decision**: Based on `expectingToolCall` flag from `determineToolChoice()`

---

### **BRANCH A: Non-Streaming Handler** (`expectingToolCall === true`)

**Function Call 8.2: `handleNonStreamingRequest()`** (Line 65)
- **Model**: gpt-4o
- **Streaming**: `false`
- **Purpose**: Deterministic tool selection

**Returns**: `{assistantMessage, toolCalls, updatedFlowState, updatedMessages, toolsExecuted, newToolCallCount}`

**Decision Point 8.3: Tool Error Check** (Lines 82-98)
```typescript
if (result.updatedFlowState?.sharedSlots.lastToolResult && 
    typeof result.updatedFlowState?.sharedSlots.lastToolResult === 'object' && 
    'error' in result.updatedFlowState?.sharedSlots.lastToolResult) {
  // Handle error
  const { cleanedFlowState, errorMessage } = handleToolError(result.updatedFlowState);
  // Add error message, regenerate prompt, continue iteration
  continue;
}
```

**Decision**: Did tool return error?
- **If YES**: Clean state, inject error message, continue iteration
- **If NO**: Check tool calls

**Decision Point 8.4: Tool Calls Check** (Lines 100-107)
```typescript
if (result.toolCalls.length > 0) {
  if (result.toolsExecuted === 0 && result.toolCalls.length > 0 && iteration >= maxIterations - 1) {
    yield* handleFallbackResponse(messages, flowState);
    return;
  }
  continue; // Continue iteration with tool results
}
```

**Decision Logic**:
1. **Are there tool calls?**
   - **If NO**: Check assistant message (line 109)
   - **If YES**: Check if tools executed

2. **Did tools execute?**
   - **If NO** AND `iteration >= maxIterations - 1`: Fallback response
   - **If YES** OR `iteration < maxIterations - 1`: Continue iteration

**Decision Point 8.5: Assistant Message Check** (Lines 109-118)
```typescript
if (result.assistantMessage) {
  yield* handleAssistantResponse(...);
  return;
}
```

**Decision**: Does LLM have message (no tool calls)?
- **If YES**: Stream response, **RETURN** (done)
- **If NO**: Continue iteration

---

### **BRANCH B: Streaming Handler** (`expectingToolCall === false`)

**Function Call 8.6: `handleStreamingRequest()`** (Line 122)
- **Model**: gpt-5
- **Streaming**: `true`
- **Purpose**: User-facing responses

**Process**:
1. Streams text chunks as they arrive
2. Collects tool calls if any
3. After stream completes, executes tools if any
4. Returns result

**Decision Point 8.7: Stream Result Check** (Lines 141-143)
```typescript
if (!streamResult) {
  continue; // No result, continue iteration
}
```

**Decision Point 8.8: Tool Error Check (Streaming)** (Lines 149-165)
- Same as non-streaming: Check for errors, handle, continue

**Decision Point 8.9: Tool Calls vs Message** (Lines 167-191)
```typescript
if (streamResult.toolCalls.length > 0) {
  // Has tool calls
  if (streamResult.toolsExecuted === 0 && iteration >= maxIterations - 1) {
    yield* handleFallbackResponse(...);
    return;
  }
  continue; // Continue with tool results
} else if (streamResult.assistantMessage && streamResult.assistantMessage.trim()) {
  // Has message, no tool calls
  const parsed = parseAgentResponse(streamResult.assistantMessage);
  // Update lastPresentedText
  yield { content: '', done: true, context: { flowState }, options: responseOptions };
  return; // Done
}
```

**Decision Logic**:
1. **Are there tool calls?**
   - **If YES**: Execute tools, continue iteration
   - **If NO**: Check message

2. **Is there assistant message?**
   - **If YES**: Parse, update state, yield final chunk, **RETURN**
   - **If NO**: Continue iteration

---

## 📍 PHASE 9: Iteration Loop

**Decision Point 9.1: Iteration Limit** (Line 48 in agent.ts)
```typescript
while (iteration < maxIterations) {
  iteration++;
  // Process iteration
}
```

**Decision**: Is `iteration < 5`?
- **If YES**: Continue
- **If NO**: Exit loop (max iterations reached)

**Decision Point 9.2: Prompt Regeneration** (Lines 54-56)
```typescript
if (iteration > 1 && flowState) {
  messages[0].content = generateFlowAwarePrompt(flowState);
}
```

**Decision**: Is this iteration > 1?
- **If YES**: Regenerate prompt (state may have changed)
- **If NO**: Use initial prompt

**Why**: After tool calls, state updated, need fresh prompt

---

## 📍 PHASE 10: Response Handling

### **Function 7: `handleAssistantResponse()`**
**File**: `src/agent/core/responseHandler.ts:12-47`  
**Called by**: `processMessageStream()` (line 110)

**Function Call 7.1: `parseAgentResponse()`** (Line 19)
- Parses JSON: `{response: "...", options: [...]}`

**Decision Point 7.2: Text Type Determination** (Lines 24-29)
```typescript
let textType: LastPresentedText['type'] = 'general';
if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK) textType = 'stock';
else if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION) textType = 'prescription';
else if (updatedFlowState.sharedSlots.medicationName) textType = 'medication_info';
```

**Decision Logic**:
- Based on flow type and medication presence
- Used for context tracking

**Function Call 7.3: `updateLastPresentedText()`** (Line 31)
- Updates `flowState.sharedSlots.lastPresentedText`

**Process**: Yields chunks word-by-word with 20ms delay (typing effect)

**Returns**: Final chunk `{content: '', done: true, context: {flowState}, options: [...]}`

---

## 📍 PHASE 11: SSE Streaming

**Process** (Lines 55-72 in chat.ts):
```typescript
for await (const chunk of stream) {
  const data = JSON.stringify({
    content: chunk.content || '',
    done: chunk.done,
    context: chunk.context,
    options: chunk.options
  });
  reply.raw.write(`data: ${data}\n\n`);
  
  if (chunk.done) {
    break;
  }
}
```

**Decision Point 11.1: Chunk Done** (Line 69)
```typescript
if (chunk.done) {
  break;
}
```
- **If `done === true`**: Stop streaming
- **If `done === false`**: Continue streaming

---

## 🎯 Complete Decision Tree

```
Client Message Arrives
│
├─ [Decision 1.1] Is message valid?
│  ├─ NO → Return 400, STOP
│  └─ YES → Continue
│
├─ [Decision 1.2] Is flowState valid?
│  ├─ NO → Log warning, CONTINUE
│  └─ YES → Continue
│
├─ [Decision 2.1] Does flowState exist?
│  ├─ NO → initializeFlowState()
│  └─ YES → Use existing
│
├─ [Decision 3.1] Parse Intent (LLM Call #1)
│  └─ Returns: ParsedUserIntent
│
├─ [Decision 3.2] Is intent 'unknown' or 'confirm_yes'?
│  ├─ YES → Check pendingIntent
│  │   ├─ Exists → Use pending, switch flow
│  │   └─ Doesn't exist → Check context-aware recovery
│  │       └─ Extract from lastPresentedText
│  └─ NO → Continue
│
├─ [Decision 3.3] Map intent to flow type
│  └─ Returns: FlowType | null
│
├─ [Decision 3.4] Does target flow differ from current?
│  ├─ YES → handleFlowSwitch()
│  └─ NO → Continue
│
├─ [Decision 3.5] Is intent valid for current step?
│  ├─ NO → Return state unchanged
│  └─ YES → Continue
│
├─ [Decision 3.6] Update slots from intent
│  └─ Updates: medicationName, requestedInfoType
│
├─ [Decision 3.7] Step transition (CODE-CONTROLLED)
│  └─ flowDef.transitions() → next step
│
├─ [Decision 6.1] determineToolChoice()
│  ├─ In COLLECT_MEDICATION_NAME + medicationName exists?
│  │   └─ YES → Force getMedicationByName
│  ├─ In PROVIDE_INFO + requestedInfoType === 'stock'?
│  │   └─ YES → Force checkInventory
│  ├─ In PROVIDE_INFO + requestedInfoType === 'prescription'?
│  │   └─ YES → Force requiresPrescription
│  ├─ Step has getToolForStep()?
│  │   └─ YES → Force that tool
│  └─ Otherwise → tool_choice: 'auto'
│
├─ [Decision 7.1] expectingToolCall?
│  ├─ YES → handleNonStreamingRequest() (gpt-4o)
│  │   ├─ Tool error? → Handle error, continue
│  │   ├─ Tool calls? → Execute, continue iteration
│  │   └─ Message? → handleAssistantResponse(), RETURN
│  └─ NO → handleStreamingRequest() (gpt-5)
│      ├─ Stream chunks
│      ├─ Tool calls? → Execute, continue iteration
│      └─ Message? → Parse, update state, RETURN
│
└─ [Decision 9.1] iteration < maxIterations?
   ├─ YES → Continue loop
   └─ NO → Exit (fallback if needed)
```

---

## 🔑 Key Decision Points Summary

| Decision Point | Location | Logic | Impact |
|---------------|----------|-------|--------|
| **Message Validation** | `chat.ts:29` | Empty/invalid message? | Blocks request |
| **State Initialization** | `messageUpdates.ts:20` | State exists? | Creates new or uses existing |
| **Intent Parsing** | `intent.ts:38` | LLM call (gpt-4o) | Extracts intent, medication, info type |
| **Pending Intent** | `messageUpdates.ts:31` | pendingIntent exists? | Uses pending or context recovery |
| **Flow Switching** | `messageUpdates.ts:93/109` | Target flow differs? | Switches flows, preserves shared slots |
| **Intent Validation** | `validation.ts:8` | requestedInfoType conflicts? | Rejects invalid intent |
| **Step Transition** | `medicationInfo.ts:52` | Required slots filled? | Advances step or stays |
| **Tool Choice** | `toolChoice.ts:19-49` | Step requires tool? | Forces tool or allows auto |
| **Model Selection** | `agent.ts:62` | expectingToolCall? | gpt-4o (tools) vs gpt-5 (responses) |
| **Handler Selection** | `agent.ts:64` | expectingToolCall? | Non-streaming vs streaming |
| **Tool Error** | `agent.ts:82/149` | Tool returned error? | Cleans state, retries |
| **Iteration Limit** | `agent.ts:48` | iteration < 5? | Continues or exits |

---

## 💡 Interview Talking Points

### **Critical Decisions**:

1. **Intent Parsing (LLM)**: First decision point - extracts user intent
2. **Flow Switching (Code)**: Code decides when to switch flows
3. **Step Transitions (Code)**: Code enforces required slots before advancing
4. **Tool Choice (Code)**: Code determines which tools allowed
5. **Model Selection (Code)**: Code routes to correct model based on `expectingToolCall`

### **Why These Decisions Matter**:

- **Intent Parsing**: Determines what user wants (LLM decision)
- **Flow Switching**: Ensures correct flow activated (code decision)
- **Step Transitions**: Prevents skipping required steps (code decision)
- **Tool Choice**: Prevents invalid tool calls (code decision)
- **Model Selection**: Optimizes latency/cost (code decision)

### **Error Recovery**:

- **Intent parsing fails**: Falls back to `unknown`, system asks clarifying questions
- **Tool fails**: Cleans state, injects error message, retries
- **Max iterations**: Generates fallback response
- **Invalid intent**: Rejects, stays in current step

---

This completes the deep dive into client message flow! Every function, every decision, every piece of logic is traced. 🎯

