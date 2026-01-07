import logger from '../../utils/logger';
import type { StreamChunk } from './types';

export function* handleError(error: unknown): Generator<StreamChunk, void, unknown> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const isTimeout = errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT');
  
  if (isTimeout) {
    logger.error('[AGENT] Request timeout - API call took too long', errorMessage);
    yield { content: `Sorry, the request timed out. Please try again with a shorter message or check your connection.`, done: true };
  } else {
    logger.error('[AGENT] Error in agent loop', errorMessage);
    yield { content: `Error: ${errorMessage}`, done: true };
  }
}


