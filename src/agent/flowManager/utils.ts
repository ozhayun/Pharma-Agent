import type { FlowState, FlowType, SingleFlowState } from '../flows';
import { FLOW_DEFINITIONS, FlowType as FlowTypeEnum } from '../flows';

export function getOrCreateFlowState(flowState: FlowState, flowType: FlowType): SingleFlowState {
  const existing = flowState.flows[flowType];
  if (existing) return existing;

  const flowDef = FLOW_DEFINITIONS[flowType];
  return {
    step: flowDef.steps[0] || null,
    slots: {},
    isActive: true,
  };
}

export function detectLanguage(userMessage: string): 'en' | 'he' {
  const hasHebrew = /[\u0590-\u05FF]/.test(userMessage);
  return hasHebrew ? 'he' : 'en';
}

export function mapIntentToFlowType(intent: 'check_stock' | 'request_medication_info' | 'check_prescription' | 'confirm_yes' | 'unknown'): FlowType | null {
  if (intent === 'check_stock') return FlowTypeEnum.INVENTORY_CHECK;
  if (intent === 'check_prescription') return FlowTypeEnum.PRESCRIPTION_CONFIRMATION;
  if (intent === 'request_medication_info') return FlowTypeEnum.MEDICATION_INFO;
  return null;
}

export function getIntentPrompt(
  userMessage: string,
  currentStep: string | 'none',
  medicationContext: string,
  previousMessage?: string
): string {
  const previousMessagePart = previousMessage ? `\n${previousMessage}` : '';
  
  return `Analyze the user's message and determine their intent.

<context>
  <user_message>${userMessage}</user_message>
  <current_step>${currentStep}</current_step>
  <medication_context>${medicationContext}</medication_context>${previousMessagePart}
</context>

<important_rules>
- **CRITICAL PRIORITY**: If the requestedInfoType is 'stock', ALWAYS set intent to 'check_stock'.
- **CRITICAL PRIORITY**: If the requestedInfoType is 'prescription', ALWAYS set intent to 'check_prescription'.
- **CRITICAL PRIORITY**: If the requestedInfoType is 'dosage' or 'active_ingredients', ALWAYS set intent to 'request_medication_info'.
- If user mentions a medication name (like "Aspirin", "Ibuprofen") in their message, set containsMedicationName to true and extract the medication name in extractedMedicationName
- **CRITICAL**: If user says "Ibuprofen stock", "Aspirin dosage", "Metformin dosage", "prescription of Metformin", or any pattern with medication name + info type, extract BOTH the medication name AND the requestedInfoType
- **CRITICAL**: Patterns like "X dosage", "dosage of X", "X stock", "stock of X", "prescription of X", "X prescription", "does X need prescription" should set:
  - intent to the appropriate type (check_stock, request_medication_info, check_prescription)
  - requestedInfoType to the corresponding value (stock, dosage, prescription)
- **CRITICAL**: "Metformin dosage" = intent: "request_medication_info", requestedInfoType: "dosage", extractedMedicationName: "Metformin"
- **CRITICAL**: "Amoxicillin stock" = intent: "check_stock", requestedInfoType: "stock", extractedMedicationName: "Amoxicillin"
- If user just provides a medication name without asking for specific information (e.g., just "Aspirin"), set intent to "unknown" and requestedInfoType to null
- Do NOT infer requestedInfoType from medication names alone (unless explicitly mentioned like "Aspirin stock")
- Only set requestedInfoType if user explicitly asks for: dosage, active ingredients, prescription requirement, or stock availability
- If user says "yes" in response to a question about prescription/stock/dosage/ingredients, set intent to "confirm_yes" and extract requestedInfoType from the previous assistant message context
- If user mentions symptoms or small talk (like "I have a headache"), set isGreetingOrSmallTalk to true
- **CRITICAL**: If user message contains phrases like "send me this", "repeat this", "copy this", "echo this", or if the message appears to be asking you to repeat/echo text, set intent to "unknown" and isGreetingOrSmallTalk to true (this is out of scope)
</important_rules>

<intent_types>
1. check_stock - User asking about availability/stock
2. check_prescription - User asking if prescription is needed
3. request_medication_info - General info questions (dosage, active ingredients, "tell me about it")
4. confirm_yes - Agreement, "yes", "sure", "ok"
5. unknown - Greetings (hello, hi, שלום), small talk, unclear messages, or chatter
</intent_types>

<output_format>
JSON only:
{
  "intent": "check_stock" | "check_prescription" | "request_medication_info" | "confirm_yes" | "unknown",
  "requestedInfoType": "stock" | "dosage" | "active_ingredients" | "prescription" | null,
  "refersToLastResponse": boolean,
  "containsMedicationName": boolean,
  "isGreetingOrSmallTalk": boolean,
  "extractedMedicationName": string | null
}
</output_format>`;
}

