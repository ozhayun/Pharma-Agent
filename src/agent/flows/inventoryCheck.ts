import { STEP_PROMPTS } from './promptByStep';
import type { FlowDefinition } from './types';
import { FlowType, InventoryCheckStep, type FlowStep } from './types';

export const inventoryCheckFlow: FlowDefinition = {
  type: FlowType.INVENTORY_CHECK,
  steps: [
    InventoryCheckStep.COLLECT_MEDICATION_NAME,
    InventoryCheckStep.CHECK_INVENTORY,
    InventoryCheckStep.PROVIDE_RESULT,
    InventoryCheckStep.COMPLETE,
  ],
  requiredSlots: ['medicationName', 'medicationId'],
  getToolForStep: (step) => {
    if (step === InventoryCheckStep.CHECK_INVENTORY) return 'checkInventory';
    return null;
  },
  getStepDescription: (step: FlowStep) => {
    switch (step) {
      case InventoryCheckStep.COLLECT_MEDICATION_NAME:
        return STEP_PROMPTS.INVENTORY_CHECK.COLLECT_MEDICATION_NAME;
      case InventoryCheckStep.CHECK_INVENTORY:
        return STEP_PROMPTS.INVENTORY_CHECK.CHECK_INVENTORY;
      case InventoryCheckStep.PROVIDE_RESULT:
        return STEP_PROMPTS.INVENTORY_CHECK.PROVIDE_RESULT;
      case InventoryCheckStep.COMPLETE:
        return STEP_PROMPTS.INVENTORY_CHECK.COMPLETE;
      default:
        return STEP_PROMPTS.COMMON.UNKNOWN_STEP;
    }
  },
  transitions: (currentStep, state, _parsedIntent) => {
    if (currentStep === InventoryCheckStep.COLLECT_MEDICATION_NAME) {
      if (state.sharedSlots.medicationName) {
        return InventoryCheckStep.CHECK_INVENTORY;
      }
      return currentStep;
    }
    if (currentStep === InventoryCheckStep.CHECK_INVENTORY) {
      return currentStep;
    }
    return null;
  },
};

