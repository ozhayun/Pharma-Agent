import type { FlowState, ParsedUserIntent } from '../../flows';

export function updateSlotsFromIntent(
  currentSlots: Partial<Record<string, unknown>>,
  state: FlowState,
  parsedIntent: ParsedUserIntent
): Partial<Record<string, unknown>> {
  const updatedSlots = { ...currentSlots };

  if (parsedIntent.requestedInfoType) {
    updatedSlots.requestedInfoType = parsedIntent.requestedInfoType;
  } else if (state.sharedSlots.requestedInfoType && !updatedSlots.requestedInfoType) {
    updatedSlots.requestedInfoType = state.sharedSlots.requestedInfoType;
  }

  if (parsedIntent.extractedMedicationName && parsedIntent.containsMedicationName) {
    const currentMedicationName = state.sharedSlots.medicationName;
    if (!currentMedicationName ||
        parsedIntent.extractedMedicationName.toLowerCase() !== currentMedicationName.toLowerCase()) {
      updatedSlots.medicationName = parsedIntent.extractedMedicationName;
    }
  }

  return updatedSlots;
}

export function extractInfoTypeFromConfirmation(
  activeFlow: { slots: Partial<Record<string, unknown>> },
  parsedIntent: ParsedUserIntent,
  state: FlowState
): string | undefined {
  if (parsedIntent.requestedInfoType) {
    return parsedIntent.requestedInfoType;
  }
  
  if (state.sharedSlots.requestedInfoType) {
    return state.sharedSlots.requestedInfoType;
  }
  
  if (activeFlow.slots.requestedInfoType) {
    return activeFlow.slots.requestedInfoType as string;
  }

  if (parsedIntent.intent === 'confirm_yes' && state.sharedSlots.lastPresentedText) {
    const lastText = state.sharedSlots.lastPresentedText.content.toLowerCase();
    if (lastText.includes('prescription')) {
      return 'prescription';
    } else if (lastText.includes('stock') || lastText.includes('availability')) {
      return 'stock';
    } else if (lastText.includes('dosage') || lastText.includes('dose')) {
      return 'dosage';
    } else if (lastText.includes('ingredient') || lastText.includes('active')) {
      return 'active_ingredients';
    }
  }

  return undefined;
}

