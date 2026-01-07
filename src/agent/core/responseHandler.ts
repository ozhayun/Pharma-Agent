import type { FlowState, LastPresentedText } from '../flows';
import { FlowType as FlowTypeEnum } from '../flows';
import { updateLastPresentedText, generateFlowAwarePrompt } from '../flowManager';
import { parseAgentResponse } from './helpers';
import { prepareInputMessages } from './messageBuilder';
import logger from '../../utils/logger';
import type { StreamChunk } from './types';
import OpenAI from 'openai';
import { openai } from './client';
import { supportsReasoning } from '../../utils/utils';

/**
 * Formats and streams final assistant response
 * 
 * ## Process:
 * 1. Parses JSON response (extracts `response` and `options`)
 * 2. Updates `lastPresentedText` in flow state
 * 3. Yields chunks word-by-word with 20ms delay (typing effect)
 * 4. Yields final chunk with `done: true` and updated flowState
 * 
 * ## Used When:
 * - Non-streaming handler returns message (no tool calls)
 * - Final response ready to send to user
 */
export async function* handleAssistantResponse(
  assistantMessage: string,
  flowState: FlowState | undefined,
  iterationStartTime: number,
  agentStartTime: number,
  iteration: number
): AsyncGenerator<StreamChunk, void, unknown> {
  const parsed = parseAgentResponse(assistantMessage);
  const responseText = parsed.response;
  const responseOptions = parsed.options;

  let updatedFlowState = flowState;
  if (updatedFlowState) {
    const activeFlowType = updatedFlowState._activeFlowType!;
    let textType: LastPresentedText['type'] = 'general';
    if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK) textType = 'stock';
    else if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION) textType = 'prescription';
    else if (updatedFlowState.sharedSlots.medicationName) textType = 'medication_info';

    updatedFlowState = updateLastPresentedText(updatedFlowState, responseText, textType);
  }

  const words = responseText.split(' ');
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? '' : ' ') + words[i];
    yield { content: chunk, done: false, options: i === words.length - 1 ? responseOptions : undefined };
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  const iterationTime = Date.now() - iterationStartTime;
  logger.debug(`[AGENT] Iteration ${iteration} completed in ${iterationTime}ms`);
  const totalTime = Date.now() - agentStartTime;
  logger.debug(`[AGENT] Total processMessageStream time: ${totalTime}ms`);
  
  yield { content: '', done: true, context: { flowState: updatedFlowState }, options: responseOptions };
}

export async function* handleFallbackResponse(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  flowState: FlowState | undefined
): AsyncGenerator<StreamChunk, void, unknown> {
  logger.debug('[FALLBACK] Generating dynamic fallback response via AI');
  
  if (flowState) {
    messages[0].content = generateFlowAwarePrompt(flowState);
  }
  
  const inputMessages = prepareInputMessages(messages);
  const modelForResponses = process.env.OPENAI_MODEL || 'gpt-4o';
  
  const stream = await openai.responses.create({
    model: modelForResponses,
    input: inputMessages,
    stream: true,
    ...(supportsReasoning(modelForResponses) && { reasoning: { effort: "low" } }),
  });
  
  let assistantMessage = '';
  
  for await (const chunk of stream) {
    if (chunk.type === 'response.output_text.delta') {
      const event = chunk as any;
      const delta = event.delta;
      if (delta) {
        assistantMessage += delta;
        yield { content: delta, done: false };
      }
    }
  }
  
  const parsed = parseAgentResponse(assistantMessage);
  const responseText = parsed.response;
  const responseOptions = parsed.options;
  
  let updatedFlowState = flowState;
  if (updatedFlowState) {
    const activeFlowType = updatedFlowState._activeFlowType!;
    let textType: LastPresentedText['type'] = 'general';
    if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK) textType = 'stock';
    else if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION) textType = 'prescription';
    else if (updatedFlowState.sharedSlots.medicationName) textType = 'medication_info';
    
    updatedFlowState = updateLastPresentedText(updatedFlowState, responseText, textType);
  }
  
  logger.debug('[FALLBACK] Dynamic fallback response generated');
  yield { content: '', done: true, context: { flowState: updatedFlowState }, options: responseOptions };
}

