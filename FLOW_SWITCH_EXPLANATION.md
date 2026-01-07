# Flow Switch Mechanism & `getInventoryCheckInitialStep` Explained

## 🎯 Overview: What is Flow Switching?

**Flow switching** happens when the user changes their intent mid-conversation. The system switches from one flow to another while preserving relevant context.

**Example**:
- User: "Tell me about Aspirin" → `MEDICATION_INFO` flow
- User: "Is it in stock?" → Switch to `INVENTORY_CHECK` flow

---

## 📋 Flow Switch Process

### **Step 1: When Flow Switch is Triggered**

Flow switch is triggered in `messageUpdates.ts` when:

1. **Intent Dominance** (Line 92-103):
   ```typescript
   if (hasSpecificIntent && hasRequestedInfoType) {
     if (targetFlowType !== state._activeFlowType) {
       const newState = handleFlowSwitch(state, targetFlowType, parsedIntent);
       return newState;
     }
   }
   ```
   - **When**: User has specific intent + requestedInfoType + different flow
   - **Example**: User says "check stock" while in `MEDICATION_INFO` flow

2. **General Flow Switch** (Line 109-119):
   ```typescript
   if (targetFlowType && targetFlowType !== state._activeFlowType) {
     const newState = handleFlowSwitch(state, targetFlowType, parsedIntent);
     return newState;
   }
   ```
   - **When**: Intent maps to different flow
   - **Example**: User says "check prescription" while in `INVENTORY_CHECK` flow

---

### **Step 2: `handleFlowSwitch()` Function**

**File**: `src/agent/flowManager/state/flowSwitch.ts:87-168`

**What it does**:
1. Gets or creates the target flow state
2. Preserves medication data (if same medication)
3. Clears medication data (if new medication)
4. Determines initial step for the new flow
5. Creates new state with switched flow

**Process**:

```typescript
export function handleFlowSwitch(
  state: FlowState,
  targetFlowType: FlowType,
  parsedIntent: ParsedUserIntent
): FlowState {
  // 1. Get or create target flow state
  const newFlowState = getOrCreateFlowState(state, targetFlowType);
  
  // 2. Handle medication name
  if (extractedMedicationName && extractedMedicationName !== currentMedicationName) {
    // NEW medication - clear shared slots
    newFlowState.slots.medicationName = extractedMedicationName;
    state.sharedSlots.medicationId = undefined;
    state.sharedSlots.medicationName = undefined;
  } else {
    // SAME medication - preserve shared slots
    if (state.sharedSlots.medicationName) {
      newFlowState.slots.medicationName = state.sharedSlots.medicationName;
    }
    if (state.sharedSlots.medicationId) {
      newFlowState.slots.medicationId = state.sharedSlots.medicationId;
    }
  }
  
  // 3. Handle requestedInfoType
  if (parsedIntent.requestedInfoType) {
    newFlowState.slots.requestedInfoType = parsedIntent.requestedInfoType;
  } else if (state.sharedSlots.requestedInfoType) {
    newFlowState.slots.requestedInfoType = state.sharedSlots.requestedInfoType;
  }
  
  // 4. Determine if new medication
  const hasNewMedication = Boolean(extractedMedicationName &&
      extractedMedicationName.toLowerCase() !== currentMedicationName?.toLowerCase());
  
  // 5. Clear shared slots if new medication
  if (hasNewMedication) {
    updatedSharedSlots.medicationName = undefined;
    updatedSharedSlots.medicationId = undefined;
    updatedSharedSlots.lastToolResult = undefined;
    updatedSharedSlots.medicationData = undefined;
  }
  
  // 6. Determine initial step (THIS IS WHERE getInventoryCheckInitialStep IS CALLED)
  let initialStep = newFlowState.step;
  if (targetFlowType === FlowTypeEnum.INVENTORY_CHECK) {
    initialStep = getInventoryCheckInitialStep(hasNewMedication, updatedSharedSlots, newFlowState);
  }
  // ... other flows
  
  // 7. Create new state
  const newState = {
    ...state,
    flows: {
      ...state.flows,
      [state._activeFlowType!]: { ...state.flows[state._activeFlowType!], isActive: false },
      [targetFlowType]: { ...newFlowState, step: initialStep, isActive: true },
    },
    _activeFlowType: targetFlowType,
  };
  
  return newState;
}
```

**Key Points**:
- **Preserves**: Shared slots (medicationName, medicationId, medicationData) if same medication
- **Clears**: Shared slots if new medication
- **Preserves**: Pending intent/info type
- **Sets**: Initial step based on current state

---

## 🔍 `getInventoryCheckInitialStep()` Deep Dive

**File**: `src/agent/flowManager/state/flowSwitch.ts:11-38`

**Purpose**: Determines which step to start at when switching to `INVENTORY_CHECK` flow.

**Why it matters**: We don't always start at `COLLECT_MEDICATION_NAME`. If we already have medication data or recent stock results, we can skip ahead.

---

### **Function Signature**

