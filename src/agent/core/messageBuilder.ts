import OpenAI from 'openai';
import type { FlowState } from '../flows';

export function buildInitialMessages(
  systemPrompt: string,
  flowState: FlowState | undefined,
  userMessage: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (flowState?.sharedSlots.lastPresentedText) {
    messages.push({
      role: 'assistant',
      content: flowState.sharedSlots.lastPresentedText.content,
    });
  }

  messages.push({ role: 'user', content: userMessage });

  return messages;
}

export function prepareInputMessages(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return messages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
    .map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join('') : ''),
    }));
}

