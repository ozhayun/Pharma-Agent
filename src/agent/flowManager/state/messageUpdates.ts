import type { FlowState, FlowType } from '../../flows';
import { FLOW_DEFINITIONS, MedicationInfoStep, FlowType as FlowTypeEnum } from '../../flows';
import { mapIntentToFlowType } from '../utils';
import { parseUserIntent } from '../intent';
import logger from '../../../utils/logger';
import { initializeFlowState } from './initialization';
import { handleFlowSwitch } from './flowSwitch';
import { validateSingleIntent } from './validation';
import { updateSlotsFromIntent, extractInfoTypeFromConfirmation } from './slotUpdates';

export async function updateFlowStateFromMessage(
  currentState: FlowState | undefined,
  userMessage: string,
  _medicationNames: string[]
): Promise<FlowState> {
  const flowStateStartTime = Date.now();
  let state = currentState || initializeFlowState();

  const parsedIntent = await parseUserIntent(userMessage, state);
  state.language = parsedIntent.language;
  
  if (parsedIntent.intent === 'unknown' || parsedIntent.intent === 'confirm_yes') {
    if (state.sharedSlots.pendingIntent && state.sharedSlots.pendingInfoType) {
      parsedIntent.intent = state.sharedSlots.pendingIntent;
      parsedIntent.requestedInfoType = state.sharedSlots.pendingInfoType;
      
      state.sharedSlots.pendingIntent = null;
      state.sharedSlots.pendingInfoType = null;
      
      const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
      if (targetFlowType) {
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
          return handleFlowSwitch(state, targetFlowType, parsedIntent);
        }
      } else if (lastText.includes('stock') || lastText.includes('availability')) {
        parsedIntent.intent = 'check_stock';
        parsedIntent.requestedInfoType = 'stock';
        const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
        if (targetFlowType && targetFlowType !== state._activeFlowType) {
          return handleFlowSwitch(state, targetFlowType, parsedIntent);
        }
      } else if (lastText.includes('prescription')) {
        parsedIntent.intent = 'check_prescription';
        parsedIntent.requestedInfoType = 'prescription';
        const targetFlowType = mapIntentToFlowType(parsedIntent.intent);
        if (targetFlowType && targetFlowType !== state._activeFlowType) {
          return handleFlowSwitch(state, targetFlowType, parsedIntent);
        }
      }
    }
  }
  
  const targetFlowType = mapIntentToFlowType(parsedIntent.intent);

  const hasSpecificIntent = targetFlowType !== null;
  const hasRequestedInfoType = parsedIntent.requestedInfoType !== null && parsedIntent.requestedInfoType !== undefined;
  
  if (parsedIntent.requestedInfoType) {
    state.sharedSlots.requestedInfoType = parsedIntent.requestedInfoType;
  }

  if (hasSpecificIntent && hasRequestedInfoType) {
    if (targetFlowType !== state._activeFlowType) {
      const newState = handleFlowSwitch(state, targetFlowType, parsedIntent);
      
      if (!parsedIntent.extractedMedicationName && !newState.sharedSlots.medicationName) {
        newState.sharedSlots.pendingIntent = parsedIntent.intent as 'check_stock' | 'request_medication_info' | 'check_prescription';
        newState.sharedSlots.pendingInfoType = parsedIntent.requestedInfoType;
      }
      
      return newState;
    }
  }
  
  if (targetFlowType && targetFlowType !== state._activeFlowType) {
    const newState = handleFlowSwitch(state, targetFlowType, parsedIntent);
    
    if (parsedIntent.requestedInfoType && !parsedIntent.extractedMedicationName && !newState.sharedSlots.medicationName) {
      newState.sharedSlots.pendingIntent = parsedIntent.intent as 'check_stock' | 'request_medication_info' | 'check_prescription';
      newState.sharedSlots.pendingInfoType = parsedIntent.requestedInfoType;
    }
    
    return newState;
  }
  
  if (targetFlowType && parsedIntent.requestedInfoType && !parsedIntent.extractedMedicationName && !state.sharedSlots.medicationName) {
    state.sharedSlots.pendingIntent = parsedIntent.intent as 'check_stock' | 'request_medication_info' | 'check_prescription';
    state.sharedSlots.pendingInfoType = parsedIntent.requestedInfoType;
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
  }

  if (parsedIntent.extractedMedicationName && parsedIntent.containsMedicationName) {
    const currentMedicationName = state.sharedSlots.medicationName;
    if (!currentMedicationName ||
        parsedIntent.extractedMedicationName.toLowerCase() !== currentMedicationName.toLowerCase()) {
      updatedSlots.medicationName = parsedIntent.extractedMedicationName;
      state.sharedSlots.medicationName = undefined;
      state.sharedSlots.medicationId = undefined;
      state.sharedSlots.lastToolResult = undefined;
    }
  }

  if (activeFlow.step === MedicationInfoStep.ASK_INFO_TYPE || 
      (parsedIntent.containsMedicationName && parsedIntent.extractedMedicationName && !parsedIntent.requestedInfoType)) {
    const infoType = extractInfoTypeFromConfirmation(activeFlow, parsedIntent, state);
    if (infoType) {
      updatedSlots.requestedInfoType = infoType;
      state.sharedSlots.requestedInfoType = infoType;
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
  }

  const finalRequestedInfoType = updatedSlots.requestedInfoType || state.sharedSlots.requestedInfoType;

  let clearedPendingIntent = false;
  const hasMedication = state.sharedSlots.medicationName || updatedSlots.medicationName;
  if (state.sharedSlots.pendingIntent && 
      hasMedication &&
      (finalRequestedInfoType || updatedSlots.requestedInfoType)) {
    clearedPendingIntent = true;
  }

  const totalTime = Date.now() - flowStateStartTime;
  logger.debug(`[FLOW_STATE] Total updateFlowStateFromMessage time: ${totalTime}ms`);

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

