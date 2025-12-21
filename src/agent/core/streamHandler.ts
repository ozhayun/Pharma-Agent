import OpenAI from 'openai';
import type { FlowState } from '../flows';
import { FlowType as FlowTypeEnum, MedicationInfoStep } from '../flows';
import { getOpenAIFunctionsForResponses } from './helpers';
import { prepareInputMessages } from './messageBuilder';
import { executeToolCall, type ToolCall } from './toolExecution';
import { supportsReasoning } from '../../utils/utils';
import { openai } from './client';
import logger from '../../utils/logger';
import type { StreamChunk } from './types';

export async function* handleStreamingRequest(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  flowState: FlowState | undefined,
  toolChoice: 'auto' | 'required' | { type: 'function'; name: string } | null,
  allowTools: boolean,
  selectedModel: string,
  toolCallHistory: Array<{ name: string; iteration: number }>,
  iteration: number,
  maxToolCallsPerRequest: number,
  toolCallCount: number
): AsyncGenerator<{ chunk?: StreamChunk; result?: { assistantMessage: string; toolCalls: ToolCall[]; updatedFlowState: FlowState | undefined; updatedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]; toolsExecuted: number; newToolCallCount: number } }, void, unknown> {
  const toolsParam = allowTools 
    ? { tools: getOpenAIFunctionsForResponses(flowState), tool_choice: toolChoice! }
    : {};
  
  const inputMessages = prepareInputMessages(messages);
  
  const gpt5StartTime = Date.now();
  const stream = await openai.responses.create({
    model: selectedModel,
    input: inputMessages,
    ...toolsParam,
    stream: true,
    ...(supportsReasoning(selectedModel) && { reasoning: { effort: "low" } }),
  });
  const gpt5EndTime = Date.now();
  const gpt5Duration = gpt5EndTime - gpt5StartTime;
  logger.debug(`[AGENT] API call completed in ${gpt5Duration}ms (streaming, model: ${selectedModel}, Responses API)`);

  let assistantMessage = '';
  const toolCallsMap = new Map<string, { id: string; name: string; arguments: string }>();
  const streamingStartTime = Date.now();

  for await (const chunk of stream) {
    if (chunk.type === 'response.output_text.delta') {
      const event = chunk as any;
      const delta = event.delta;
      if (delta) {
        assistantMessage += delta;
        yield { chunk: { content: delta, done: false } };
      }
    } else if (chunk.type === 'response.function_call_arguments.delta') {
      const event = chunk as any;
      const callId = event.call_id;
      if (callId) {
        if (!toolCallsMap.has(callId)) {
          toolCallsMap.set(callId, {
            id: callId,
            name: '',
            arguments: '',
          });
        }
        const tc = toolCallsMap.get(callId)!;
        if (event.delta) {
          tc.arguments += event.delta;
        }
      }
    } else if (chunk.type === 'response.function_call_arguments.done') {
    } else if (chunk.type === 'response.output_item.added') {
      const event = chunk as any;
      if (event.item?.type === 'function_call') {
        const tc = event.item;
        const callId = tc.call_id;
        if (callId) {
          toolCallsMap.set(callId, {
            id: callId,
            name: tc.name || '',
            arguments: tc.arguments || '',
          });
        }
      }
    }
  }

  const streamingEndTime = Date.now();
  const streamingDuration = streamingEndTime - streamingStartTime;
  logger.debug(`[AGENT] Streaming completed in ${streamingDuration}ms`);

  const toolCallsRaw = Array.from(toolCallsMap.values());
  const toolCalls: ToolCall[] = toolCallsRaw.map(tc => ({
    id: tc.id,
    function: {
      name: tc.name,
      arguments: tc.arguments,
    },
  }));
  let updatedMessages = [...messages];
  let updatedFlowState = flowState;
  let toolsExecuted = 0;
  let newToolCallCount = toolCallCount;
  
  if (toolCalls.length > 1 && flowState) {
    const activeFlowType = flowState._activeFlowType!;
    const activeFlow = flowState.flows[activeFlowType]!;
    if (activeFlowType === FlowTypeEnum.MEDICATION_INFO && 
        activeFlow.step === MedicationInfoStep.PROVIDE_INFO) {
      logger.warn('Multiple tool calls detected in PROVIDE_INFO - enforcing single intent');
      const singleToolCall = [toolCalls[0]];
      const messagesToProcess = singleToolCall;
      
      updatedMessages.push({
        role: 'assistant',
        content: assistantMessage || null,
        tool_calls: messagesToProcess.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      for (const toolCall of messagesToProcess) {
        const result = await executeToolCall(
          toolCall,
          updatedFlowState,
          toolCallHistory,
          iteration,
          maxToolCallsPerRequest,
          newToolCallCount
        );

        newToolCallCount = result.newToolCallCount;

        if (!result.success) {
          updatedMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: result.error }),
          });
          continue;
        }

        if (result.updatedFlowState) {
          updatedFlowState = result.updatedFlowState;
        }

        toolsExecuted++;

        updatedMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.toolResult),
        });
      }

      yield { result: { assistantMessage, toolCalls: [], updatedFlowState, updatedMessages, toolsExecuted, newToolCallCount } };
      return;
    }
  }

  if (toolCalls.length > 0) {
    updatedMessages.push({
      role: 'assistant',
      content: assistantMessage || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    });
    
    for (const toolCall of toolCalls) {
      const result = await executeToolCall(
        toolCall,
        updatedFlowState,
        toolCallHistory,
        iteration,
        maxToolCallsPerRequest,
        newToolCallCount
      );

      newToolCallCount = result.newToolCallCount;

      if (!result.success) {
        updatedMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: result.error }),
        });
        continue;
      }

      if (result.updatedFlowState) {
        updatedFlowState = result.updatedFlowState;
      }

      toolsExecuted++;

      updatedMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result.toolResult),
      });
    }
  }

  yield { result: { assistantMessage, toolCalls, updatedFlowState, updatedMessages, toolsExecuted, newToolCallCount } };
}
