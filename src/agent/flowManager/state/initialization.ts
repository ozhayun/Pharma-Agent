import type { FlowState } from '../../flows';
import { FLOW_DEFINITIONS, FlowType as FlowTypeEnum } from '../../flows';

/**
 * Creates initial empty flow state
 * 
 * ## Defaults:
 * - Flow: MEDICATION_INFO (default flow)
 * - Step: COLLECT_MEDICATION_NAME (first step)
 * - Language: 'en'
 * - Empty slots, empty history
 * 
 * ## Used When:
 * - First message from user (no existing state)
 * - State is corrupted/invalid (fallback)
 */
export function initializeFlowState(): FlowState {
  const flowDef = FLOW_DEFINITIONS[FlowTypeEnum.MEDICATION_INFO];
  return {
    flows: {
      [FlowTypeEnum.MEDICATION_INFO]: {
        step: flowDef.steps[0],
        slots: {},
        isActive: true,
      },
    },
    sharedSlots: {},
    language: 'en',
    toolHistory: [],
    medicationHistory: [],
    flowHistory: [],
    stepHistory: [],
    _activeFlowType: FlowTypeEnum.MEDICATION_INFO,
  };
}

