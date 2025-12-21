import OpenAI from 'openai';
import type { ChatRequest, AgentContext } from './types';
import type { FlowState, LastPresentedText } from './flows';
import {
  updateFlowStateFromMessage,
  generateFlowAwarePrompt,
  handleToolError,
} from './flowManager';
import logger from '../utils/logger';
import type { StreamChunk } from './core/types';
import { determineToolChoice } from './core/toolChoice';
import { buildInitialMessages } from './core/messageBuilder';
import { handleNonStreamingRequest } from './core/nonStreamHandler';
import { handleStreamingRequest } from './core/streamHandler';
import { handleAssistantResponse, handleFallbackResponse } from './core/responseHandler';
import { handleError } from './core/errorHandler';
import { parseAgentResponse } from './core/helpers';
import { FlowType as FlowTypeEnum } from './flows';
import { updateLastPresentedText } from './flowManager';
import type { ToolCall } from './core/toolExecution';

export async function* processMessageStream(
  request: ChatRequest,
  _context?: AgentContext
): AsyncGenerator<StreamChunk, void, unknown> {
  const agentStartTime = Date.now();
  logger.debug(`\n-----------------------------------\n[AGENT] Starting processMessageStream\n-----------------------------------\n`);
  
  let flowState: FlowState | undefined = request.context?.flowState;

  flowState = await updateFlowStateFromMessage(flowState, request.message, []);

  const promptStartTime = Date.now();
  const systemPrompt = generateFlowAwarePrompt(flowState, request.message);
  const promptTime = Date.now() - promptStartTime;
  if (promptTime > 1) {
    logger.debug(`[AGENT] Prompt generation: ${promptTime}ms`);
  }

  let messages = buildInitialMessages(systemPrompt, flowState, request.message);

  let maxIterations = 5;
  let maxToolCallsPerRequest = 3;
  let toolCallCount = 0;
  let toolCallHistory: Array<{ name: string; iteration: number }> = [];
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    const iterationStartTime = Date.now();
    logger.debug(`[AGENT] Starting iteration ${iteration}`);
    
    try {
      if (iteration > 1 && flowState) {
        messages[0].content = generateFlowAwarePrompt(flowState);
      }

      const { toolChoice, allowTools, expectingToolCall } = determineToolChoice(flowState);

      const modelForToolCalls = process.env.OPENAI_SMALL_MODEL || 'gpt-4o';
      const modelForResponses = process.env.OPENAI_MODEL || 'gpt-4o';
      const selectedModel = expectingToolCall ? modelForToolCalls : modelForResponses;

      if (expectingToolCall) {
        const result = await handleNonStreamingRequest(
          messages,
          flowState,
          toolChoice,
          allowTools,
          selectedModel,
          toolCallHistory,
          iteration,
          maxToolCallsPerRequest,
          toolCallCount
        );

        messages = result.updatedMessages;
        flowState = result.updatedFlowState;
        toolCallCount = result.newToolCallCount;

        logger.debug('>> toolscalls',result.updatedFlowState?.sharedSlots.lastToolResult);
        if (result.updatedFlowState?.sharedSlots.lastToolResult && typeof result.updatedFlowState?.sharedSlots.lastToolResult === 'object' && 'error' in result.updatedFlowState?.sharedSlots.lastToolResult) {
          logger.debug('>> toolscalls error',result.updatedFlowState?.sharedSlots.lastToolResult.error);
          
          const { cleanedFlowState, errorMessage } = handleToolError(result.updatedFlowState);
          flowState = cleanedFlowState;
          
          messages.push({
            role: 'user',
            content: errorMessage,
          });
          
          if (flowState) {
            messages[0].content = generateFlowAwarePrompt(flowState);
          }
          
          continue;
        }

        if (result.toolCalls.length > 0) {
          if (result.toolsExecuted === 0 && result.toolCalls.length > 0 && iteration >= maxIterations - 1) {
            yield* handleFallbackResponse(messages, flowState);
            return;
          }
          
          continue;
        }

        if (result.assistantMessage) {
          yield* handleAssistantResponse(
            result.assistantMessage,
            flowState,
            iterationStartTime,
            agentStartTime,
            iteration
          );
          return;
        }
      } else {
        let streamResult: { assistantMessage: string; toolCalls: ToolCall[]; updatedFlowState: FlowState | undefined; updatedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]; toolsExecuted: number; newToolCallCount: number } | undefined;

        for await (const streamChunk of handleStreamingRequest(
          messages,
          flowState,
          toolChoice,
          allowTools,
          selectedModel,
          toolCallHistory,
          iteration,
          maxToolCallsPerRequest,
          toolCallCount
        )) {
          if (streamChunk.chunk) {
            yield streamChunk.chunk;
          }
          if (streamChunk.result) {
            streamResult = streamChunk.result;
          }
        }

        if (!streamResult) {
          continue;
        }

        messages = streamResult.updatedMessages;
        flowState = streamResult.updatedFlowState;
        toolCallCount = streamResult.newToolCallCount;

        if (streamResult.updatedFlowState?.sharedSlots.lastToolResult && typeof streamResult.updatedFlowState?.sharedSlots.lastToolResult === 'object' && 'error' in streamResult.updatedFlowState?.sharedSlots.lastToolResult) {
          logger.debug('>> toolscalls error (streaming)',streamResult.updatedFlowState?.sharedSlots.lastToolResult.error);
          
          const { cleanedFlowState, errorMessage } = handleToolError(streamResult.updatedFlowState);
          flowState = cleanedFlowState;
          
          messages.push({
            role: 'user',
            content: errorMessage,
          });
          
          if (flowState) {
            messages[0].content = generateFlowAwarePrompt(flowState);
          }
          
          continue;
        }

        if (streamResult.toolCalls.length > 0) {
          logger.debug(`[AGENT] Requested ${streamResult.toolCalls.length} tool call(s): ${streamResult.toolCalls.map(tc => tc.function.name).join(', ')}`);
        } else if (streamResult.assistantMessage && streamResult.assistantMessage.trim()) {
          const parsed = parseAgentResponse(streamResult.assistantMessage);
          const responseText = parsed.response;
          const responseOptions = parsed.options;

          if (flowState) {
            const activeFlowType = flowState._activeFlowType!;
            let textType: LastPresentedText['type'] = 'general';
            if (activeFlowType === FlowTypeEnum.INVENTORY_CHECK) textType = 'stock';
            else if (activeFlowType === FlowTypeEnum.PRESCRIPTION_CONFIRMATION) textType = 'prescription';
            else if (flowState.sharedSlots.medicationName) textType = 'medication_info';

            flowState = updateLastPresentedText(flowState, responseText, textType);
          }

          const iterationTime = Date.now() - iterationStartTime;
          logger.debug(`[AGENT] Iteration ${iteration} completed in ${iterationTime}ms`);
          const totalTime = Date.now() - agentStartTime;
          logger.debug(`[AGENT] Total processMessageStream time: ${totalTime}ms`);

          yield { content: '', done: true, context: { flowState }, options: responseOptions };
          return;
        }

        if (streamResult.toolCalls.length > 0) {
          if (streamResult.toolsExecuted === 0 && streamResult.toolCalls.length > 0 && iteration >= maxIterations - 1) {
            yield* handleFallbackResponse(messages, flowState);
            return;
          }
          
          continue;
        }
      }
    } catch (error) {
      yield* handleError(error);
      return;
    }
  }
}