```typescript
function getInventoryCheckInitialStep(
  hasNewMedication: boolean,           // Is this a different medication?
  updatedSharedSlots: FlowState['sharedSlots'],  // Current shared state
  newFlowState: { slots: Partial<Record<string, unknown>> }  // New flow's slots
): InventoryCheckStep
```

**Parameters**:
1. `hasNewMedication`: `true` if user mentioned a different medication
2. `updatedSharedSlots`: Current shared slots (medicationName, medicationId, lastToolResult, etc.)
3. `newFlowState`: The new flow's slots (may have medicationName from previous flow)

---

### **Decision Logic (Step by Step)**

#### **Decision 1: New Medication?** (Lines 16-18)
```typescript
if (hasNewMedication) {
  return InventoryCheckStep.COLLECT_MEDICATION_NAME;
}
```

**Logic**: If user mentioned a different medication, we need to collect it fresh.

**Example**:
- Previous: "Tell me about Aspirin" (MEDICATION_INFO flow)
- Current: "Is Ibuprofen in stock?" (switching to INVENTORY_CHECK)
- **Result**: `COLLECT_MEDICATION_NAME` (need to resolve "Ibuprofen" → medicationId)

**Why**: New medication = need to call `getMedicationByName` tool

---

#### **Decision 2: Recent Stock Data?** (Lines 20-30)
```typescript
const lastResult = updatedSharedSlots.lastToolResult;
const hasRecentStockData = lastResult &&
  typeof lastResult === 'object' &&
  lastResult !== null &&
  'success' in lastResult &&
  'stock' in lastResult &&
  (lastResult as { success: boolean; stock?: number }).success === true &&
  updatedSharedSlots.medicationId;

if (hasRecentStockData) {
  return InventoryCheckStep.PROVIDE_RESULT;
}
```

**Logic**: Check if we already have recent stock data from `checkInventory` tool.

**Conditions** (ALL must be true):
1. `lastToolResult` exists
2. `lastToolResult` is an object
3. `lastToolResult.success === true`
4. `lastToolResult` has `stock` property
5. `medicationId` exists in shared slots

**Example**:
- Previous: User asked "Is Aspirin in stock?" → `checkInventory` tool called → result stored in `lastToolResult`
- Current: User says "check stock" again (same medication)
- **Result**: `PROVIDE_RESULT` (skip tool call, use cached result)

**Why**: Avoid redundant tool calls - if we just checked stock, use that result

---

#### **Decision 3: Has Medication ID?** (Lines 31-32)
```typescript
else if (updatedSharedSlots.medicationId) {
  return InventoryCheckStep.CHECK_INVENTORY;
}
```

**Logic**: If we have `medicationId` but no recent stock data, go directly to checking inventory.

**Example**:
- Previous: "Tell me about Aspirin" → `getMedicationByName` called → `medicationId` stored
- Current: "Is it in stock?" (switching to INVENTORY_CHECK)
- **Result**: `CHECK_INVENTORY` (skip collecting name, go straight to tool call)

**Why**: We already have `medicationId` from previous flow, just need to call `checkInventory`

---

#### **Decision 4: Has Medication Name?** (Lines 33-35)
```typescript
else if (updatedSharedSlots.medicationName || newFlowState.slots.medicationName) {
  return InventoryCheckStep.COLLECT_MEDICATION_NAME;
}
```

**Logic**: If we have medication name but no ID, we need to resolve it.

**Example**:
- Previous: User said "Aspirin" but no tool called yet
- Current: "check stock" (switching to INVENTORY_CHECK)
- **Result**: `COLLECT_MEDICATION_NAME` (need to call `getMedicationByName` to get ID)

**Why**: Need `medicationId` before calling `checkInventory`

---

#### **Decision 5: Default Fallback** (Line 37)
```typescript
return InventoryCheckStep.COLLECT_MEDICATION_NAME;
```

**Logic**: If nothing matches, start from the beginning.

**When**: No medication name, no medication ID, no recent data
**Result**: `COLLECT_MEDICATION_NAME`

---

## 📊 Complete Decision Tree

```
getInventoryCheckInitialStep()
│
├─ [Decision 1] hasNewMedication === true?
│  └─ YES → COLLECT_MEDICATION_NAME (need to resolve new medication)
│
├─ [Decision 2] Has recent stock data?
│  │ Conditions:
│  │ - lastToolResult exists
│  │ - lastToolResult.success === true
│  │ - lastToolResult has 'stock' property
│  │ - medicationId exists
│  └─ YES → PROVIDE_RESULT (use cached result, skip tool call)
│
├─ [Decision 3] Has medicationId?
│  └─ YES → CHECK_INVENTORY (call checkInventory tool)
│
├─ [Decision 4] Has medicationName?
│  └─ YES → COLLECT_MEDICATION_NAME (need to resolve name → ID)
│
└─ [Default] Nothing matches?
   └─ COLLECT_MEDICATION_NAME (start from beginning)
```

---

## 🎯 Real-World Examples

### **Example 1: Same Medication, Recent Stock Data**

**Scenario**:
1. User: "Is Aspirin in stock?" → `INVENTORY_CHECK` flow → `checkInventory` called → stock = 50
2. User: "Tell me about Aspirin" → `MEDICATION_INFO` flow
3. User: "check stock" again → Switch back to `INVENTORY_CHECK`

