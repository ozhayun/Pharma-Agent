/**
 * Shared types for the AI agent
 */

import type { FlowState } from './flows';

export interface AgentContext {
  flowState?: FlowState;
}

export interface ChatRequest {
  message: string;
  context?: Partial<AgentContext>;
}

