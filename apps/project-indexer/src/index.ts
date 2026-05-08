import { Hono } from 'hono';
import { handleQuery } from './query/handler';

// Define the environment interface
interface Env {
  INDEXING_QUEUE: Queue<unknown>;
  NEON_DB_CONNECTION_STRING: string;
}

// Export the Hono app as the fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const app = new Hono<{ Bindings: Env }>();

    // Route GET /query to query handler
    app.get('/query', handleQuery);

    return app.fetch(request, env, ctx);
  },

  // Queue consumer for indexing jobs
  async queue(batch: MessageBatch<{ type: string; payload: any; idempotencyKey: string; correlationId: string }>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      try {
        // Process each indexing job
        await processIndexingJob(message.body, env, ctx);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({
          level: 'error',
          type: 'indexing_job_failed',
          messageId: message.id,
          error: error instanceof Error ? error.message : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined,
          correlationId: message.body?.correlationId,
          timestamp: new Date().toISOString(),
        }));
        message.retry();
      }
    }
  },
};

// Process an individual indexing job
async function processIndexingJob(
  message: { type: string; payload: any; idempotencyKey: string; correlationId: string },
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  // Delegate to file processor based on message type
  switch (message.type) {
    case 'index.batch':
      await processBatch(message.payload, env, message.correlationId);
      break;
    default:
      console.warn(JSON.stringify({
        level: 'warn',
        type: 'unknown_message_type',
        messageType: message.type,
        correlationId: message.correlationId,
      }));
  }
}

// Process a batch of files
async function processBatch(
  payload: { files: Array<{ path: string; content: string; language: string }> },
  env: Env,
  correlationId: string
): Promise<void> {
  // This would invoke the file processor logic
  // In practice, this would be imported from another module
  console.log(JSON.stringify({
    level: 'info',
    type: 'processing_batch',
    fileCount: payload.files.length,
    correlationId,
    timestamp: new Date().toISOString(),
  }));

  // Simulate batch processing
  for (const file of payload.files) {
    await processFile(file, env, correlationId);
  }
}

// Process an individual file
async function processFile(
  file: { path: string; content: string; language: string },
  env: Env,
  correlationId: string
): Promise<void> {
  console.log(JSON.stringify({
    level: 'info',
    type: 'processing_file',
    path: file.path,
    language: file.language,
    correlationId,
    timestamp: new Date().toISOString(),
  }));

  // This would use tree-sitter to parse the file
  // and extract AST nodes (functions, classes, imports, exports)
  // Then store the results in Neon DB
}
