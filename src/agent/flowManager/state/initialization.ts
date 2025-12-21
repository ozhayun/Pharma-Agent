import type { FlowState } from '../../flows';
import { FLOW_DEFINITIONS, FlowType as FlowTypeEnum } from '../../flows';

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

