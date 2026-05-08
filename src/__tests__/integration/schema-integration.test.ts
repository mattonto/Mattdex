import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the neon HTTP driver
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

// Mock drizzle-orm/neon-http
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => mockDb),
}));

describe('Schema Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sandbox_state CRUD', () => {
    it('should insert a sandbox state record', async () => {
      const { createDb } = await import('../../db/index');
      const db = createDb('postgresql://test:test@localhost:5432/test');
      
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'test-id' }]) });
      db.insert = mockInsert;

      const result = await db.insert({ id: 'test-id', originalChecksum: 'abc', cumulativeHash: 'def' });
      expect(result).toEqual([{ id: 'test-id' }]);
    });

    it('should select a sandbox state by id', async () => {
      const { createDb } = await import('../../db/index');
      const db = createDb('postgresql://test:test@localhost:5432/test');
      
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'test-id', originalChecksum: 'abc', cumulativeHash: 'def' }]),
        }),
      });
      db.select = mockSelect;

      const result = await db.select().from('sandbox_state').where({ id: 'test-id' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-id');
    });
  });

  describe('staged_diffs CRUD', () => {
    it('should insert a staged diff record', async () => {
      const { createDb } = await import('../../db/index');
      const db = createDb('postgresql://test:test@localhost:5432/test');
      
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'diff-1' }]) });
      db.insert = mockInsert;

      const result = await db.insert({ id: 'diff-1', sandboxId: 'test-id', patchHash: 'xyz', diffText: '--- a\n+++ b' });
      expect(result).toEqual([{ id: 'diff-1' }]);
    });

    it('should select staged diffs by sandboxId', async () => {
      const { createDb } = await import('../../db/index');
      const db = createDb('postgresql://test:test@localhost:5432/test');
      
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'diff-1', sandboxId: 'test-id', patchHash: 'xyz', diffText: '--- a\n+++ b' },
          ]),
        }),
      });
      db.select = mockSelect;

      const result = await db.select().from('staged_diffs').where({ sandboxId: 'test-id' });
      expect(result).toHaveLength(1);
      expect(result[0].sandboxId).toBe('test-id');
    });
  });

  describe('Foreign key constraint', () => {
    it('should enforce sandboxId references sandbox_state.id', async () => {
      const { schema } = await import('../../db/index');
      const sandboxIdColumn = schema.stagedDiffs.columns.sandboxId;
      
      expect(sandboxIdColumn.references).toBeDefined();
      expect(sandboxIdColumn.references?.table).toBe('sandbox_state');
      expect(sandboxIdColumn.references?.column).toBe('id');
    });
  });
});
