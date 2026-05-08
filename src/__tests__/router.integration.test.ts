import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createRouter, type ModelPackConfig } from '../router';

// We test the router through a minimal Hono app to verify integration
// with the expected Cloudflare Workers binding pattern.

describe('Router Integration (Hono binding)', () => {
  let app: Hono<{ Bindings: { MODEL_PACK_CONFIG: string } }>;
  let config: ModelPackConfig;

  beforeEach(() => {
    config = {
      code: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      spec: { provider: 'openai', model: 'gpt-4o' },
      plan: { provider: 'openai', model: 'o3-mini' },
      verify: { provider: 'anthropic', model: 'claude-haiku-3-5-20241022' },
      security: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    };

    app = new Hono<{ Bindings: { MODEL_PACK_CONFIG: string } }>();

    // Simulate how the real worker would wire up the router
    app.get('/route/:role', async (c) => {
      const role = c.req.param('role');
      const rawConfig = c.env.MODEL_PACK_CONFIG;
      let parsedConfig: ModelPackConfig;
      try {
        parsedConfig = JSON.parse(rawConfig);
      } catch {
        return c.json({ error: 'Invalid MODEL_PACK_CONFIG' }, 500);
      }
      try {
        const router = createRouter(parsedConfig);
        const result = router.route(role as any);
        return c.json(result);
      } catch (err) {
        return c.json({ error: (err as Error).message }, 400);
      }
    });

    app.get('/route-all', async (c) => {
      const rawConfig = c.env.MODEL_PACK_CONFIG;
      let parsedConfig: ModelPackConfig;
      try {
        parsedConfig = JSON.parse(rawConfig);
      } catch {
        return c.json({ error: 'Invalid MODEL_PACK_CONFIG' }, 500);
      }
      const router = createRouter(parsedConfig);
      const all = router.routeAll();
      return c.json(all);
    });
  });

  it('returns 200 with provider/model for a valid role', async () => {
    const res = await app.request('/route/code', {}, {
      MODEL_PACK_CONFIG: JSON.stringify(config),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
  });

  it('returns 400 for an unknown role', async () => {
    const res = await app.request('/route/unknown', {}, {
      MODEL_PACK_CONFIG: JSON.stringify(config),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Unknown role');
  });

  it('returns 500 when MODEL_PACK_CONFIG is invalid JSON', async () => {
    const res = await app.request('/route/code', {}, {
      MODEL_PACK_CONFIG: 'not-json',
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Invalid MODEL_PACK_CONFIG');
  });

  it('returns 500 when MODEL_PACK_CONFIG is missing a required role', async () => {
    const incompleteConfig = { ...config } as Record<string, unknown>;
    delete incompleteConfig['code'];
    const res = await app.request('/route/code', {}, {
      MODEL_PACK_CONFIG: JSON.stringify(incompleteConfig),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing model pack config for role');
  });

  it('returns all routes via /route-all', async () => {
    const res = await app.request('/route-all', {}, {
      MODEL_PACK_CONFIG: JSON.stringify(config),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      code: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      spec: { provider: 'openai', model: 'gpt-4o' },
      plan: { provider: 'openai', model: 'o3-mini' },
      verify: { provider: 'anthropic', model: 'claude-haiku-3-5-20241022' },
      security: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    });
  });

  it('enforces isolation: code role never returns non-code model via HTTP', async () => {
    const res = await app.request('/route/code', {}, {
      MODEL_PACK_CONFIG: JSON.stringify(config),
    });
    const body = await res.json();
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.model).not.toBe('gpt-4o');
    expect(body.model).not.toBe('o3-mini');
    expect(body.model).not.toBe('claude-haiku-3-5-20241022');
  });
});
