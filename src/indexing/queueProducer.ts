import type { Queue } from 'cloudflare:workers'; // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * Message payload sent to the 'indexing-jobs' queue.
 */
export interface IndexingJobMessage {
  /** Unique identifier for the project being indexed. */
  projectId: string;
  /** Root filesystem path to scan for source files. */
  rootPath: string;
  /** ISO-8601 timestamp of when the job was enqueued. */
  enqueuedAt: string;
  /** Schema version for forward-compatibility. */
  version: 1;
}

/**
 * Environment bindings required by the queue producer.
 */
export interface QueueProducerEnv {
  /** The Cloudflare Queue binding for indexing jobs. */
  INDEXING_JOBS_QUEUE: Queue<IndexingJobMessage>;
}

/**
 * Sends an indexing job message to the 'indexing-jobs' Cloudflare Queue.
 *
 * The message includes the project ID, root path, an ISO-8601 timestamp,
 * and a schema version for forward-compatibility.
 *
 * @param projectId - Unique identifier for the project to index.
 * @param rootPath  - Root filesystem path to scan.
 * @param env       - Environment bindings containing the queue reference.
 * @throws {Error}  - If the queue send operation fails.
 */
export async function triggerIndexing(
  projectId: string,
  rootPath: string,
  env: QueueProducerEnv,
): Promise<void> {
  if (!projectId || projectId.trim().length === 0) {
    throw new Error('projectId must be a non-empty string');
  }
  if (!rootPath || rootPath.trim().length === 0) {
    throw new Error('rootPath must be a non-empty string');
  }

  const message: IndexingJobMessage = {
    projectId: projectId.trim(),
    rootPath: rootPath.trim(),
    enqueuedAt: new Date().toISOString(),
    version: 1,
  };

  try {
    await env.INDEXING_JOBS_QUEUE.send(message);
  } catch (cause) {
    throw new Error(
      `Failed to enqueue indexing job for project '${projectId}': ${(cause as Error).message ?? cause}`,
      { cause: cause instanceof Error ? cause : undefined },
    );
  }
}
