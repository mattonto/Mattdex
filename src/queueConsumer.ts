import { type MessageBatch, type ExecutionContext } from '@cloudflare/workers-types';

/**
 * Standard message envelope for Cloudflare Queues.
 * This interface is based on the `queue-patterns` skill.
 */
export interface QueueMessage<T = unknown> {
  type: string;
  version: number;
  payload: T;
  idempotencyKey: string;
  correlationId: string;
  sourceWorker: string;
  timestamp: number;
}

/**
 * Stub consumer for the Dead Letter Queue.
 * It logs messages that have failed processing in other queues.
 */
export default {
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        // Log the message body and metadata for inspection
        console.log(
          JSON.stringify({
            level: 'info',
            type: 'dlq_message_received',
            worker: 'llm-integration-service',
            messageId: message.id,
            timestamp: message.timestamp,
            attempts: message.attempts,
            messageBody: message.body,
            correlationId: message.body.correlationId || 'N/A',
          })
        );
        // Acknowledge the message to remove it from the DLQ
        message.ack();
      } catch (error) {
        // If logging itself fails, log a generic error and still ack to prevent re-processing
        console.error(
          JSON.stringify({
            level: 'error',
            type: 'dlq_processing_error',
            worker: 'llm-integration-service',
            messageId: message.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          })
        );
        message.ack(); // Still ack to prevent infinite loop if logging is the issue
      }
    }
  },
};
