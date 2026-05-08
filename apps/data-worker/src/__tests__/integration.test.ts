import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock D1 binding
const mockDb = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  all: vi.fn(),
  first: vi.fn(),
  run: vi.fn(),
};

vi.mock('hono', () => {
  const Hono = vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    fetch: vi.fn(),
  }));
  return { Hono };
});

import { createApp } from '../index';

describe('Data Worker Integration', () => {
  let app: ReturnType<typeof createApp>;
  let env: { DB: D1Database; ENVIRONMENT: string };

  beforeEach(() => {
    vi.clearAllMocks();
    env = {
      DB: mockDb as unknown as D1Database,
      ENVIRONMENT: 'test',
    };
    app = createApp(env);
  });

  describe('Health endpoint', () => {
    it('should return 200 with correct shape', async () => {
      const res = await app.request('/health', {}, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ status: 'ok', worker: 'data-worker' });
    });
  });

  describe('Query endpoint', () => {
    it('should execute a SELECT query and return results', async () => {
      const mockResults = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
      mockDb.all.mockResolvedValue({ results: mockResults, success: true });

      const res = await app.request('/db/query?sql=SELECT+*+FROM+users', {}, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toHaveLength(2);
      expect(body.results[0].name).toBe('Alice');
    });

    it('should reject non-SELECT queries for safety', async () => {
      const res = await app.request('/db/query?sql=DELETE+FROM+users', {}, env);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Only SELECT queries');
    });
  });

  describe('Execute endpoint', () => {
    it('should execute a write query and return changes count', async () => {
      mockDb.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

      const res = await app.request('/db/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'UPDATE users SET name = ? WHERE id = ?', params: ['Charlie', 1] }),
      }, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.changes).toBe(1);
    });

    it('should reject SELECT queries on execute endpoint', async () => {
      const res = await app.request('/db/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT * FROM users' }),
      }, env);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Only write queries');
    });
  });

  describe('CORS preflight', () => {
    it('should handle OPTIONS requests', async () => {
      const res = await app.request('/health', { method: 'OPTIONS' }, env);
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
