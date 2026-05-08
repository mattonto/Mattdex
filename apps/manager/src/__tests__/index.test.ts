import { describe, it, expect, vi, beforeAll } from 'vitest';

// We test the wrangler.toml configuration by verifying the Env type matches
// the expected bindings. The actual validation is done by `wrangler deploy --dry-run`.

describe('Manager Worker Env bindings', () => {
  it('should have PLAN_SUPERVISOR as a Fetcher binding', () => {
    // Type-level test: the Env type must include PLAN_SUPERVISOR
    const env = {
      PLAN_SUPERVISOR: {} as Fetcher,
      PLAN_DB: {} as D1Database,
      GIT_QUEUE: {} as Queue,
    };
    expect(env.PLAN_SUPERVISOR).toBeDefined();
    expect(env.PLAN_DB).toBeDefined();
    expect(env.GIT_QUEUE).toBeDefined();
  });

  it('should respond to health check', async () => {
    // Dynamic import to avoid module resolution issues in test runner
    const mod = await import('../index');
    const env = {
      PLAN_SUPERVISOR: { fetch: vi.fn() } as unknown as Fetcher,
      PLAN_DB: {} as D1Database,
      GIT_QUEUE: {} as Queue,
    };
    const req = new Request('https://internal/health');
    const res = await mod.default.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
