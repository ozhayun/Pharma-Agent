import { STEP_PROMPTS } from './promptByStep';
import type { FlowDefinition } from './types';
import { FlowType, MedicationInfoStep, type FlowStep } from './types';

export const medicationInfoFlow: FlowDefinition = {
  type: FlowType.MEDICATION_INFO,
  steps: [
    MedicationInfoStep.COLLECT_MEDICATION_NAME,
    MedicationInfoStep.ASK_INFO_TYPE,
    MedicationInfoStep.PROVIDE_INFO,
    MedicationInfoStep.COMPLETE,
  ],
  requiredSlots: ['medicationName'],
  getToolForStep: (_step) => {
    return null;
  },
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
    if (step === MedicationInfoStep.COLLECT_MEDICATION_NAME) {
      return parsedIntent.intent === 'unknown' || 
             parsedIntent.intent === 'request_medication_info' ||
             parsedIntent.intent === 'check_stock' ||
             parsedIntent.intent === 'check_prescription';
    }
    if (step === MedicationInfoStep.PROVIDE_INFO) {
      return true;
    }
    return true;
  },
  getStepDescription: (step: FlowStep) => {
    switch (step) {
      case MedicationInfoStep.COLLECT_MEDICATION_NAME:
        return STEP_PROMPTS.MEDICATION_INFO.COLLECT_MEDICATION_NAME;
      case MedicationInfoStep.ASK_INFO_TYPE:
        return STEP_PROMPTS.MEDICATION_INFO.ASK_INFO_TYPE;
      case MedicationInfoStep.PROVIDE_INFO:
        return STEP_PROMPTS.MEDICATION_INFO.PROVIDE_INFO;
      case MedicationInfoStep.COMPLETE:
        return STEP_PROMPTS.MEDICATION_INFO.COMPLETE;
      default:
        return STEP_PROMPTS.COMMON.UNKNOWN_STEP;
    }
  },
  transitions: (currentStep, state, parsedIntent) => {
    if (currentStep === MedicationInfoStep.COLLECT_MEDICATION_NAME) {
      if (state.sharedSlots.medicationName) {
        const currentFlow = state.flows[FlowType.MEDICATION_INFO];
        const hasRequestedInfoType = currentFlow?.slots.requestedInfoType || state.sharedSlots.requestedInfoType;
        if (hasRequestedInfoType) {
          return MedicationInfoStep.PROVIDE_INFO;
        }
        return MedicationInfoStep.ASK_INFO_TYPE;
      }
      // If we don't have it, we stay here. The Agent will call tool or ask.
      return currentStep;
    }
    if (currentStep === MedicationInfoStep.ASK_INFO_TYPE) {
      // If we already have requestedInfoType from previous selection, skip asking again
      const currentFlow = state.flows[FlowType.MEDICATION_INFO];
      const hasRequestedInfoType = currentFlow?.slots.requestedInfoType || state.sharedSlots.requestedInfoType;
      if (hasRequestedInfoType) {
        return MedicationInfoStep.PROVIDE_INFO;
      }
      // Otherwise, if user provides info type in this message, go to provide
      if (parsedIntent.intent === 'request_medication_info' || parsedIntent.requestedInfoType) {
        return MedicationInfoStep.PROVIDE_INFO;
      }
      return currentStep;
    }
    if (currentStep === MedicationInfoStep.PROVIDE_INFO) {
      return MedicationInfoStep.COMPLETE;
    }
    if (currentStep === MedicationInfoStep.COMPLETE) {
      if (parsedIntent.containsMedicationName && parsedIntent.extractedMedicationName) {
        return MedicationInfoStep.COLLECT_MEDICATION_NAME;
      }
      if ((parsedIntent.intent === 'check_stock' || 
          parsedIntent.intent === 'check_prescription' || 
          parsedIntent.intent === 'request_medication_info') &&
          !state.sharedSlots.medicationName) {
        return MedicationInfoStep.COLLECT_MEDICATION_NAME;
      }
      if (parsedIntent.intent === 'unknown' && (parsedIntent.isGreetingOrSmallTalk || !parsedIntent.containsMedicationName)) {
        return currentStep;
      }
      return currentStep;
    }
    return null;
  },
};

