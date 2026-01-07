import type { FlowState } from '../flows';
import { getAvailableTools, executeTool } from '../../tools';
import { updateFlowStateAfterTool, addToolToHistory } from '../flowManager';
import { validateToolCall } from './helpers';
import logger from '../../utils/logger';

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Validates and executes a tool call
 * 
 * ## Validation:
 * - Tool name matches expected tool for current step
 * - Medication name matches context (if applicable)
 * - Tool not already called (duplicate check)
 * - Max tool calls not exceeded (max 3 per request)
 * 
 * ## Updates State:
 * - Calls `updateFlowStateAfterTool()` - stores tool results in state
 * - Calls `addToolToHistory()` - tracks tool usage for debugging
 * 
 * ## Returns:
 * - `success`: Tool execution result
 * - `updatedFlowState`: State with tool results stored
 */
export async function executeToolCall(
  toolCall: ToolCall,
  flowState: FlowState | undefined,
  toolCallHistory: Array<{ name: string; iteration: number }>,
  iteration: number,
  maxToolCallsPerRequest: number,
  toolCallCount: number
): Promise<{
  success: boolean;
  toolResult?: any;
  error?: string;
  updatedFlowState?: FlowState;
  shouldContinue: boolean;
  newToolCallCount: number;
}> {
  const activeFlowTypeForValidation = flowState?._activeFlowType;
  const activeFlowForValidation = activeFlowTypeForValidation ? flowState.flows[activeFlowTypeForValidation] : null;
  if (!validateToolCall(flowState, toolCall.function.name, activeFlowForValidation?.step?.toString(), toolCallHistory, toolCall.function.arguments)) {
    logger.warn(`[AGENT] Rejecting invalid tool call: ${toolCall.function.name}`);
    return {
      success: false,
      error: `Tool ${toolCall.function.name} is not allowed in current state`,
      shouldContinue: true,
      newToolCallCount: toolCallCount,
    };
  }
  
  const newToolCallCount = toolCallCount + 1;
  if (newToolCallCount > maxToolCallsPerRequest) {
    logger.warn(`[AGENT] Max tool calls (${maxToolCallsPerRequest}) reached, rejecting: ${toolCall.function.name}`);
    return {
      success: false,
      error: 'Maximum tool calls per request exceeded',
      shouldContinue: true,
      newToolCallCount: toolCallCount,
    };
  }
  
  const duplicateCount = toolCallHistory.filter(t => t.name === toolCall.function.name).length;
  if (duplicateCount > 0) {
    logger.warn(`[AGENT] Duplicate tool call detected: ${toolCall.function.name} (already called ${duplicateCount} times)`);
    return {
      success: false,
      error: `Tool ${toolCall.function.name} was already called. Use the previous result.`,
      shouldContinue: true,
      newToolCallCount: toolCallCount,
    };
  }
  
  toolCallHistory.push({ name: toolCall.function.name, iteration });
  
  try {
    const toolExecStartTime = Date.now();
    const args = JSON.parse(toolCall.function.arguments);
    const toolResult = await executeTool(toolCall.function.name, args);
    const toolExecTime = Date.now() - toolExecStartTime;
    logger.debug(`[AGENT] Tool execution completed in ${toolExecTime}ms: ${toolCall.function.name}`);

    let updatedFlowState = flowState;
    if (updatedFlowState) {
      updatedFlowState = updateFlowStateAfterTool(updatedFlowState, toolCall.function.name, toolResult);
      
      const availableTools = getAvailableTools();
      const tool = availableTools.find((t) => t.name === toolCall.function.name);
      if (tool) {
        let medicationName: string | undefined;
        if (toolCall.function.name === 'getMedicationByName') {
          medicationName = args.name;
          if (!medicationName) {
            const activeFlowType = updatedFlowState._activeFlowType;
            const activeFlow = activeFlowType ? updatedFlowState.flows[activeFlowType] : null;
            medicationName = activeFlow?.slots.medicationName as string | undefined || updatedFlowState.sharedSlots.medicationName;
          }
        } else if (toolCall.function.name === 'checkInventory' || toolCall.function.name === 'requiresPrescription') {
          const activeFlowType = updatedFlowState._activeFlowType;
          const activeFlow = activeFlowType ? updatedFlowState.flows[activeFlowType] : null;
          medicationName = activeFlow?.slots.medicationName as string | undefined || updatedFlowState.sharedSlots.medicationName;
        } else {
          medicationName = updatedFlowState.sharedSlots.medicationName;
        }
        updatedFlowState = addToolToHistory(updatedFlowState, toolCall.function.name, tool.description, medicationName);
      }
    }

    return {
      success: true,
      toolResult,
      updatedFlowState,
      shouldContinue: false,
      newToolCallCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      shouldContinue: true,
      newToolCallCount: toolCallCount,
    };
  }
}
