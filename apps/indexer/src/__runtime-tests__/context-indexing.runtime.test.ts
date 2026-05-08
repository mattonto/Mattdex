import { vi } from 'vitest';
import { makeTestDb, seedProject, seedTask, cleanupProject } from '../../../../test/runtime/seed.js';
import { QueueRecorder } from '../../../../test/runtime/queue-recorder.js';

// ---- Mocks (must precede worker import) ----
vi.mock('@sentry/cloudflare', () => ({ withSentry: (_o, h) => h }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'mock' }))) }));
vi.mock('ai', () => ({ generateObject: vi.fn(async () => ({ object: { functions: [], classes: [] } })) }));

// Log capture — hoisting-safe pattern
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

// Import worker AFTER all vi.mock calls
import worker from '../index.js';

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('Context Indexing (runtime)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const createdProjects: string[] = [];

  beforeAll(async () => { db = makeTestDb(); });
  beforeEach(() => { emitLogCapture.length = 0; vi.clearAllMocks(); });
  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) await cleanupProject(pid).catch(() => {});
  });

  it('should index a multi-language project and populate files, symbols, and dependencies', async () => {
    const { projectId } = await seedProject(db);
    createdProjects.push(projectId);

    const q = new QueueRecorder();

    await worker.queue(
      {
        message: {
          type: 'indexProject',
          payload: { projectId, correlationId: 'corr-1', rootPath: '/tmp/project' }
        }
      },
      {
        CONTEXT_INDEXER_QUEUE: q as any,
        PLAN_TASKS_RETRY_QUEUE: q as any
      }
    );

    // Assert files were inserted
    const files = await db.select().from(db.schema.files).where(db.sql`projectId = ${projectId}`);
    expect(files.length).toBeGreaterThan(0);

    // Assert symbols were inserted for known files
    const symbolCount = await db.select({ count: db.sql<number>`${db.sql`count(*)`}` }).from(db.schema.symbols)
      .innerJoin(db.schema.files, db.sql`${db.schema.symbols.fileId} = ${db.schema.files.id}`)
      .where(db.sql`${db.schema.files.projectId} = ${projectId}`);
    expect(symbolCount[0]?.count).toBeGreaterThan(0);

    // Assert dependencies were inserted
    const deps = await db.select().from(db.schema.dependencies)
      .innerJoin(db.schema.files, db.sql`${db.schema.dependencies.fromFileId} = ${db.schema.files.id}`)
      .where(db.sql`${db.schema.files.projectId} = ${projectId}`);
    expect(deps.length).toBeGreaterThan(0);

    // Cross-project isolation: ensure no foreign project data leaked
    const otherProjectFiles = await db.select().from(db.schema.files).where(db.sql`projectId != ${projectId}`);
    expect(otherProjectFiles.length).toBe(0);
  });

  it('should be idempotent when receiving duplicate indexProject messages', async () => {
    const { projectId } = await seedProject(db);
    createdProjects.push(projectId);

    const q = new QueueRecorder();

    const msg = {
      message: {
        type: 'indexProject',
        payload: { projectId, correlationId: 'corr-1', rootPath: '/tmp/project' }
      }
    };

    // Send twice in one batch
    await worker.queue(
      { batch: [msg, msg] },
      {
        CONTEXT_INDEXER_QUEUE: q as any,
        PLAN_TASKS_RETRY_QUEUE: q as any
      }
    );

    const files = await db.select().from(db.schema.files).where(db.sql`projectId = ${projectId}`);
    const uniquePaths = new Set(files.map(f => f.path));
    expect(uniquePaths.size).toBe(files.length); // No duplicates
  });
});
