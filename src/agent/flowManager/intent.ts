import type { FlowState, ParsedUserIntent } from '../flows';
import OpenAI from 'openai';
import { detectLanguage, getIntentPrompt } from './utils';
import logger from '../../utils/logger';
import { supportsReasoning } from '../../utils/utils';

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000, 
    maxRetries: 2,
  });
}

/**
 * Parses user intent using LLM (gpt-4o) - FIRST LLM CALL
 * 
 * ## Returns:
 * - `intent`: check_stock | request_medication_info | check_prescription | confirm_yes | unknown
 * - `requestedInfoType`: stock | dosage | active_ingredients | prescription | null
 * - `extractedMedicationName`: Medication name if mentioned
 * - `language`: 'en' | 'he' (detected from message)
 * 
 * ## Fallbacks:
 * - No LLM response → `{intent: 'unknown', language: detectedLang}`
 * - LLM error → `{intent: 'unknown', language: detectedLang}`
 * 
 * ## Context:
 * - Includes current step, medication context, and last assistant message
 */
export async function parseUserIntent(
  userMessage: string,
  flowState: FlowState
): Promise<ParsedUserIntent & { language: 'en' | 'he' }> {
  const startTime = Date.now();
  const hasLastPresentedText = !!flowState.sharedSlots.lastPresentedText;
  const previousMessage = hasLastPresentedText ? `Previous assistant message: "${flowState.sharedSlots.lastPresentedText?.content}"` : undefined;
  const activeFlowType = flowState._activeFlowType;
  const currentStep = (activeFlowType && flowState.flows[activeFlowType]?.step) || 'none';

  const intentPrompt = getIntentPrompt(
    userMessage,
    currentStep,
    flowState.sharedSlots.medicationName || 'none',
    previousMessage
  );

  try {
    const openai = getOpenAIClient();
    const apiStartTime = Date.now();
    const response = await openai.responses.create({
      model: process.env.OPENAI_SMALL_MODEL || 'gpt-4o',
      input: [
        {
          role: 'system',
          content: 'You are a strict intent parser. Return only valid JSON.',
        },
        {
          role: 'user',
          content: intentPrompt,
        },
      ],
      text: { format: { type: 'json_object' } },
      temperature: !supportsReasoning(process.env.OPENAI_SMALL_MODEL || 'gpt-4o') ? 0.0 : undefined,
    });

    const apiDuration = Date.now() - apiStartTime;

    const output = response.output || [];
    const outputMessage = output.find((o: any) => o.type === 'message') as any;
    const textOutput = outputMessage?.content?.find((c: any) => c.type === 'output_text');
    const content = textOutput?.text;
    if (!content) {
      const detectedLang = detectLanguage(userMessage);
      const totalTime = Date.now() - startTime;
      logger.debug(`[INTENT] Total time: ${totalTime}ms (no content)`);
      return { intent: 'unknown', language: detectedLang };
    }

    const parsed = JSON.parse(content);
    const detectedLang = detectLanguage(userMessage);
    parsed.language = detectedLang;
    
    const totalTime = Date.now() - startTime;
    logger.debug(`[INTENT] Total time: ${totalTime}ms (API: ${apiDuration}ms)`);
    return parsed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT');
    
    if (isTimeout) {
      logger.error('[INTENT] Intent parsing timeout', errorMessage);
    } else {
      logger.error('[INTENT] Intent parsing failed', error);
    }
    const detectedLang = detectLanguage(userMessage);
    const totalTime = Date.now() - startTime;
    logger.debug(`[INTENT] Total time: ${totalTime}ms (error)`);
    return { intent: 'unknown', language: detectedLang };
  }
}

