import { describe, it, expect } from 'vitest';

// We test the handler logic directly by importing the function
// Since the worker exports a default object with fetch, we test via app.request pattern
// For unit-level testing, we construct a Request and call the exported fetch

import worker from '../index';

describe('GET /', () => {
  it('AC1: returns 200 with Content-Type application/json', async () => {
    const req = new Request('http://localhost/');
    const res = await worker.fetch(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('AC2: returns { greeting: "hello world" } in the body', async () => {
    const req = new Request('http://localhost/');
    const res = await worker.fetch(req);
    const body = await res.json() as { greeting: string };
    expect(body).toEqual({ greeting: 'hello world' });
  });

  it('AC3: returns 404 for unknown routes', async () => {
    const req = new Request('http://localhost/unknown');
    const res = await worker.fetch(req);
    expect(res.status).toBe(404);
  });

  it('returns 404 for POST /', async () => {
    const req = new Request('http://localhost/', { method: 'POST' });
    const res = await worker.fetch(req);
    expect(res.status).toBe(404);
  });

  it('returns 404 for GET /other', async () => {
    const req = new Request('http://localhost/other');
    const res = await worker.fetch(req);
    expect(res.status).toBe(404);
  });
});
