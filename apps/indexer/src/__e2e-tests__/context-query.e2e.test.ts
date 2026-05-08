import { vi } from 'vitest';
import { makeTestDb, seedProject, seedTask, seedCheckpoint, setTaskStatus, pollTaskStatus } from '../../../../test/runtime/seed.js';
import { QueueRecorder } from '../../../../test/runtime/queue-recorder.js';
import { pollUntil } from '../../../../test/e2e/polling-harness.js';

// ---- Mocks ----
vi.mock('@sentry/cloudflare', () => ({ withSentry: (_o, h) => h }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'mock' }))) }));
vi.mock('ai', () => ({ generateObject: vi.fn(async () => ({ object: { functions: [], classes: [] } })) }));

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

import worker from '../index.js';

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('Context Query (E2E)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const createdProjects: string[] = [];

  beforeAll(async () => { db = makeTestDb(); });
  beforeEach(() => { emitLogCapture.length = 0; vi.clearAllMocks(); });
  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) await cleanupProject(pid).catch(() => {});
  });

  it('should resolve symbol references and file dependencies across multiple hops', async () => {
    const { projectId, correlationId } = await seedProject(db);
    createdProjects.push(projectId);

    const q = new QueueRecorder();

    // Step 1: Index the project
    await worker.queue(
      {
        message: {
          type: 'indexProject',
          payload: { projectId, correlationId, rootPath: '/tmp/project' }
        }
      },
      { CONTEXT_INDEXER_QUEUE: q as any }
    );

    // Wait for indexing to complete (files inserted)
    await pollUntil(async () => {
      const result = await db.select({ count: db.sql<number>`${db.sql`count(*)`}` })
        .from(db.schema.files)
        .where(db.sql`projectId = ${projectId}`);
      return result[0]?.count > 0;
    }, { label: 'files indexed' });

    // Step 2: Query for a symbol
    await worker.queue(
      {
        message: {
          type: 'queryContext',
          payload: { projectId, correlationId, query: 'handleRequest', type: 'symbol' }
        }
      },
      { CONTEXT_INDEXER_QUEUE: q as any }
    );

    // Verify response contains expected symbol
    const symbolResponses = q.sends.filter(s =>
      s.message['type'] === 'contextResult' &&
      s.message['payload']['projectId'] === projectId &&
      s.message['payload']['queryType'] === 'symbol'
    );
    expect(symbolResponses.length).toBe(1);
    expect(symbolResponses[0].message['payload']['results']).toContainEqual(
      expect.objectContaining({ symbolName: 'handleRequest' })
    );

    // Step 3: Query for file dependencies
    await worker.queue(
      {
        message: {
          type: 'queryContext',
          payload: { projectId, correlationId, query: 'src/api/routes.ts', type: 'fileDependencies' }
        }
      },
      { CONTEXT_INDEXER_QUEUE: q as any }
    );

    const depResponses = q.sends.filter(s =>
      s.message['type'] === 'contextResult' &&
      s.message['payload']['projectId'] === projectId &&
      s.message['payload']['queryType'] === 'fileDependencies'
    );
    expect(depResponses.length).toBe(1);
    expect(depResponses[0].message['payload']['results']).toBeArray();
  });
});
