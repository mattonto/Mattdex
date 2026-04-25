import { z } from 'zod';

// Minimal QueueMessage interface for local definition.
// In a full project, this would typically be imported from `@autoengineering/shared/types/queue-message`.
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
 * Payload for a Dead Letter Queue message.
 * Contains the original message that failed and details about the error.
 */
export interface DeadLetterQueuePayload {
  originalMessage: QueueMessage<unknown>;
  errorDetails: {
    message: string;
    stack?: string;
    timestamp: number;
    attempts?: number;
    // Add any other relevant context from the failure
    llmProvider?: string;
    model?: string;
    prompt?: unknown; // The prompt that was sent to the LLM
  };
}

/**
 * Full Dead Letter Queue message structure.
 */
export type DeadLetterQueueMessage = QueueMessage<DeadLetterQueuePayload>;

/**
 * Environment variables required for DeadLetterQueueService.
 */
export interface DeadLetterQueueServiceEnv {
  DEAD_LETTER_QUEUE: Queue;
}

/**
 * Service for sending messages to the Dead Letter Queue.
 */
export class DeadLetterQueueService {
  private readonly dlq: Queue;

  constructor(env: DeadLetterQueueServiceEnv) {
    this.dlq = env.DEAD_LETTER_QUEUE;
  }

  /**
   * Sends a failed message to the Dead Letter Queue.
   * @param originalMessage The original message that failed processing.
   * @param error The error object that caused the failure.
   * @param context Additional context about the failure, e.g., LLM provider, model, prompt.
   */
  public async send(
    originalMessage: QueueMessage<unknown>,
    error: unknown,
    context?: Omit<DeadLetterQueuePayload['errorDetails'], 'message' | 'stack' | 'timestamp'>
  ): Promise<void> {
    const errorDetails: DeadLetterQueuePayload['errorDetails'] = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: Date.now(),
      ...context,
    };

    const dlqMessage: DeadLetterQueueMessage = {
      type: 'llm.request.failed',
      version: 1,
      payload: {
        originalMessage,
        errorDetails,
      },
      idempotencyKey: `dlq-${originalMessage.idempotencyKey}-${Date.now()}`,
      correlationId: originalMessage.correlationId,
      sourceWorker: originalMessage.sourceWorker,
      timestamp: Date.now(),
    };

    console.error(
      JSON.stringify({
        level: 'error',
        type: 'dead_letter_queue_send',
        correlationId: originalMessage.correlationId,
        originalMessageType: originalMessage.type,
        error: errorDetails.message,
        llmProvider: context?.llmProvider,
        model: context?.model,
      })
    );

    await this.dlq.send(dlqMessage);
  }
}
