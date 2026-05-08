import { vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { makeTestDb, seedProject, cleanupProject } from '../../../../test/runtime/seed.js';
import { QueueRecorder } from '../../../../test/runtime/queue-recorder.js';

// ---- Mocks (must precede worker import) ----
vi.mock('@sentry/cloudflare', () => ({ withSentry: (_o, h) => h }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'mock' }))) }));
vi.mock('ai', () => ({ generateObject: vi.fn(async () => ({ object: { tasks: [] } })) }));

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

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('Sandbox State Creation (runtime)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const createdProjects: string[] = [];

  beforeAll(async () => { db = makeTestDb(); });
  beforeEach(() => { emitLogCapture.length = 0; vi.clearAllMocks(); });
  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) await cleanupProject(pid).catch(() => {});
  });

  it('creates sandbox_state row with correct defaults and original_checksum on project creation', async () => {
    const { projectId, correlationId } = await seedProject(db, { correlationId: 'corr-123' });
    createdProjects.push(projectId);

    const [row] = await db.select()
      .from(db.schema.sandboxStateTable)
      .where(sql`id = ${correlationId}`);

    expect(row).toBeDefined();
    expect(row.id).toBe('corr-123');
    expect(row.originalChecksum).toBe('');
    expect(row.cumulativeHash).toBe('');
    expect(row.checkpointBeforeApply).toBe('');
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('rejects staged_diffs insert with invalid sandbox_id foreign key', async () => {
    const q = new QueueRecorder();
    const env = { SANDBOX_STATE_QUEUE: q };

    const message = {
      type: 'STAGE_DIFF',
      payload: {
        sandboxId: 'nonexistent-123',
        patchHash: 'hash-abc',
        diffText: 'diff content',
        r2Version: 'r2-v1'
      }
    };

    await expect(worker.queue(batch([message]), env)).rejects.toThrow();

    expect(q.sends).toHaveLength(0);
    const log = emitLogCapture.find(l => l.level === 'error');
    expect(log).toBeDefined();
    expect(log?.message).toContain('foreign key');
  });
});