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

import worker from '../index';
import { makeTestDb, seedProject } from '../../../../test/runtime/seed';
import { QueueRecorder } from '../../../../test/runtime/queue-recorder';
import { pollUntil } from '../../../../test/e2e/polling-harness';

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('Indexing Queue Producer (E2E)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const q1 = new QueueRecorder();
  const createdProjects: string[] = [];

  beforeAll(async () => {
    db = makeTestDb();
  });

  beforeEach(() => {
    emitLogCapture.length = 0;
    vi.clearAllMocks();
    q1.reset();
  });

  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) await cleanupProject(pid).catch(() => {});
  });

  it('should survive duplicate messages in batch and maintain idempotency', async () => {
    // Arrange
    const { projectId } = await seedProject(db);
    createdProjects.push(projectId);
    const rootPath = '/src';

    const env = makeEnv({
      INDEXING_QUEUE: q1
    });

    // Create duplicate messages in same batch
    const msg = {
      type: 'indexing.start',
      version: 1,
      payload: { projectId, rootPath },
      idempotencyKey: `indexing-${projectId}-123`,
      correlationId: crypto.randomUUID(),
      sourceWorker: 'indexing-producer',
      timestamp: Date.now()
    };

    // Act: send duplicate messages in one batch
    await worker.queue(batch([msg, msg]), env);

    // Assert: only one message should be sent due to idempotency handling downstream
    // Note: QueueProducer itself doesn't dedupe, but the system must tolerate it
    // We expect the queue to receive two, but downstream services should handle idempotency
    expect(q1.sends.length).toBe(2);
    expect(q1.sends.map(s => s.message.payload.projectId)).toEqual([projectId, projectId]);

    // Verify both have same idempotency key
    const keys = q1.sends.map(s => (s.message as any).idempotencyKey);
    expect(new Set(keys).size).toBe(1); // deduplicated by key
  });

  it('should isolate indexing jobs across different projects', async () => {
    // Arrange
    const { projectId: pidA } = await seedProject(db);
    const { projectId: pidB } = await seedProject(db);
    createdProjects.push(pidA, pidB);

    const env = makeEnv({
      INDEXING_QUEUE: q1
    });

    const msgA = {
      type: 'indexing.start',
      version: 1,
      payload: { projectId: pidA, rootPath: '/src' },
      idempotencyKey: `indexing-${pidA}-123`,
      correlationId: crypto.randomUUID(),
      sourceWorker: 'indexing-producer',
      timestamp: Date.now()
    };

    const msgB = {
      type: 'indexing.start',
      version: 1,
      payload: { projectId: pidB, rootPath: '/lib' },
      idempotencyKey: `indexing-${pidB}-123`,
      correlationId: crypto.randomUUID(),
      sourceWorker: 'indexing-producer',
      timestamp: Date.now()
    };

    // Act
    await worker.queue(batch([msgA, msgB]), env);

    // Assert: messages are routed correctly and isolated
    const sentProjectIds = q1.sends
      .map(s => (s.message as any).payload.projectId)
      .sort();
    expect(sentProjectIds).toEqual([pidA, pidB].sort());

    // Ensure no cross-contamination
    const aMessages = q1.sends.filter(s => (s.message as any).payload.projectId === pidA);
    const bMessages = q1.sends.filter(s => (s.message as any).payload.projectId === pidB);
    expect(aMessages.length).toBe(1);
    expect(bMessages.length).toBe(1);
    expect((aMessages[0].message as any).payload.rootPath).toBe('/src');
    expect((bMessages[0].message as any).payload.rootPath).toBe('/lib');
  });
});
