import type { FlowState, FlowType } from '../../flows';
import { FLOW_DEFINITIONS, MedicationInfoStep, FlowType as FlowTypeEnum } from '../../flows';
import { mapIntentToFlowType } from '../utils';
import { parseUserIntent } from '../intent';
import logger from '../../../utils/logger';
import { initializeFlowState } from './initialization';
import { handleFlowSwitch } from './flowSwitch';
import { validateSingleIntent } from './validation';
import { updateSlotsFromIntent, extractInfoTypeFromConfirmation } from './slotUpdates';

/**
 * Updates flow state based on a user message
 * 
 * ## Core Responsibilities
 * 1. **Intent Parsing**: Calls LLM to extract user intent, medication name, and requested info type
 * 2. **Flow Switching**: Switches between flows (MEDICATION_INFO, INVENTORY_CHECK, PRESCRIPTION_CONFIRMATION) when user changes intent
 * 3. **State Updates**: Updates slots (medicationName, requestedInfoType) based on parsed intent
 * 4. **Step Transitions**: Determines next step in current flow (code-controlled, not LLM)
 * 
 * ## Key Decision Points
 * 
 * ### 1. Pending Intent Recovery (Lines 30-46)
 * - If intent is `unknown` or `confirm_yes` AND `pendingIntent` exists → Use pending intent
 * - Example: User said "check stock" (no medication) → saved as pending → user says "Aspirin" → uses pending
 * 
 * ### 2. Context-Aware Recovery (Lines 48-75)
 * - If user says "yes" AND `lastPresentedText` exists → Extract intent from last message
 * - Example: Last message: "Would you like to know the dosage?" → User: "yes" → intent: `request_medication_info`, requestedInfoType: `dosage`
 * 
 * ### 3. Intent Dominance (Lines 92-107)
 * - If user has specific intent + requestedInfoType + different flow → **Force flow switch**
 * - Example: User in MEDICATION_INFO flow → says "check stock" → switches to INVENTORY_CHECK
 * - If no medication name → saves as `pendingIntent` (user stated intent before medication)
 * 
 * ### 4. Flow Switch (Lines 109-120)
 * - If intent maps to different flow → Switch flows, preserve shared slots (medicationName, medicationId)
 * - If no medication name → saves as `pendingIntent`
 * 
 * ### 5. Pending Intent Storage (Lines 122-126)
 * - If user has intent + requestedInfoType but no medication → Save as pending
 * - Example: User says "check stock" (no medication) → saved → later says "Aspirin" → pending used
 * 
 * ### 6. Inferred Flow Switch (Lines 128-145)
 * - If intent is `unknown` + medication name + `requestedInfoType` exists in state → Infer flow from requestedInfoType
 * - Example: User said "check stock" (pending) → user says "Aspirin" → infers INVENTORY_CHECK flow
 * 
 * ### 7. Step Transition (Line 219)
 * - Calls `flowDef.transitions()` - **CODE-CONTROLLED** step transitions
 * - Checks required slots filled before advancing
 * - LLM does NOT decide step transitions (deterministic)
 * 
 * ## Flow Control Philosophy
 * - **Intent Parsing**: LLM extracts what user wants (natural language understanding)
 * - **Flow Switching**: Code decides when to switch flows (deterministic)
 * - **Step Transitions**: Code enforces required slots before advancing (deterministic)
 * - **Tool Selection**: Code determines which tools allowed (deterministic)
 * 
 * ## State Preservation
 * - **Shared Slots**: Preserved across flow switches (medicationName, medicationId, medicationData)
 * - **Pending Intent**: Saved when user states intent before medication name
 * - **Last Presented Text**: Used for context-aware recovery ("yes" responses)
 * 
 * @param currentState - Current flow state (undefined for first message)
 * @param userMessage - User's message text
 * @returns Updated flow state with new step, updated slots, and potentially switched flow
 */
