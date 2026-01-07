import type { FlowState, ParsedUserIntent, FlowType } from '../../flows';
import {
  FlowType as FlowTypeEnum,
  MedicationInfoStep,
  InventoryCheckStep,
  PrescriptionConfirmationStep,
} from '../../flows';
import { getOrCreateFlowState } from '../utils';
import logger from '../../../utils/logger';

function getInventoryCheckInitialStep(
  hasNewMedication: boolean,
  updatedSharedSlots: FlowState['sharedSlots'],
  newFlowState: { slots: Partial<Record<string, unknown>> }
): InventoryCheckStep {
  if (hasNewMedication) {
    return InventoryCheckStep.COLLECT_MEDICATION_NAME;
  }

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
  } else if (updatedSharedSlots.medicationId) {
    return InventoryCheckStep.CHECK_INVENTORY;
  } else if (updatedSharedSlots.medicationName || newFlowState.slots.medicationName) {
    return InventoryCheckStep.COLLECT_MEDICATION_NAME;
  }

  return InventoryCheckStep.COLLECT_MEDICATION_NAME;
}

function getPrescriptionConfirmationInitialStep(
  hasNewMedication: boolean,
  updatedSharedSlots: FlowState['sharedSlots'],
  newFlowState: { slots: Partial<Record<string, unknown>> }
): PrescriptionConfirmationStep {
  if (hasNewMedication) {
    return PrescriptionConfirmationStep.COLLECT_MEDICATION_NAME;
  }

  const lastResult = updatedSharedSlots.lastToolResult;
  const hasRecentPrescriptionData = lastResult &&
    typeof lastResult === 'object' &&
    lastResult !== null &&
    'success' in lastResult &&
    'prescriptionRequired' in lastResult &&
    (lastResult as { success: boolean }).success === true &&
    updatedSharedSlots.medicationId;

  if (hasRecentPrescriptionData) {
    return PrescriptionConfirmationStep.PROVIDE_RESULT;
  } else if (updatedSharedSlots.medicationId) {
    return PrescriptionConfirmationStep.CHECK_PRESCRIPTION;
  } else if (updatedSharedSlots.medicationName || newFlowState.slots.medicationName) {
    return PrescriptionConfirmationStep.COLLECT_MEDICATION_NAME;
  }

  return PrescriptionConfirmationStep.COLLECT_MEDICATION_NAME;
}

function getMedicationInfoInitialStep(
  updatedSharedSlots: FlowState['sharedSlots'],
  newFlowState: { slots: Partial<Record<string, unknown>> }
): MedicationInfoStep {
  const hasRequestedInfoType = newFlowState.slots.requestedInfoType || updatedSharedSlots.requestedInfoType;
  const hasMedicationData = updatedSharedSlots.medicationData || updatedSharedSlots.medicationId;

  if (hasMedicationData && hasRequestedInfoType) {
    return MedicationInfoStep.PROVIDE_INFO;
  } else if (hasMedicationData && !hasRequestedInfoType) {
    return MedicationInfoStep.ASK_INFO_TYPE;
  } else if (updatedSharedSlots.medicationName || newFlowState.slots.medicationName) {
    return MedicationInfoStep.COLLECT_MEDICATION_NAME;
  }

  return MedicationInfoStep.COLLECT_MEDICATION_NAME;
}
      
/**
 * Switches from one flow to another while preserving context
 * 
 * ## Preserves:
 * - Shared slots (medicationName, medicationId, medicationData) if same medication
 * - Pending intent/info type
 * 
 * ## Clears:
 * - Shared slots if new medication (need fresh tool calls)
 * 
 * ## Initial Step Selection:
 * - Calls flow-specific initial step function (e.g., `getInventoryCheckInitialStep`)
 * - Skips steps when data already available (e.g., has medicationId → skip COLLECT_MEDICATION_NAME)
 * 
 * ## Example:
 * - User in MEDICATION_INFO → says "check stock" → switches to INVENTORY_CHECK
 * - If same medication: Preserves medicationId, starts at CHECK_INVENTORY step
 */
export function handleFlowSwitch(
  state: FlowState,
  targetFlowType: FlowType,
  parsedIntent: ParsedUserIntent
): FlowState {
  logger.debug(`[FLOW_SWITCH] Flow switch: ${state._activeFlowType} -> ${targetFlowType}`);
  
  const newFlowState = getOrCreateFlowState(state, targetFlowType);
  const extractedMedicationName = parsedIntent.extractedMedicationName;
  const currentMedicationName = state.sharedSlots.medicationName;

  if (extractedMedicationName &&
      extractedMedicationName.toLowerCase() !== currentMedicationName?.toLowerCase()) {
    newFlowState.slots.medicationName = extractedMedicationName;
    state.sharedSlots.medicationId = undefined;
    state.sharedSlots.medicationName = undefined;
  } else {
    if (state.sharedSlots.medicationName) {
      newFlowState.slots.medicationName = state.sharedSlots.medicationName;
    }
    if (state.sharedSlots.medicationId) {
      newFlowState.slots.medicationId = state.sharedSlots.medicationId;
    }
  }

  if (parsedIntent.requestedInfoType) {
    newFlowState.slots.requestedInfoType = parsedIntent.requestedInfoType;
  } else if (state.sharedSlots.requestedInfoType) {
    newFlowState.slots.requestedInfoType = state.sharedSlots.requestedInfoType;
  }

  const updatedSharedSlots = { ...state.sharedSlots };
  const hasNewMedication = Boolean(extractedMedicationName &&
      extractedMedicationName.toLowerCase() !== currentMedicationName?.toLowerCase());

  if (hasNewMedication) {
    updatedSharedSlots.medicationName = undefined;
    updatedSharedSlots.medicationId = undefined;
    updatedSharedSlots.lastToolResult = undefined;
    updatedSharedSlots.medicationData = undefined;
  }

  let initialStep = newFlowState.step;
  if (targetFlowType === FlowTypeEnum.INVENTORY_CHECK) {
    initialStep = getInventoryCheckInitialStep(hasNewMedication, updatedSharedSlots, newFlowState);
  } else if (targetFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION) {
    initialStep = getPrescriptionConfirmationInitialStep(hasNewMedication, updatedSharedSlots, newFlowState);
  } else if (targetFlowType === FlowTypeEnum.MEDICATION_INFO) {
    initialStep = getMedicationInfoInitialStep(updatedSharedSlots, newFlowState);
  }

  if (!hasNewMedication && state.sharedSlots.medicationData) {
    updatedSharedSlots.medicationData = state.sharedSlots.medicationData;
  }

  if (parsedIntent.requestedInfoType) {
    updatedSharedSlots.requestedInfoType = parsedIntent.requestedInfoType;
  } else if (newFlowState.slots.requestedInfoType) {
    updatedSharedSlots.requestedInfoType = newFlowState.slots.requestedInfoType;
  }

  const preservedPendingIntent = state.sharedSlots.pendingIntent;
  const preservedPendingInfoType = state.sharedSlots.pendingInfoType;
  
  const newState = {
    ...state,
    language: state.language,
    sharedSlots: {
      ...updatedSharedSlots,
      pendingIntent: preservedPendingIntent,
      pendingInfoType: preservedPendingInfoType,
    },
    flows: {
      ...state.flows,
      [state._activeFlowType!]: { ...state.flows[state._activeFlowType!], isActive: false },
      [targetFlowType]: { ...newFlowState, step: initialStep, isActive: true },
    },
    _activeFlowType: targetFlowType,
  };
  
  return newState;
}

