vi.mock('@sentry/cloudflare', () => ({ withSentry: (_o, h) => h }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'mock' }))) }));
vi.mock('ai', () => ({ generateObject: vi.fn(async () => ({ object: { /* minimal valid */ } })) }));

const emitLogCapture: Array<Record<string, unknown>> = [];
vi.mock('@autoengineering/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@autoengineering/shared');
  return {
    ...actual,
    emitLog: (e: Record<string, unknown>) => { emitLogCapture.push(e); },
    getModelChain: vi.fn(() => ['Qwen/Qwen3-235B-A22B-Instruct-2507']),
    getModelProvider: vi.fn(() => 'deepinfra'),
    createModelFactory: vi.fn(() => vi.fn(() => ({ modelId: 'mock-model' }))),
    getSentryOptions: vi.fn(() => undefined),
    assemblePrompt: vi.fn(async () => 'prompt'),
    startTimer: () => () => 100,
    insertLlmCallDrizzle: vi.fn().mockResolvedValue(undefined),
    insertActionLogDrizzle: vi.fn().mockResolvedValue(undefined),
    addProjectCostDrizzle: vi.fn().mockResolvedValue(undefined),
  };
});

import { triggerIndexing } from '../queueProducer';
import { makeTestDb, seedProject } from '../../../../test/runtime/seed';
import { QueueRecorder } from '../../../../test/runtime/queue-recorder';

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('Indexing Queue Producer (runtime)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const queueRecorder = new QueueRecorder();

  beforeAll(async () => {
    db = makeTestDb();
  });

  beforeEach(() => {
    emitLogCapture.length = 0;
    vi.clearAllMocks();
  });

  it('should send valid indexing job message with correct schema and idempotency', async () => {
    // Arrange
    const { projectId } = await seedProject(db);
    const rootPath = '/src';

    // Mock env with queue
    const env = {
      INDEXING_QUEUE: {
        send: vi.fn().mockImplementation(async (msg) => queueRecorder.send(msg))
      }
    } as unknown as Env;

    // Spy on env.INDEXING_QUEUE.send
    const sendSpy = vi.spyOn(env.INDEXING_QUEUE, 'send');

    // Act
    await triggerIndexing(projectId, rootPath);

    // Assert message was sent once
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const [[sentMessage]] = sendSpy.mock.calls;
    expect(sentMessage).toMatchObject({
      type: 'indexing.start',
      version: 1,
      payload: {
        projectId,
        rootPath
      },
      idempotencyKey: expect.stringMatching(/^indexing-/),
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      sourceWorker: 'indexing-producer',
      timestamp: expect.any(Number)
    });

    // Verify idempotency key structure
    expect(sentMessage.idempotencyKey).toContain(projectId);
  });

  it('should throw error when projectId or rootPath is missing', async () => {
    await expect(triggerIndexing('', '/src')).rejects.toThrow('projectId and rootPath are required');
    await expect(triggerIndexing('proj_123', '')).rejects.toThrow('projectId and rootPath are required');
  });

  it('should log error when queue send fails', async () => {
    const { projectId } = await seedProject(db);
    const rootPath = '/src';

    const env = {
      INDEXING_QUEUE: {
        send: vi.fn().mockRejectedValue(new Error('Queue unavailable'))
      }
    } as unknown as Env;

    // Replace global env temporarily
    vi.mock('../types', () => ({
      Env: {
        INDEXING_QUEUE: env.INDEXING_QUEUE
      }
    }));

    // Re-import triggerIndexing to use mocked env
    const { triggerIndexing: trigger } = await import('../queueProducer');

    await expect(trigger(projectId, rootPath)).rejects.toThrow('Queue unavailable');

    // Assert error was logged
    expect(emitLogCapture).toContainEqual(
      expect.objectContaining({
        level: 'error',
        type: 'queue_send_failed',
        projectId,
        rootPath,
        error: 'Queue unavailable'
      })
    );
  });
});
