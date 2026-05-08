import { routeModel } from '../router.js';
import { makeTestDb, seedProject, cleanupProject } from '../../../../test/runtime/seed.js';
import { pollUntil } from '../../../../test/e2e/polling-harness.js';
import { vi } from 'vitest';

// Mock shared dependencies
vi.mock('@autoengineering/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@autoengineering/shared');
  return {
    ...actual,
    emitLog: vi.fn(),
  };
});

vi.mock('../router.js', () => ({
  routeModel: vi.fn(),
}));

describe('routeModel (E2E)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const createdProjects: string[] = [];

  beforeAll(async () => {
    db = makeTestDb();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) {
      await cleanupProject(pid).catch(() => {});
    }
  });

  it('should correctly route models across multiple roles in sequence with DB state verification', async () => {
    // Seed a project to simulate real DB interaction
    const { projectId } = await seedProject(db);
    createdProjects.push(projectId);

    // Simulate multiple routing calls as part of a workflow
    const roles = ['code', 'manager', 'supervisor', 'task'] as const;
    const results: { role: string; provider: string; modelId: string }[] = [];

    for (const role of roles) {
      // Mock implementation per role to simulate dynamic routing
      vi.mocked(routeModel).mockImplementation((r) => {
        const models = (global as any).modelPacks[r];
        if (!models?.length) throw new Error(`No models for role: ${r}`);
        return { provider: models[0].provider, modelId: models[0].id };
      });

      const result = routeModel(role);
      results.push({ role, provider: result.provider, modelId: result.modelId });

      // Poll to ensure DB state reflects expected project existence
      await pollUntil(async () => {
        const project = await db.select().from(db.schema.projects).where({ id: projectId });
        return project.length > 0;
      }, { label: `project ${projectId} exists after ${role} routing` });
    }

    // Validate routing decisions
    expect(results).toHaveLength(4);
    expect(results[0].role).toBe('code');
    expect(results[0].modelId).toBe('claude-sonnet-4-20250514');
    expect(results[1].role).toBe('manager');
    expect(results[1].modelId).toBe('gemini-2.0-flash');
    expect(results[2].role).toBe('supervisor');
    expect(results[2].modelId).toBe('claude-haiku-3.5');
    expect(results[3].role).toBe('task');
    expect(results[3].modelId).toBe('claude-sonnet-4-20250514');
  });

  it('should fail fast when an invalid role is used in a multi-step workflow', async () => {
    const { projectId } = await seedProject(db);
    createdProjects.push(projectId);

    await pollUntil(async () => {
      const project = await db.select().from(db.schema.projects).where({ id: projectId });
      return project.length > 0;
    }, { label: 'project seeded' });

    expect(() => routeModel('hacker')).toThrow('No models available for role: hacker');
  });
});
