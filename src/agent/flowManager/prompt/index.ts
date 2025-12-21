import type { FlowState } from '../../flows';
import {
  FLOW_DEFINITIONS,
  FlowType as FlowTypeEnum,
  MedicationInfoStep,
  InventoryCheckStep,
  PrescriptionConfirmationStep,
} from '../../flows';
import { SYSTEM_PROMPT } from '../../systemPrompt';
import logger from '../../../utils/logger';
import {
  buildBasicContext,
  buildMedicationContext,
  buildRequestedInfoContext,
  buildPromptEnding,
} from './contextBuilders';
import {
  buildInventoryCheckContext,
  buildPrescriptionConfirmationContext,
  buildMedicationInfoContext,
} from './flowPrompts';

export function generateFlowAwarePrompt(flowState: FlowState, userMessage?: string): string {
  const promptStartTime = Date.now();
  const activeFlowType = flowState._activeFlowType!;
  const activeFlow = flowState.flows[activeFlowType]!;
  const flowDef = FLOW_DEFINITIONS[activeFlowType];
  const stepDescription = activeFlow.step ? flowDef.getStepDescription(activeFlow.step) : 'Completed';
  
  const contextLines: string[] = [];
  
  contextLines.push(...buildBasicContext(flowState, stepDescription, userMessage));
  
  contextLines.push(...buildMedicationContext(flowState));
  
  const requestedInfoType = activeFlow.slots.requestedInfoType || flowState.sharedSlots.requestedInfoType;
  contextLines.push(...buildRequestedInfoContext(flowState, requestedInfoType));
  
  if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK) {
    const extractedMedicationName = activeFlow.slots.medicationName;
    contextLines.push(
      ...buildInventoryCheckContext(flowState, activeFlow.step as InventoryCheckStep, extractedMedicationName)
    );
  } else if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION) {
    contextLines.push(
      ...buildPrescriptionConfirmationContext(flowState, activeFlow.step as PrescriptionConfirmationStep)
    );
  } else if (activeFlowType === FlowTypeEnum.MEDICATION_INFO) {
    const extractedMedicationName = activeFlow.slots.medicationName;
    contextLines.push(
      ...buildMedicationInfoContext(
        flowState,
        activeFlow.step as MedicationInfoStep,
        requestedInfoType,
        extractedMedicationName
      )
    );
  }
  
  contextLines.push(...buildPromptEnding());
  
  const contextParagraph = contextLines.join(' ');
  
  const promptTime = Date.now() - promptStartTime;
  if (promptTime > 1) {
    logger.debug(`[PROMPT] Prompt generation took ${promptTime}ms`);
  }

  return `${SYSTEM_PROMPT}\n\nAGENT CONTEXT (RUNTIME)\n\n${contextParagraph}`;
}

