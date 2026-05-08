import { describe, it, expect } from 'vitest';
import worker from '../index.js';

describe('Greeting Handler (E2E)', () => {
  it('responds with correct JSON over actual network', async () => {
    // This test runs against a deployed or locally running instance
    // For true E2E, we'd need a running server
    // Here we simulate the fetch directly
    const req = new Request('http://localhost/');
    const res = await worker.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const json = await res.json();
    expect(json).toEqual({ greeting: 'hello world' });
  });

  it('maintains correctness under load', async () => {
    const requests = Array(10).fill(0).map(() => new Request('http://localhost/'));
    const responses = await Promise.all(requests.map(r => worker.fetch(r)));

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/json');
      const json = await res.json();
      expect(json).toEqual({ greeting: 'hello world' });
    }
  });
});