export async function updateFlowStateFromMessage(
  currentState: FlowState | undefined,
  userMessage: string,
  _medicationNames: string[]
): Promise<FlowState> {
  const flowStateStartTime = Date.now();
  let state = currentState || initializeFlowState();

  logger.debug(`\n[FLOW_STATE] ========== Processing message: "${userMessage}" ==========`);
  logger.debug(`[FLOW_STATE] Current flow: ${state._activeFlowType || 'none'}, step: ${state.flows[state._activeFlowType!]?.step || 'none'}, medication: ${state.sharedSlots.medicationName || 'none'}, requestedInfoType: ${state.sharedSlots.requestedInfoType || 'none'}`);

  const parsedIntent = await parseUserIntent(userMessage, state);
  state.language = parsedIntent.language;
  
  logger.debug(`[FLOW_STATE] Parsed intent: "${parsedIntent.intent}", requestedInfoType: "${parsedIntent.requestedInfoType || 'null'}", medication: "${parsedIntent.extractedMedicationName || 'none'}"`);
  
  if (parsedIntent.intent === 'unknown' || parsedIntent.intent === 'confirm_yes') {
    if (state.sharedSlots.pendingIntent && state.sharedSlots.pendingInfoType) {
      logger.debug(`[FLOW_STATE] Using PENDING INTENT: "${state.sharedSlots.pendingIntent}" with infoType "${state.sharedSlots.pendingInfoType}"`);
      
      parsedIntent.intent = state.sharedSlots.pendingIntent;
      parsedIntent.requestedInfoType = state.sharedSlots.pendingInfoType;
      
      state.sharedSlots.pendingIntent = null;
      state.sharedSlots.pendingInfoType = null;
      
      const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
      if (targetFlowType) {
        logger.debug(`[FLOW_STATE] Switching to flow from pending intent: ${state._activeFlowType} -> ${targetFlowType}`);
        const newState = handleFlowSwitch(state, targetFlowType, parsedIntent);
        newState.sharedSlots.requestedInfoType = parsedIntent.requestedInfoType;
        return newState;
      }
    }
    else if (parsedIntent.intent === 'confirm_yes' && state.sharedSlots.lastPresentedText) {
      const lastText = state.sharedSlots.lastPresentedText.content.toLowerCase();
      if (lastText.includes('dosage') || lastText.includes('dose')) {
        parsedIntent.intent = 'request_medication_info';
        parsedIntent.requestedInfoType = 'dosage';
        const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
        if (targetFlowType && targetFlowType !== state._activeFlowType) {
          logger.debug(`[FLOW_STATE] Extracted intent from last message: ${state._activeFlowType} -> ${targetFlowType}`);
          return handleFlowSwitch(state, targetFlowType, parsedIntent);
        }
      } else if (lastText.includes('stock') || lastText.includes('availability')) {
        parsedIntent.intent = 'check_stock';
        parsedIntent.requestedInfoType = 'stock';
        const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
        if (targetFlowType && targetFlowType !== state._activeFlowType) {
          logger.debug(`[FLOW_STATE] Extracted intent from last message: ${state._activeFlowType} -> ${targetFlowType}`);
          return handleFlowSwitch(state, targetFlowType, parsedIntent);
        }
      } else if (lastText.includes('prescription')) {
        parsedIntent.intent = 'check_prescription';
        parsedIntent.requestedInfoType = 'prescription';
        const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
        if (targetFlowType && targetFlowType !== state._activeFlowType) {
          logger.debug(`[FLOW_STATE] Extracted intent from last message: ${state._activeFlowType} -> ${targetFlowType}`);
          return handleFlowSwitch(state, targetFlowType, parsedIntent);
        }
      }
    }
  }
  
  const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
  logger.debug(`[FLOW_STATE] Mapped intent "${parsedIntent.intent}" to flow type: ${targetFlowType || 'null'}`);

  const hasSpecificIntent = targetFlowType !== null;
  const hasRequestedInfoType = parsedIntent.requestedInfoType !== null && parsedIntent.requestedInfoType !== undefined;
  const hasMedicationInMessage = parsedIntent.containsMedicationName && parsedIntent.extractedMedicationName;
  
  logger.debug(`[FLOW_STATE] Intent analysis: hasSpecificIntent=${hasSpecificIntent}, hasRequestedInfoType=${hasRequestedInfoType}, hasMedicationInMessage=${hasMedicationInMessage}`);
  
  if (parsedIntent.requestedInfoType) {
    state.sharedSlots.requestedInfoType = parsedIntent.requestedInfoType;
    logger.debug(`[FLOW_STATE] HARD OVERRIDE: Setting requestedInfoType to "${parsedIntent.requestedInfoType}" from intent`);
  }

  if (hasSpecificIntent && hasRequestedInfoType) {
    if (targetFlowType !== state._activeFlowType) {
      logger.debug(`[FLOW_STATE] INTENT DOMINANCE: New command detected. Terminating flow "${state._activeFlowType}" -> Starting "${targetFlowType}"`);
      const newState = handleFlowSwitch(state, targetFlowType, parsedIntent);
      
      if (!parsedIntent.extractedMedicationName && !newState.sharedSlots.medicationName) {
        newState.sharedSlots.pendingIntent = parsedIntent.intent as 'check_stock' | 'request_medication_info' | 'check_prescription';
        newState.sharedSlots.pendingInfoType = parsedIntent.requestedInfoType;
        logger.debug(`[FLOW_STATE] Saved PENDING INTENT: "${newState.sharedSlots.pendingIntent}" with infoType "${newState.sharedSlots.pendingInfoType}"`);
      }
      
      return newState;
    } else {
      logger.debug(`[FLOW_STATE] INTENT DOMINANCE: Same flow but new requestedInfoType. Updating "${parsedIntent.requestedInfoType}"`);
    }
  }
  
  if (targetFlowType && targetFlowType !== state._activeFlowType) {
    logger.debug(`[FLOW_STATE] Flow switch detected: ${state._activeFlowType} -> ${targetFlowType}`);
    const newState = handleFlowSwitch(state, targetFlowType, parsedIntent);
    
    if (parsedIntent.requestedInfoType && !parsedIntent.extractedMedicationName && !newState.sharedSlots.medicationName) {
      newState.sharedSlots.pendingIntent = parsedIntent.intent as 'check_stock' | 'request_medication_info' | 'check_prescription';
      newState.sharedSlots.pendingInfoType = parsedIntent.requestedInfoType;
      logger.debug(`[FLOW_STATE] Saved PENDING INTENT: "${newState.sharedSlots.pendingIntent}" with infoType "${newState.sharedSlots.pendingInfoType}"`);
    }
    
    return newState;
  }
  
  if (targetFlowType && parsedIntent.requestedInfoType && !parsedIntent.extractedMedicationName && !state.sharedSlots.medicationName) {
    state.sharedSlots.pendingIntent = parsedIntent.intent as 'check_stock' | 'request_medication_info' | 'check_prescription';
    state.sharedSlots.pendingInfoType = parsedIntent.requestedInfoType;
    logger.debug(`[FLOW_STATE] Saved PENDING INTENT (same flow): "${state.sharedSlots.pendingIntent}" with infoType "${state.sharedSlots.pendingInfoType}"`);
  }

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
      logger.debug(`[FLOW_STATE] Inferred flow switch from pending requestedInfoType "${state.sharedSlots.requestedInfoType}": ${state._activeFlowType} -> ${inferredFlowType}`);
      return handleFlowSwitch(state, inferredFlowType, parsedIntent);
    }
  }

  const activeFlowType = state._activeFlowType!;
  const activeFlow = state.flows[activeFlowType]!;
  const flowDef = FLOW_DEFINITIONS[activeFlowType];

  let nextStep = activeFlow.step;
  const updatedSlots = { ...activeFlow.slots };

  const validation = validateSingleIntent(activeFlow, state, parsedIntent);
  if (!validation.isValid) {
    return {
      ...state,
      language: parsedIntent.language,
    };
  }

  Object.assign(updatedSlots, updateSlotsFromIntent(updatedSlots, state, parsedIntent));
  
  if (parsedIntent.requestedInfoType) {
    updatedSlots.requestedInfoType = parsedIntent.requestedInfoType;
    logger.debug(`[FLOW_STATE] Overriding requestedInfoType in slots to "${parsedIntent.requestedInfoType}"`);
  }

  if (parsedIntent.extractedMedicationName && parsedIntent.containsMedicationName) {
    const currentMedicationName = state.sharedSlots.medicationName;
    if (!currentMedicationName ||
        parsedIntent.extractedMedicationName.toLowerCase() !== currentMedicationName.toLowerCase()) {
      logger.debug(`[FLOW_STATE] Medication name change: "${currentMedicationName || 'none'}" -> "${parsedIntent.extractedMedicationName}"`);
      updatedSlots.medicationName = parsedIntent.extractedMedicationName;
      state.sharedSlots.medicationName = undefined;
      state.sharedSlots.medicationId = undefined;
      state.sharedSlots.lastToolResult = undefined;
    } else {
      logger.debug(`[FLOW_STATE] Medication name unchanged: "${currentMedicationName}"`);
    }
  }

  if (activeFlow.step === MedicationInfoStep.ASK_INFO_TYPE || 
      (parsedIntent.containsMedicationName && parsedIntent.extractedMedicationName && !parsedIntent.requestedInfoType)) {
    const infoType = extractInfoTypeFromConfirmation(activeFlow, parsedIntent, state);
    if (infoType) {
      updatedSlots.requestedInfoType = infoType;
      state.sharedSlots.requestedInfoType = infoType;
      logger.debug(`[FLOW_STATE] Extracted requestedInfoType from confirmation: "${infoType}"`);
    }
  }

  const isValidIntent = flowDef.isValidIntentForStep
    ? flowDef.isValidIntentForStep(activeFlow.step, parsedIntent)
    : true;

  if (!isValidIntent) {
    return {
      ...state,
      language: parsedIntent.language,
    };
  }

  const stateForTransition = {
    ...state,
    flows: {
      ...state.flows,
      [activeFlowType]: {
        ...activeFlow,
        slots: updatedSlots,
      },
    },
    sharedSlots: {
      ...state.sharedSlots,
      requestedInfoType: updatedSlots.requestedInfoType || state.sharedSlots.requestedInfoType,
    },
  };

  const transitionResult = flowDef.transitions(activeFlow.step, stateForTransition, parsedIntent);
  if (transitionResult !== null) {
    nextStep = transitionResult;
    logger.debug(`[FLOW_STATE] Step transition: ${activeFlow.step} -> ${nextStep}`);
  } else {
    logger.debug(`[FLOW_STATE] No step transition - staying at: ${activeFlow.step}`);
  }

  const finalRequestedInfoType = updatedSlots.requestedInfoType || state.sharedSlots.requestedInfoType;

  let clearedPendingIntent = false;
  const hasMedication = state.sharedSlots.medicationName || updatedSlots.medicationName;
  if (state.sharedSlots.pendingIntent && 
      hasMedication &&
      (finalRequestedInfoType || updatedSlots.requestedInfoType)) {
    clearedPendingIntent = true;
    logger.debug(`[FLOW_STATE] Cleared PENDING INTENT - both medication and requestedInfoType are now available`);
  }

  const totalTime = Date.now() - flowStateStartTime;
  logger.debug(`[FLOW_STATE] Final state: flow=${activeFlowType}, step=${nextStep}, medication=${updatedSlots.medicationName || state.sharedSlots.medicationName || 'none'}, requestedInfoType=${finalRequestedInfoType || 'none'}`);
  logger.debug(`[FLOW_STATE] Total updateFlowStateFromMessage time: ${totalTime}ms`);
  logger.debug(`[FLOW_STATE] ========== Message processing complete ==========\n`);

  return {
    ...state,
    language: parsedIntent.language,
    flows: {
      ...state.flows,
      [activeFlowType]: {
        ...activeFlow,
        step: nextStep,
        slots: updatedSlots,
      },
    },
    sharedSlots: {
      ...state.sharedSlots,
      requestedInfoType: finalRequestedInfoType,
      medicationData: state.sharedSlots.medicationData,
      pendingIntent: clearedPendingIntent ? null : state.sharedSlots.pendingIntent,
      pendingInfoType: clearedPendingIntent ? null : state.sharedSlots.pendingInfoType,
    },
  };
}

