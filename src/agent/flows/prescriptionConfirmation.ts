import { STEP_PROMPTS } from './promptByStep';
import type { FlowDefinition } from './types';
import { FlowType, PrescriptionConfirmationStep, type FlowStep } from './types';

export const prescriptionConfirmationFlow: FlowDefinition = {
  type: FlowType.PRESCRIPTION_CONFIRMATION,
  steps: [
    PrescriptionConfirmationStep.COLLECT_MEDICATION_NAME,
    PrescriptionConfirmationStep.CHECK_PRESCRIPTION,
    PrescriptionConfirmationStep.PROVIDE_RESULT,
    PrescriptionConfirmationStep.COMPLETE,
  ],
  requiredSlots: ['medicationName', 'medicationId'],
  getToolForStep: (step) => {
    if (step === PrescriptionConfirmationStep.CHECK_PRESCRIPTION) return 'requiresPrescription';
    return null;
  },
  getStepDescription: (step: FlowStep) => {
    switch (step) {
      case PrescriptionConfirmationStep.COLLECT_MEDICATION_NAME:
        return STEP_PROMPTS.PRESCRIPTION_CONFIRMATION.COLLECT_MEDICATION_NAME;
      case PrescriptionConfirmationStep.CHECK_PRESCRIPTION:
        return STEP_PROMPTS.PRESCRIPTION_CONFIRMATION.CHECK_PRESCRIPTION;
      case PrescriptionConfirmationStep.PROVIDE_RESULT:
        return STEP_PROMPTS.PRESCRIPTION_CONFIRMATION.PROVIDE_RESULT;
      case PrescriptionConfirmationStep.COMPLETE:
        return STEP_PROMPTS.PRESCRIPTION_CONFIRMATION.COMPLETE;
      default:
        return STEP_PROMPTS.COMMON.UNKNOWN_STEP;
    }
  },
  transitions: (currentStep, state, _parsedIntent) => {
    if (currentStep === PrescriptionConfirmationStep.COLLECT_MEDICATION_NAME) {
      if (state.sharedSlots.medicationName) {
        return PrescriptionConfirmationStep.CHECK_PRESCRIPTION;
      }
      return currentStep;
    }
    if (currentStep === PrescriptionConfirmationStep.CHECK_PRESCRIPTION) {
      return currentStep;
    }
    return null;
  },
};

