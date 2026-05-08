import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerIndexing, type IndexingJobMessage, type QueueProducerEnv } from '../../indexing/queueProducer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockQueue() {
  return {
    send: vi.fn<[IndexingJobMessage], Promise<void>>().mockResolvedValue(undefined),
  };
}

function makeEnv(queue: ReturnType<typeof makeMockQueue>): QueueProducerEnv {
  return { INDEXING_JOBS_QUEUE: queue };
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('triggerIndexing', () => {
  let mockQueue: ReturnType<typeof makeMockQueue>;
  let env: QueueProducerEnv;

  beforeEach(() => {
    mockQueue = makeMockQueue();
    env = makeEnv(mockQueue);
  });

  // --- Happy path ---

  it('should send a well-formed IndexingJobMessage to the queue', async () => {
    await triggerIndexing('proj-42', '/home/user/project', env);

    expect(mockQueue.send).toHaveBeenCalledTimes(1);
    const sent = mockQueue.send.mock.calls[0][0];

    expect(sent.projectId).toBe('proj-42');
    expect(sent.rootPath).toBe('/home/user/project');
    expect(sent.version).toBe(1);
    expect(sent.enqueuedAt).toBeDefined();
    expect(typeof sent.enqueuedAt).toBe('string');
    // Verify it's a valid ISO-8601 date
    expect(new Date(sent.enqueuedAt).toISOString()).toBe(sent.enqueuedAt);
  });

  it('should trim whitespace from projectId and rootPath', async () => {
    await triggerIndexing('  proj-7  ', '  /tmp/p  ', env);

    const sent = mockQueue.send.mock.calls[0][0];
    expect(sent.projectId).toBe('proj-7');
    expect(sent.rootPath).toBe('/tmp/p');
  });

  // --- Error paths ---

  it('should throw when projectId is empty', async () => {
    await expect(triggerIndexing('', '/some/path', env)).rejects.toThrow(
      'projectId must be a non-empty string',
    );
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('should throw when projectId is only whitespace', async () => {
    await expect(triggerIndexing('   ', '/some/path', env)).rejects.toThrow(
      'projectId must be a non-empty string',
    );
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('should throw when rootPath is empty', async () => {
    await expect(triggerIndexing('proj-1', '', env)).rejects.toThrow(
      'rootPath must be a non-empty string',
    );
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('should throw when rootPath is only whitespace', async () => {
    await expect(triggerIndexing('proj-1', '   ', env)).rejects.toThrow(
      'rootPath must be a non-empty string',
    );
    expect(mockQueue.send).not.toHaveBeenCalled();
  });

  it('should wrap queue send failure into a descriptive error', async () => {
    const queueError = new Error('Queue capacity exceeded');
    mockQueue.send.mockRejectedValue(queueError);

    await expect(
      triggerIndexing('proj-99', '/data', env),
    ).rejects.toThrow(
      /Failed to enqueue indexing job for project 'proj-99'/,
    );
  });

  it('should preserve the original cause when queue send fails', async () => {
    const queueError = new Error('Network error');
    mockQueue.send.mockRejectedValue(queueError);

    try {
      await triggerIndexing('proj-88', '/data', env);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect((err as Error).cause).toBe(queueError);
    }
  });

  it('should handle non-Error rejection (e.g. string)', async () => {
    mockQueue.send.mockRejectedValue('raw string error');

    await expect(
      triggerIndexing('proj-77', '/data', env),
    ).rejects.toThrow(
      /Failed to enqueue indexing job for project 'proj-77'/,
    );
  });
});
