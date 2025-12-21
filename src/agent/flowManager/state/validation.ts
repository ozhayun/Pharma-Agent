import type { FlowState, ParsedUserIntent } from '../../flows';

export function validateSingleIntent(
  activeFlow: { slots: { requestedInfoType?: string } },
  state: FlowState,
  parsedIntent: ParsedUserIntent
): { isValid: boolean } {
  if (parsedIntent.requestedInfoType) {
    const existingInfoType = activeFlow.slots.requestedInfoType || state.sharedSlots.requestedInfoType;
    if (existingInfoType && existingInfoType !== parsedIntent.requestedInfoType) {
      return { isValid: false };
    }
  }

  return { isValid: true };
}

