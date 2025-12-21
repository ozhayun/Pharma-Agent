import type { FlowState } from '../../flows';
import {
  FlowType as FlowTypeEnum,
  MedicationInfoStep,
  InventoryCheckStep,
  PrescriptionConfirmationStep,
} from '../../flows';

function updateSlotsAfterGetMedication(
  sharedSlots: FlowState['sharedSlots'],
  toolResult: unknown
): void {
  const result = toolResult as {
    success: boolean;
    medication?: {
      id: string;
      name: string;
      activeIngredients: string[];
      dosageInstructions: string;
      hebrew?: {
        name?: string;
        activeIngredients?: string[];
        dosageInstructions?: string;
      };
    };
  };

  if (result.success && result.medication && result.medication.activeIngredients && result.medication.dosageInstructions) {
    sharedSlots.medicationId = result.medication.id;
    sharedSlots.medicationName = result.medication.name;
    sharedSlots.medicationData = {
      id: result.medication.id,
      name: result.medication.name,
      activeIngredients: result.medication.activeIngredients,
      dosageInstructions: result.medication.dosageInstructions,
      hebrew: result.medication.hebrew,
    };
  }
}

function updateSlotsAfterRequiresPrescription(
  sharedSlots: FlowState['sharedSlots'],
  currentState: FlowState,
  toolResult: unknown
): void {
  const result = toolResult as { success: boolean; id?: string; prescriptionRequired?: boolean };
  if (result.success && result.id) {
    const medicationIdChanged = !sharedSlots.medicationId || sharedSlots.medicationId !== result.id;
    if (medicationIdChanged) {
      sharedSlots.medicationId = result.id;
      const activeFlowType = currentState._activeFlowType;
      const activeFlow = activeFlowType ? currentState.flows[activeFlowType] : null;
      if (activeFlow?.slots.medicationName) {
        sharedSlots.medicationName = activeFlow.slots.medicationName as string;
      }
    }
  }
}

function getNextStepAfterToolInventoryCheck(
  activeFlowType: FlowTypeEnum,
  currentStep: InventoryCheckStep,
  sharedSlots: FlowState['sharedSlots']
): InventoryCheckStep | null {
  if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK && currentStep === InventoryCheckStep.CHECK_INVENTORY) {
    return InventoryCheckStep.PROVIDE_RESULT;
  } else if (sharedSlots.medicationName && currentStep === InventoryCheckStep.COLLECT_MEDICATION_NAME) {
    return InventoryCheckStep.CHECK_INVENTORY;
  }
  return null;
}

function getNextStepAfterToolPrescriptionConfirmation(
  activeFlowType: FlowTypeEnum,
  currentStep: PrescriptionConfirmationStep,
  sharedSlots: FlowState['sharedSlots'],
  currentState: FlowState
): PrescriptionConfirmationStep | null {
  if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION && currentStep === PrescriptionConfirmationStep.CHECK_PRESCRIPTION) {
    const activeFlowForMedication = currentState.flows[activeFlowType];
    if (activeFlowForMedication?.slots.medicationName && !sharedSlots.medicationName) {
      sharedSlots.medicationName = activeFlowForMedication.slots.medicationName;
    }
    return PrescriptionConfirmationStep.PROVIDE_RESULT;
  } else if (sharedSlots.medicationName && currentStep === PrescriptionConfirmationStep.COLLECT_MEDICATION_NAME) {
    return PrescriptionConfirmationStep.CHECK_PRESCRIPTION;
  }
  return null;
}

function getNextStepAfterToolMedicationInfo(
  activeFlowType: FlowTypeEnum,
  currentStep: MedicationInfoStep,
  sharedSlots: FlowState['sharedSlots'],
  currentState: FlowState
): MedicationInfoStep | null {
  if (sharedSlots.medicationName && activeFlowType === FlowTypeEnum.MEDICATION_INFO) {
    if (currentStep === MedicationInfoStep.COLLECT_MEDICATION_NAME ||
        currentStep === MedicationInfoStep.ASK_INFO_TYPE) {
      const activeFlow = currentState.flows[activeFlowType];
      const hasRequestedInfoType = activeFlow?.slots.requestedInfoType || currentState.sharedSlots.requestedInfoType;
      if (hasRequestedInfoType) {
        return MedicationInfoStep.PROVIDE_INFO;
      } else if (currentStep !== MedicationInfoStep.ASK_INFO_TYPE) {
        return MedicationInfoStep.ASK_INFO_TYPE;
      }
    }
  }
  return null;
}

export function updateFlowStateAfterTool(
  currentState: FlowState,
  toolName: string,
  toolResult: unknown
): FlowState {
  const sharedSlots = {
    ...currentState.sharedSlots,
    lastToolResult: toolResult,
    requestedInfoType: currentState.sharedSlots.requestedInfoType,
  };

  if (toolName === 'getMedicationByName') {
    updateSlotsAfterGetMedication(sharedSlots, toolResult);
  } else if (toolName === 'requiresPrescription') {
    updateSlotsAfterRequiresPrescription(sharedSlots, currentState, toolResult);
  }

  const activeFlowType = currentState._activeFlowType!;
  const activeFlow = currentState.flows[activeFlowType]!;
  let nextStep = activeFlow.step;

  if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK) {
    const next = getNextStepAfterToolInventoryCheck(
      activeFlowType,
      activeFlow.step as InventoryCheckStep,
      sharedSlots
    );
    if (next !== null) nextStep = next;
  } else if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION) {
    const next = getNextStepAfterToolPrescriptionConfirmation(
      activeFlowType,
      activeFlow.step as PrescriptionConfirmationStep,
      sharedSlots,
      currentState
    );
    if (next !== null) nextStep = next;
  } else if (activeFlowType === FlowTypeEnum.MEDICATION_INFO) {
    const next = getNextStepAfterToolMedicationInfo(
      activeFlowType,
      activeFlow.step as MedicationInfoStep,
      sharedSlots,
      currentState
    );
    if (next !== null) nextStep = next;
  }

  const updatedFlowSlots = { ...activeFlow.slots };
  if (sharedSlots.requestedInfoType && !updatedFlowSlots.requestedInfoType) {
    updatedFlowSlots.requestedInfoType = sharedSlots.requestedInfoType;
  }

  return {
    ...currentState,
    sharedSlots,
    flows: {
      ...currentState.flows,
      [activeFlowType]: {
        ...activeFlow,
        step: nextStep,
        slots: updatedFlowSlots,
      },
    },
  };
}

