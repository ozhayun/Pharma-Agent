import type { AgentContext } from '../types';

export interface StreamChunk {
  content?: string;
  done: boolean;
  context?: Partial<AgentContext>;
  options?: string[] | null;
  toolCall?: {
    name: string;
    arguments: string;
  };
}

export interface ParsedResponse {
  response: string;
  options: string[] | null;
}
