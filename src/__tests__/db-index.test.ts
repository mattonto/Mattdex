import { describe, it, expect, vi } from 'vitest';

// Mock neon before importing createDb
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('db/index', () => {
  it('should export createDb function', async () => {
    const mod = await import('../db/index');
    expect(mod.createDb).toBeInstanceOf(Function);
  });

  it('should export schema', async () => {
    const mod = await import('../db/index');
    expect(mod.schema).toBeDefined();
  });

  it('should create a db client when called with a URL', async () => {
    const mod = await import('../db/index');
    const db = mod.createDb('postgresql://test:test@localhost:5432/test');
    expect(db).toBeDefined();
  });

  it('should throw when called with empty URL', async () => {
    const mod = await import('../db/index');
    expect(() => mod.createDb('')).toThrow();
  });
});
