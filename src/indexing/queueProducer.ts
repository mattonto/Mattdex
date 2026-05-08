import { QueueMessage } from '@autoengineering/shared';
import { Env } from '../types';

/**
 * Payload for triggering project indexing via queue
 */
export interface IndexingJobPayload {
  projectId: string;
  rootPath: string;
}

/**
 * Sends a message to the 'indexing-jobs' queue to initiate async project indexing
 * @param projectId - Unique identifier for the project
 * @param rootPath - Root directory path to index
 */
export async function triggerIndexing(
  projectId: string,
  rootPath: string
): Promise<void> {
  // Validate inputs
  if (!projectId || !rootPath) {
    throw new Error('projectId and rootPath are required');
  }

  // Create message with envelope
  const message: QueueMessage<IndexingJobPayload> = {
    type: 'indexing.start',
    version: 1,
    payload: {
      projectId,
      rootPath
    },
    idempotencyKey: `indexing-${projectId}-${Date.now()}`,
    correlationId: crypto.randomUUID(),
    sourceWorker: 'indexing-producer',
    timestamp: Date.now()
  };

  // Send to queue
  // Note: This assumes env.INDEXING_QUEUE is available in context
  // In practice, this would be passed as a parameter or accessed via binding
  try {
    await env.INDEXING_QUEUE.send(message);
  } catch (error) {
    console.error('Failed to send indexing job to queue', {
      level: 'error',
      type: 'queue_send_failed',
      projectId,
      rootPath,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}
