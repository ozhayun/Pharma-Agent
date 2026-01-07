import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { processMessageStream } from '../agent/agent';
import type { AgentContext } from '../agent/types';

interface ChatRequestBody {
  message: string;
  context?: Partial<AgentContext>;
}

function validateRequestContext(payload: ChatRequestBody): { valid: boolean; warning?: string } {
  if (payload.context?.flowState) {
    const state = payload.context.flowState;
    if (!state._activeFlowType) {
      return { valid: false, warning: 'flowState missing _activeFlowType' };
    }
    if (!state.flows || !state.flows[state._activeFlowType]) {
      return { valid: false, warning: 'flowState missing active flow' };
    }
  }
  return { valid: true };
}

/**
 * Registers POST /chat route handler
 * 
 * ## Process:
 * 1. Validates message (non-empty string)
 * 2. Validates flowState structure (logs warning if invalid, doesn't block)
 * 3. Sets SSE headers (text/event-stream, no-cache, keep-alive)
 * 4. Streams chunks from `processMessageStream()` as SSE events
 * 5. Formats: `data: {content, done, context: flowState, options}\n\n`
 * 
 * ## Error Handling:
 * - Request errors → Returns 400
 * - Processing errors → Streams error message, closes connection
 */
export async function registerChatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ChatRequestBody }>(
    '/chat',
    async (request: FastifyRequest<{ Body: ChatRequestBody }>, reply: FastifyReply) => {
      const { message } = request.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return reply.code(400).send({
          error: 'Invalid request',
          message: 'The "message" field is required and must be a non-empty string',
        });
      }

      const contextValidation = validateRequestContext(request.body);
      if (!contextValidation.valid) {
        fastify.log.warn({ warning: contextValidation.warning }, 'Invalid context structure');
      }

      try {
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');

        const stream = processMessageStream({ 
          message, 
          context: request.body.context 
        });

        let chunkCount = 0;
        let totalContentLength = 0;
        
        for await (const chunk of stream) {
          chunkCount++;
          if (chunk.content) {
            totalContentLength += chunk.content.length;
          }
          
          const data = JSON.stringify({
            content: chunk.content || '',
            done: chunk.done,
            context: chunk.context,
            options: chunk.options !== undefined ? chunk.options : undefined,
          });
          reply.raw.write(`data: ${data}\n\n`);

          if (chunk.done) {
            break;
          }
        }

        reply.raw.end();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error }, 'Error processing chat message');
        
        try {
          const errorData = JSON.stringify({
            content: `Error: ${errorMessage}`,
            done: true,
          });
          reply.raw.write(`data: ${errorData}\n\n`);
          reply.raw.end();
        } catch (streamError) {
          fastify.log.error({ error: streamError }, 'Failed to write error to stream');
          try {
            reply.raw.end();
          } catch {
          }
        }
      }
    }
  );
}
