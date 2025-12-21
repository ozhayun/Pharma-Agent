import type { FlowState } from '../../flows';

export function buildBasicContext(
  flowState: FlowState,
  stepDescription: string,
  userMessage?: string
): string[] {
  const contextLines: string[] = [];
  
  contextLines.push(`Current step: ${stepDescription}`);
  contextLines.push(`User language: ${flowState.language === 'he' ? 'Hebrew' : 'English'}`);
  
  if (userMessage) {
    contextLines.push(`User said: "${userMessage}"`);
  }
  
  return contextLines;
}

export function buildMedicationContext(flowState: FlowState): string[] {
  const contextLines: string[] = [];
  
  if (flowState.sharedSlots.medicationName) {
    const medInfo = flowState.sharedSlots.medicationId 
      ? `${flowState.sharedSlots.medicationName} (${flowState.sharedSlots.medicationId})`
      : flowState.sharedSlots.medicationName;
    contextLines.push(`Medication: ${medInfo}`);
    if (flowState.language === 'he') {
      contextLines.push(`Note: Use Hebrew name from tool results when available.`);
    }
  } else if (flowState.sharedSlots.medicationId) {
    contextLines.push(`Medication ID: ${flowState.sharedSlots.medicationId}`);
  }
  
  return contextLines;
}

export function buildRequestedInfoContext(
  flowState: FlowState,
  requestedInfoType?: string
): string[] {
  const contextLines: string[] = [];
  
  if (!requestedInfoType) return contextLines;
  
  contextLines.push(`Requested information: ${requestedInfoType}`);
  
  if ((requestedInfoType === 'active_ingredients' || requestedInfoType === 'dosage') &&
      flowState.sharedSlots.lastToolResult) {
    const lastResult = flowState.sharedSlots.lastToolResult;
    if (lastResult &&
        typeof lastResult === 'object' &&
        lastResult !== null &&
        'success' in lastResult &&
        (lastResult as { success: boolean }).success === true &&
        'medication' in lastResult) {
      const medication = (lastResult as { medication: unknown }).medication;
      contextLines.push(`Medication data: ${JSON.stringify(medication)}`);
    }
  }
  
  return contextLines;
}

export function extractMedicationData(flowState: FlowState): unknown | null {
  if (flowState.sharedSlots.medicationData) {
    return flowState.sharedSlots.medicationData;
  }
  
  if (flowState.sharedSlots.lastToolResult) {
    const lastResult = flowState.sharedSlots.lastToolResult;
    if (lastResult &&
        typeof lastResult === 'object' &&
        lastResult !== null &&
        'success' in lastResult &&
        (lastResult as { success: boolean }).success === true &&
        'medication' in lastResult) {
      return (lastResult as { medication: unknown }).medication;
    }
  }
  
  return null;
}

export function buildPromptEnding(): string[] {
  return [
    `End your response with a follow-up question in the user's language.`,
    `You are a fast-response assistant.
Do not explain your reasoning.
Do not describe steps, plans, or validation.
Produce only the final user-facing text.
`
  ];
}

