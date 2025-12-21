import type { FlowState } from '../flows';
import { FlowType as FlowTypeEnum, FLOW_DEFINITIONS, MedicationInfoStep, InventoryCheckStep, PrescriptionConfirmationStep } from '../flows';

export function determineToolChoice(flowState: FlowState | undefined): {
  toolChoice: 'auto' | 'required' | { type: 'function'; name: string } | null;
  allowTools: boolean;
  expectingToolCall: boolean;
} {
  let toolChoice: 'auto' | 'required' | { type: 'function'; name: string } | null = 'auto';
  let allowTools = true;
  let expectingToolCall = false;

  if (flowState) {
    const activeFlowType = flowState._activeFlowType!;
    const activeFlow = flowState.flows[activeFlowType]!;
    const flowDef = FLOW_DEFINITIONS[activeFlowType];

    if (activeFlow.step) {
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
      else {
      const forcedTool = flowDef.getToolForStep?.(activeFlow.step);
      if (forcedTool) {
        toolChoice = { type: 'function', name: forcedTool };
          expectingToolCall = true;
      }
    }
  }
  
  if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK && 
      activeFlow.step === InventoryCheckStep.PROVIDE_RESULT) {
    allowTools = false;
  } else if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION && 
             activeFlow.step === PrescriptionConfirmationStep.PROVIDE_RESULT) {
    allowTools = false;
  }
  }

  return { toolChoice, allowTools, expectingToolCall };
}
