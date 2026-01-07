import type { FlowState, ParsedUserIntent } from '../../flows';

/**
 * Validates if parsed intent is valid for current flow state
 * 
 * ## Validation:
 * - Rejects if `requestedInfoType` conflicts with existing one
 * - Example: User asked for "dosage" → then asks for "stock" in same turn → invalid
 * 
 * ## Returns:
 * - `isValid: false` → Intent rejected, state unchanged
 * - `isValid: true` → Intent accepted, processing continues
 */
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

