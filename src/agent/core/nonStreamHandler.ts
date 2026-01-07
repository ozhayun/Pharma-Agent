import OpenAI from 'openai';
import type { FlowState } from '../flows';
import { getOpenAIFunctionsForResponses } from './helpers';
import { prepareInputMessages } from './messageBuilder';
import { executeToolCall, type ToolCall } from './toolExecution';
import { supportsReasoning } from '../../utils/utils';
import { openai } from './client';
import logger from '../../utils/logger';

/**
 * Handles non-streaming LLM requests (gpt-4o) for deterministic tool calls
 * 
 * ## Process:
 * 1. Makes non-streaming API call (waits for complete response)
 * 2. Extracts tool calls from response
 * 3. Executes tools sequentially
 * 4. Returns result with updated messages and flow state
 * 
 * ## Used When:
 * - `expectingToolCall=true` (code expects specific tool)
 * - Model: gpt-4o (fast, deterministic, lower cost)
 * - Temperature: 0.0 (deterministic output)
 */
export async function handleNonStreamingRequest(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  flowState: FlowState | undefined,
  toolChoice: 'auto' | 'required' | { type: 'function'; name: string } | null,
  allowTools: boolean,
  selectedModel: string,
  toolCallHistory: Array<{ name: string; iteration: number }>,
  iteration: number,
  maxToolCallsPerRequest: number,
  toolCallCount: number
): Promise<{
  assistantMessage: string;
  toolCalls: ToolCall[];
  updatedFlowState: FlowState | undefined;
  updatedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  toolsExecuted: number;
  newToolCallCount: number;
}> {
  const toolsParam = allowTools 
    ? { tools: getOpenAIFunctionsForResponses(flowState), tool_choice: toolChoice! }
    : {};
  
  const inputMessages = prepareInputMessages(messages);
  
  const gpt5StartTime = Date.now();
  const response = await openai.responses.create({
    model: selectedModel,
    input: inputMessages,
    ...toolsParam,
    stream: false,
    temperature: !supportsReasoning(selectedModel) ? 0 : undefined,
    ...(supportsReasoning(selectedModel) && { reasoning: { effort: "low" } }),
  });
  const gpt5EndTime = Date.now();
  const gpt5Duration = gpt5EndTime - gpt5StartTime;
  logger.debug(`[AGENT] API call completed in ${gpt5Duration}ms (non-streaming, model: ${selectedModel}, Responses API)`);

  const output = response.output || [];
  const outputMessage = output.find((o: any) => o.type === 'message') as any;
  const assistantMessage = outputMessage?.content?.find((c: any) => c.type === 'output_text')?.text || '';
  const toolCalls = output.filter((o: any) => o.type === 'function_call').map((tc: any) => ({
    id: tc.call_id || `call_${Date.now()}`,
    function: {
      name: tc.name,
      arguments: tc.arguments || '{}',
    },
  })) || [];

  let updatedMessages = [...messages];
  let updatedFlowState = flowState;
  let toolsExecuted = 0;
  let newToolCallCount = toolCallCount;

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

  return {
    assistantMessage,
    toolCalls,
    updatedFlowState,
    updatedMessages,
    toolsExecuted,
    newToolCallCount,
  };
}

