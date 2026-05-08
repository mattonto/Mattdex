import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';

// Mock external dependencies (if any)
// None needed for this simple handler

// Import the worker after mocks
import worker from '../index.js';

describe('Greeting Handler (runtime)', () => {
  let app: Hono;

  beforeAll(() => {
    app = new Hono();
    // Re-import or re-assign if needed
    // For this simple case, we can just use the exported default
  });

  it('returns 200 OK with JSON greeting', async () => {
    const req = new Request('http://localhost/');
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const json = await res.json();
    expect(json).toEqual({ greeting: 'hello world' });
  });

  it('handles multiple concurrent requests correctly', async () => {
    const req1 = new Request('http://localhost/');
    const req2 = new Request('http://localhost/');
    const req3 = new Request('http://localhost/');

    const [res1, res2, res3] = await Promise.all([
      app.fetch(req1),
      app.fetch(req2),
      app.fetch(req3)
    ]);

    for (const res of [res1, res2, res3]) {
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/json');
      const json = await res.json();
      expect(json).toEqual({ greeting: 'hello world' });
    }
  });
});
