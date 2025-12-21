import type { FlowState, LastPresentedText, ToolHistoryEntry, MedicationHistoryEntry, FlowHistoryEntry, StepHistoryEntry } from '../flows';

export function updateLastPresentedText(
  flowState: FlowState,
  assistantMessage: string,
  infoType: LastPresentedText['type'] = 'general'
): FlowState {
  return {
    ...flowState,
    sharedSlots: {
      ...flowState.sharedSlots,
      lastPresentedText: {
        content: assistantMessage,
        language: flowState.language,
        type: infoType,
      },
    },
  };
}

export function addToolToHistory(
  flowState: FlowState,
  toolName: string,
  toolDescription: string,
  medicationName?: string
): FlowState {
  const toolHistory = flowState.toolHistory || [];
  const newEntry: ToolHistoryEntry = {
    name: toolName,
    description: toolDescription,
    timestamp: Date.now(),
    medicationName: medicationName || flowState.sharedSlots.medicationName,
  };
  const updatedHistory = [newEntry, ...toolHistory];
  
  const medicationHistory: MedicationHistoryEntry[] = flowState.medicationHistory || [];
  const flowHistory: FlowHistoryEntry[] = flowState.flowHistory || [];
  const stepHistory: StepHistoryEntry[] = flowState.stepHistory || [];
  
  const normalizedMedicationName = medicationName || flowState.sharedSlots.medicationName;
  if (normalizedMedicationName) {
    const normalizedNameLower = normalizedMedicationName.toLowerCase().trim();
    const existingMedication = medicationHistory.find(m => m.name.toLowerCase().trim() === normalizedNameLower);
    if (!existingMedication) {
      medicationHistory.unshift({ name: normalizedMedicationName, timestamp: Date.now() });
    }
  }
  
  const activeFlowType = flowState._activeFlowType;
  if (activeFlowType) {
    const lastFlow = flowHistory[0];
    if (!lastFlow || lastFlow.flowType !== activeFlowType || lastFlow.medicationName !== normalizedMedicationName) {
      flowHistory.unshift({ 
        flowType: activeFlowType, 
        timestamp: Date.now(),
        medicationName: normalizedMedicationName
      });
    }
  }
  
  if (activeFlowType && flowState.flows[activeFlowType]) {
    const currentStep = flowState.flows[activeFlowType]?.step;
    if (currentStep) {
      const lastStep = stepHistory[0];
      if (!lastStep || lastStep.step !== currentStep || lastStep.medicationName !== normalizedMedicationName) {
        stepHistory.unshift({ 
          step: currentStep, 
          timestamp: Date.now(),
          medicationName: normalizedMedicationName
        });
      }
    }
  }
  
  return {
    ...flowState,
    toolHistory: updatedHistory,
    medicationHistory: medicationHistory.slice(0, 20),
    flowHistory: flowHistory.slice(0, 20),
    stepHistory: stepHistory.slice(0, 20),
  };
}

