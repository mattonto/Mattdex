import { vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { makeTestDb, seedProject, cleanupProject } from '../../../../test/runtime/seed.js';
import { QueueRecorder } from '../../../../test/runtime/queue-recorder.js';

// ---- Mocks (must precede worker import) ----
vi.mock('@sentry/cloudflare', () => ({ withSentry: (_o, h) => h }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'mock' }))) }));
vi.mock('ai', () => ({ generateObject: vi.fn(async () => ({ object: { tasks: [] } })) }));

// Log capture
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

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('Staged Diffs Insertion (runtime)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const createdProjects: string[] = [];

  beforeAll(async () => { db = makeTestDb(); });
  beforeEach(() => { emitLogCapture.length = 0; vi.clearAllMocks(); });
  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) await cleanupProject(pid).catch(() => {});
  });

  it('inserts staged_diffs row with valid foreign key and sets r2Version', async () => {
    const { projectId, correlationId } = await seedProject(db, { correlationId: 'corr-123' });
    createdProjects.push(projectId);

    const q = new QueueRecorder();
    const env = { STAGED_DIFFS_QUEUE: q };

    const message = {
      type: 'STAGE_DIFF',
      payload: {
        sandboxId: correlationId,
        patchHash: 'hash-abc',
        diffText: 'diff content',
        r2Version: 'r2-v1'
      }
    };

    await worker.queue(batch([message]), env);

    const [row] = await db.select()
      .from(db.schema.stagedDiffsTable)
      .where(sql`id = ${message.payload.sandboxId + '-' + message.payload.patchHash}`);

    expect(row).toBeDefined();
    expect(row.sandboxId).toBe(correlationId);
    expect(row.patchHash).toBe('hash-abc');
    expect(row.diffText).toBe('diff content');
    expect(row.r2Version).toBe('r2-v1');
    expect(row.appliedAt).toBeNull();
  });

  it('enforces unique composite key on staged_diffs (sandboxId, patchHash)', async () => {
    const { projectId, correlationId } = await seedProject(db, { correlationId: 'corr-123' });
    createdProjects.push(projectId);

    const q = new QueueRecorder();
    const env = { STAGED_DIFFS_QUEUE: q };

    const message = {
      type: 'STAGE_DIFF',
      payload: {
        sandboxId: correlationId,
        patchHash: 'hash-abc',
        diffText: 'diff content',
        r2Version: 'r2-v1'
      }
    };

    // Insert first time
    await worker.queue(batch([message]), env);
    // Insert duplicate
    await expect(worker.queue(batch([message]), env)).rejects.toThrow();

    const rows = await db.select({ count: sql<number>`count(*)` })
      .from(db.schema.stagedDiffsTable)
      .where(sql`sandbox_id = ${correlationId}`);

    expect(rows[0].count).toBe('1');
  });
});