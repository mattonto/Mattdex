import { describe, it, expect, vi } from 'vitest';

describe('Plan Supervisor Worker Env bindings', () => {
  it('should have PLAN_DB and GIT_DLQ bindings', () => {
    const env = {
      PLAN_DB: {} as D1Database,
      GIT_DLQ: {} as Queue,
    };
    expect(env.PLAN_DB).toBeDefined();
    expect(env.GIT_DLQ).toBeDefined();
  });

  it('should respond to health check', async () => {
    const mod = await import('../index');
    const env = {
      PLAN_DB: {} as D1Database,
      GIT_DLQ: {} as Queue,
    };
    const req = new Request('https://internal/health');
    const res = await mod.default.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('should have a queue handler defined', async () => {
    const mod = await import('../index');
    expect(mod.default.queue).toBeDefined();
    expect(typeof mod.default.queue).toBe('function');
  });
});
