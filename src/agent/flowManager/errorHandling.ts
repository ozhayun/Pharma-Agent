import type { FlowState } from '../flows';

/**
 * Handles tool execution errors by:
 * 1. Cleaning up medication-related state (medicationName, medicationId, lastToolResult)
 * 2. Preparing a message for the AI to evaluate the error
 * 
 * @param flowState - The current flow state containing the error in lastToolResult
 * @returns An object with the cleaned flowState and an error message for the AI
 */
export function handleToolError(flowState: FlowState): {
  cleanedFlowState: FlowState;
  errorMessage: string;
} {
  // Extract error from lastToolResult
  const lastToolResult = flowState.sharedSlots.lastToolResult;
  const error = 
    lastToolResult && 
    typeof lastToolResult === 'object' && 
    'error' in lastToolResult
      ? (lastToolResult as { error: string }).error
      : 'Unknown error occurred';

  // Clean up the flow state by removing medication-related data and lastToolResult
  const activeFlowType = flowState._activeFlowType;
  const activeFlow = activeFlowType ? flowState.flows[activeFlowType] : undefined;
  
  const cleanedFlowState: FlowState = {
    ...flowState,
    sharedSlots: {
      ...flowState.sharedSlots,
      medicationName: undefined,
      medicationId: undefined,
      medicationData: undefined,
      lastToolResult: undefined,
    },
    flows: activeFlowType && activeFlow
      ? {
          ...flowState.flows,
          [activeFlowType]: {
            ...activeFlow,
            slots: {
              ...activeFlow.slots,
              medicationName: undefined,
              medicationId: undefined,
            },
          },
        }
      : flowState.flows,
  };

  // Create a message for the AI to evaluate the error
  const errorMessage = `A tool execution error occurred: ${error}. Please evaluate this error and respond appropriately to the user.`;

  return {
    cleanedFlowState,
    errorMessage,
  };
}

