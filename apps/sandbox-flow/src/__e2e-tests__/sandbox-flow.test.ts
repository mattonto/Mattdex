import { vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { makeTestDb, seedProject, cleanupProject } from '../../../../test/runtime/seed.js';
import { QueueRecorder } from '../../../../test/runtime/queue-recorder.js';
import { pollUntil } from '../../../../test/e2e/polling-harness.js';

// ---- Mocks ----
vi.mock('@sentry/cloudflare', () => ({ withSentry: (_o, h) => h }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'mock' }))) }));
vi.mock('ai', () => ({ generateObject: vi.fn(async () => ({ object: { tasks: [] } })) }));

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

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('Sandbox Flow (E2E)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const createdProjects: string[] = [];

  beforeAll(async () => { db = makeTestDb(); });
  beforeEach(() => { emitLogCapture.length = 0; vi.clearAllMocks(); });
  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) await cleanupProject(pid).catch(() => {});
  });

  it('end-to-end: creates sandbox, stages diff, and updates cumulative state', async () => {
    const { projectId, correlationId } = await seedProject(db, { correlationId: 'corr-123' });
    createdProjects.push(projectId);

    const q1 = new QueueRecorder();
    const q2 = new QueueRecorder();
    const env = { SANDBOX_STATE_QUEUE: q1, STAGED_DIFFS_QUEUE: q2 };

    // Hop 1: Create sandbox state
    const createMsg = {
      type: 'CREATE_SANDBOX',
      payload: { projectId, correlationId, originalChecksum: 'chk-123' }
    };
    await worker.queue(batch([createMsg]), env);

    await pollUntil(async () => {
      const [row] = await db.select().from(db.schema.sandboxStateTable).where(sql`id = ${correlationId}`);
      return row !== undefined;
    }, { label: 'sandbox created' });

    // Hop 2: Stage a diff
    const stageMsg = {
      type: 'STAGE_DIFF',
      payload: {
        sandboxId: correlationId,
        patchHash: 'patch-abc',
        diffText: 'const x = 1;',
        r2Version: 'r2-v1'
      }
    };
    await worker.queue(batch([stageMsg]), env);

    await pollUntil(async () => {
      const [row] = await db.select().from(db.schema.stagedDiffsTable).where(sql`id = ${correlationId + '-patch-abc'}`);
      return row !== undefined;
    }, { label: 'diff staged' });

    // Verify cumulativeHash was updated in sandbox_state
    const [state] = await db.select({
      cumulativeHash: db.schema.sandboxStateTable.cumulativeHash
    }).from(db.schema.sandboxStateTable).where(sql`id = ${correlationId}`);

    expect(state.cumulativeHash).toBe('patch-abc');
  });
});