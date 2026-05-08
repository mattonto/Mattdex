import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the entire module before importing
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

// We'll test the actual module after importing
import { createApp } from '../index';

describe('Data Worker', () => {
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

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await app.request('/health', {}, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok', worker: 'data-worker' });
    });

    it('should return 200 even when DB is not available (graceful)', async () => {
      const badEnv = { DB: undefined as unknown as D1Database, ENVIRONMENT: 'test' };
      const badApp = createApp(badEnv);
      const res = await badApp.request('/health', {}, badEnv);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok', worker: 'data-worker' });
    });
  });

  describe('GET /db/query', () => {
    it('should return 200 with query results', async () => {
      const mockRows = [{ id: 1, name: 'test' }];
      mockDb.all.mockResolvedValue({ results: mockRows, success: true });

      const res = await app.request('/db/query?sql=SELECT+*+FROM+test', {}, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ results: mockRows, success: true });
    });

    it('should return 400 when sql parameter is missing', async () => {
      const res = await app.request('/db/query', {}, env);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    it('should return 500 when DB query fails', async () => {
      mockDb.all.mockRejectedValue(new Error('DB error'));

      const res = await app.request('/db/query?sql=SELECT+*+FROM+test', {}, env);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });
  });

  describe('POST /db/execute', () => {
    it('should return 200 with execution results', async () => {
      mockDb.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

      const res = await app.request('/db/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'INSERT INTO test (name) VALUES (?)', params: ['hello'] }),
      }, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, changes: 1 });
    });

    it('should return 400 when sql is missing in body', async () => {
      const res = await app.request('/db/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    it('should return 400 when body is not valid JSON', async () => {
      const res = await app.request('/db/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }, env);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    it('should return 500 when DB execution fails', async () => {
      mockDb.run.mockRejectedValue(new Error('Execution error'));

      const res = await app.request('/db/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'INSERT INTO test (name) VALUES (?)', params: ['hello'] }),
      }, env);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.request('/unknown', {}, env);
      expect(res.status).toBe(404);
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in responses', async () => {
      const res = await app.request('/health', {}, env);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
  });
});