**Flow Switch**:
- `hasNewMedication = false` (same medication)
- `lastToolResult = {success: true, stock: 50}` (recent stock data)
- `medicationId = "aspirin-123"` (exists)

**Result**: `PROVIDE_RESULT` ✅
- **Why**: We have recent stock data, no need to call tool again
- **User sees**: Stock result immediately (cached)

---

### **Example 2: Same Medication, No Recent Stock Data**

**Scenario**:
1. User: "Tell me about Aspirin" → `MEDICATION_INFO` flow → `getMedicationByName` called → `medicationId` stored
2. User: "Is it in stock?" → Switch to `INVENTORY_CHECK`

**Flow Switch**:
- `hasNewMedication = false` (same medication)
- `lastToolResult = {success: true, medicationData: {...}}` (from `getMedicationByName`, NOT stock)
- `medicationId = "aspirin-123"` (exists)

**Result**: `CHECK_INVENTORY` ✅
- **Why**: We have `medicationId` but no stock data yet
- **Next**: System calls `checkInventory` tool

---

### **Example 3: New Medication**

**Scenario**:
1. User: "Tell me about Aspirin" → `MEDICATION_INFO` flow
2. User: "Is Ibuprofen in stock?" → Switch to `INVENTORY_CHECK` with new medication

**Flow Switch**:
- `hasNewMedication = true` (different medication: Aspirin → Ibuprofen)

**Result**: `COLLECT_MEDICATION_NAME` ✅
- **Why**: New medication, need to resolve "Ibuprofen" → medicationId first
- **Next**: System calls `getMedicationByName("Ibuprofen")`

---

### **Example 4: Medication Name Only, No ID**

**Scenario**:
1. User: "Aspirin" (just the name, no tool called yet)
2. User: "check stock" → Switch to `INVENTORY_CHECK`

**Flow Switch**:
- `hasNewMedication = false` (same medication)
- `lastToolResult = undefined` (no tool called)
- `medicationId = undefined` (no ID yet)
- `medicationName = "Aspirin"` (exists)

**Result**: `COLLECT_MEDICATION_NAME` ✅
- **Why**: Have name but need to resolve to ID
- **Next**: System calls `getMedicationByName("Aspirin")` → gets ID → then `checkInventory`

---

### **Example 5: Nothing Available**

**Scenario**:
1. User: "Hello" → `MEDICATION_INFO` flow (no medication)
2. User: "check stock" → Switch to `INVENTORY_CHECK`

**Flow Switch**:
- `hasNewMedication = false` (no medication change)
- `lastToolResult = undefined`
- `medicationId = undefined`
- `medicationName = undefined`

**Result**: `COLLECT_MEDICATION_NAME` ✅ (default fallback)
- **Why**: Nothing available, start from beginning
- **Next**: System asks "Which medication would you like to check stock for?"

---

## 🔑 Key Insights

### **1. Smart Step Selection**
The function doesn't always start at `COLLECT_MEDICATION_NAME`. It intelligently skips steps when data is already available.

### **2. Avoids Redundant Tool Calls**
If we have recent stock data, we skip calling `checkInventory` again (Decision 2).

### **3. Preserves Context**
If switching flows with the same medication, we preserve `medicationId` and can skip directly to `CHECK_INVENTORY` (Decision 3).

### **4. Handles New Medications**
If user mentions a different medication, we start fresh at `COLLECT_MEDICATION_NAME` (Decision 1).

### **5. Graceful Degradation**
If nothing matches, we default to `COLLECT_MEDICATION_NAME` (safe starting point).

---

## 📝 Similar Functions

The same pattern exists for other flows:

1. **`getPrescriptionConfirmationInitialStep()`** (Lines 40-67)
   - Similar logic but checks for `prescriptionRequired` in `lastToolResult`
   - Steps: `COLLECT_MEDICATION_NAME` → `CHECK_PRESCRIPTION` → `PROVIDE_RESULT`

2. **`getMedicationInfoInitialStep()`** (Lines 69-85)
   - Checks for `medicationData` and `requestedInfoType`
   - Steps: `COLLECT_MEDICATION_NAME` → `ASK_INFO_TYPE` → `PROVIDE_INFO`

---

## 💡 Interview Talking Points

### **Why This Design?**

1. **Performance**: Avoids redundant tool calls when data is already available
2. **User Experience**: Faster responses when switching flows with same medication
3. **State Efficiency**: Reuses data from previous flows
4. **Deterministic**: Code-controlled, not LLM-controlled (ensures correctness)

### **Trade-offs**:

- **Pros**: Faster, more efficient, better UX
- **Cons**: More complex logic, need to track state carefully
- **Risk**: If state is corrupted, might skip necessary steps (mitigated by validation)

### **Alternative Approaches**:

- **Always start at first step**: Simpler but slower (more tool calls)
- **LLM decides step**: More flexible but non-deterministic (harder to debug)

---

This completes the explanation of flow switching and `getInventoryCheckInitialStep`! 🎯

