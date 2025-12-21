export * from './types';

export { medicationInfoFlow } from './medicationInfo';
export { inventoryCheckFlow } from './inventoryCheck';
export { prescriptionConfirmationFlow } from './prescriptionConfirmation';

import { FlowType } from './types';
import { medicationInfoFlow } from './medicationInfo';
import { inventoryCheckFlow } from './inventoryCheck';
import { prescriptionConfirmationFlow } from './prescriptionConfirmation';
import type { FlowDefinition } from './types';

export const FLOW_DEFINITIONS: Record<FlowType, FlowDefinition> = {
  [FlowType.MEDICATION_INFO]: medicationInfoFlow,
  [FlowType.INVENTORY_CHECK]: inventoryCheckFlow,
  [FlowType.PRESCRIPTION_CONFIRMATION]: prescriptionConfirmationFlow,
};

