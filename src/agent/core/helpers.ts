import type { FlowState } from '../flows';
import { FlowType as FlowTypeEnum, FLOW_DEFINITIONS, MedicationInfoStep, InventoryCheckStep, PrescriptionConfirmationStep } from '../flows';
import { getAvailableTools } from '../../tools';
import logger from '../../utils/logger';
import type { ParsedResponse } from './types';

export function parseAgentResponse(rawMessage: string): ParsedResponse {
  try {
    let cleaned = rawMessage.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    cleaned = cleaned.trim();
    
    const parsed = JSON.parse(cleaned);
    
    if (typeof parsed.response !== 'string') {
      logger.warn('[AGENT] Invalid JSON response: missing or invalid "response" field');
      return { response: rawMessage, options: null };
    }
    
    if (parsed.options !== null && parsed.options !== undefined) {
      if (!Array.isArray(parsed.options)) {
        logger.warn('[AGENT] Invalid JSON response: "options" must be an array or null');
        return { response: parsed.response, options: null };
      }
      const validOptions = parsed.options.filter((opt: any) => 
        typeof opt === 'string' && opt.trim().length > 0
      );
      return { response: parsed.response, options: validOptions.length >= 2 ? validOptions : null };
    }
    
    return { response: parsed.response, options: null };
  } catch (error) {
    logger.warn(`[AGENT] Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { response: rawMessage, options: null };
  }
}

export function validateToolCall(
  flowState: FlowState | undefined,
  toolName: string,
  _step?: string,
  toolCallHistory?: Array<{ name: string; iteration: number }>,
  toolCallArguments?: string
): boolean {
  if (!flowState) return true;
  
  const activeFlowType = flowState._activeFlowType;
  if (!activeFlowType) return true;
  
  const activeFlow = flowState.flows[activeFlowType];
  if (!activeFlow) return true;
  
  const flowDef = FLOW_DEFINITIONS[activeFlowType];
  const currentStep = activeFlow.step;
  
  let requestedMedicationName: string | undefined;
  if (toolCallArguments && toolName === 'getMedicationByName') {
    try {
      const args = JSON.parse(toolCallArguments);
      requestedMedicationName = args.name?.toLowerCase().trim();
    } catch {
    }
  }
  
  const flowMedicationName = activeFlow.slots.medicationName as string | undefined;
  const sharedMedicationName = flowState.sharedSlots.medicationName;
  const currentMedicationName = (flowMedicationName || sharedMedicationName)?.toLowerCase().trim();
  
  if (toolName === 'getMedicationByName') {
    if (!currentMedicationName && !flowState.sharedSlots.medicationId) {
      return true;
    }
    
    if (requestedMedicationName && currentMedicationName && requestedMedicationName !== currentMedicationName) {
      return true;
    }
    
    if (flowState.sharedSlots.medicationId && requestedMedicationName && currentMedicationName && requestedMedicationName === currentMedicationName) {
      logger.warn(`[VALIDATION] Rejecting getMedicationByName - medicationId already exists for "${currentMedicationName}"`);
      return false;
    }
    
    if (toolCallHistory && toolCallHistory.some(t => t.name === 'getMedicationByName')) {
      if (requestedMedicationName && currentMedicationName && requestedMedicationName === currentMedicationName) {
        logger.warn(`[VALIDATION] Rejecting getMedicationByName - already called for "${currentMedicationName}"`);
        return false;
      }
      if (!currentMedicationName || (requestedMedicationName && requestedMedicationName !== currentMedicationName)) {
        return true;
      }
    }
    
    const stepString = currentStep?.toString() || '';
    const isCollectStep = stepString.includes('collect_medication_name');
    if (!isCollectStep && currentMedicationName && flowState.sharedSlots.medicationId) {
      logger.warn(`[VALIDATION] Rejecting getMedicationByName - not in COLLECT_MEDICATION_NAME step and medication already set`);
      return false;
    }
  }
  
  const stepString = currentStep?.toString() || '';
  const isProvideResultOrComplete = stepString === 'provide_result' || stepString === 'complete';
  if (isProvideResultOrComplete) {
    if (toolName === 'getMedicationByName' && (!currentMedicationName || (requestedMedicationName && requestedMedicationName !== currentMedicationName))) {
      return true;
    }
    logger.warn(`[VALIDATION] Rejecting ${toolName} in ${currentStep} step`);
    return false;
  }
  
  if (flowDef.getToolForStep && currentStep) {
    const expectedTool = flowDef.getToolForStep(currentStep);
    if (expectedTool !== null) {
      if (toolName !== expectedTool && toolName !== 'getMedicationByName') {
        logger.warn(`[VALIDATION] Tool mismatch: step ${currentStep} expects ${expectedTool} but got ${toolName}`);
        return false;
      }
    }
  }
  if (activeFlowType === FlowTypeEnum.MEDICATION_INFO) {
    const requestedInfoType = activeFlow.slots.requestedInfoType || flowState.sharedSlots.requestedInfoType;
    if (requestedInfoType === 'stock' && toolName !== 'checkInventory' && toolName !== 'getMedicationByName') {
      logger.warn(`[VALIDATION] Tool mismatch: requested stock but tool is ${toolName}`);
      return false;
    }
    if (requestedInfoType === 'prescription' && toolName !== 'requiresPrescription' && toolName !== 'getMedicationByName') {
      logger.warn(`[VALIDATION] Tool mismatch: requested prescription but tool is ${toolName}`);
      return false;
    }
  }
  
  return true;
}

export function getOpenAIFunctionsForResponses(flowState?: FlowState): Array<{ type: 'function'; name: string; description: string | null; parameters: Record<string, unknown> | null; strict: boolean | null }> {
  const tools = getAvailableTools();
  let filteredTools = tools;
  if (flowState) {
    const activeFlowType = flowState._activeFlowType;
    const activeFlow = activeFlowType ? flowState.flows[activeFlowType] : null;
    
    if (activeFlowType === FlowTypeEnum.MEDICATION_INFO &&
        activeFlow?.step === MedicationInfoStep.PROVIDE_INFO &&
        flowState.sharedSlots.medicationId) {
      filteredTools = tools.filter(t => t.name !== 'getMedicationByName');
    }
    
    if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK &&
        activeFlow?.step === InventoryCheckStep.PROVIDE_RESULT) {
      filteredTools = [];
    } else if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION &&
               activeFlow?.step === PrescriptionConfirmationStep.PROVIDE_RESULT) {
      filteredTools = [];
    }
    
    if (flowState.sharedSlots.medicationId) {
      filteredTools = filteredTools.filter(t => t.name !== 'getMedicationByName');
    }
  }
  
  return filteredTools.map((tool) => {
    let parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };

    switch (tool.name) {
      case 'getMedicationByName':
        parameters = {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name of the medication to look up (supports both English and Hebrew names)',
            },
          },
          required: ['name'],
        };
        break;

      case 'checkInventory':
        parameters = {
          type: 'object',
          properties: {
            medicationId: {
              type: 'string',
              description: 'The ID of the medication to check inventory for (e.g., "med-001")',
            },
          },
          required: ['medicationId'],
        };
        break;

      case 'requiresPrescription':
        parameters = {
          type: 'object',
          properties: {
            medicationId: {
              type: 'string',
              description: 'The ID of the medication to check prescription requirement for (e.g., "med-001")',
            },
          },
          required: ['medicationId'],
        };
        break;

      default:
        parameters = {
          type: 'object',
          properties: {},
          required: [],
        };
    }

    return {
      type: 'function' as const,
        name: tool.name,
      description: tool.description || null,
      parameters: parameters as Record<string, unknown> | null,
      strict: false as boolean | null,
    };
  });
}

