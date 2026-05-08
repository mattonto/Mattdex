import { describe, it, expect } from 'vitest';
import { createRouter, type ModelPackConfig, type Role } from '../router';

describe('createRouter', () => {
  const baseConfig: ModelPackConfig = {
    code: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    },
    spec: {
      provider: 'openai',
      model: 'gpt-4o',
    },
    plan: {
      provider: 'openai',
      model: 'o3-mini',
    },
    verify: {
      provider: 'anthropic',
      model: 'claude-haiku-3-5-20241022',
    },
    security: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    },
  };

  it('returns the code provider/model for the "code" role', () => {
    const router = createRouter(baseConfig);
    const result = router.route('code');
    expect(result).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
  });

  it('returns the spec provider/model for the "spec" role', () => {
    const router = createRouter(baseConfig);
    const result = router.route('spec');
    expect(result).toEqual({
      provider: 'openai',
      model: 'gpt-4o',
    });
  });

  it('returns the plan provider/model for the "plan" role', () => {
    const router = createRouter(baseConfig);
    const result = router.route('plan');
    expect(result).toEqual({
      provider: 'openai',
      model: 'o3-mini',
    });
  });

  it('returns the verify provider/model for the "verify" role', () => {
    const router = createRouter(baseConfig);
    const result = router.route('verify');
    expect(result).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-3-5-20241022',
    });
  });

  it('returns the security provider/model for the "security" role', () => {
    const router = createRouter(baseConfig);
    const result = router.route('security');
    expect(result).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
  });

  it('throws for an unknown role', () => {
    const router = createRouter(baseConfig);
    expect(() => router.route('unknown' as Role)).toThrow('Unknown role: unknown');
  });

  it('throws when config is missing a required role key', () => {
    const incompleteConfig = { ...baseConfig } as ModelPackConfig;
    delete (incompleteConfig as Record<string, unknown>)['code'];
    expect(() => createRouter(incompleteConfig)).toThrow('Missing model pack config for role: code');
  });

  it('enforces isolation: code role never uses non-code models', () => {
    const router = createRouter(baseConfig);
    const result = router.route('code');
    // The code role must use a model from the code entry, not spec/plan/verify/security
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.provider).toBe('anthropic');
    // Verify it's NOT one of the other role models
    expect(result.model).not.toBe('gpt-4o');
    expect(result.model).not.toBe('o3-mini');
    expect(result.model).not.toBe('claude-haiku-3-5-20241022');
  });

  it('returns a frozen/immutable result object', () => {
    const router = createRouter(baseConfig);
    const result = router.route('code');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('handles config with optional fields gracefully', () => {
    const minimalConfig: ModelPackConfig = {
      code: { provider: 'openai', model: 'gpt-4o' },
      spec: { provider: 'openai', model: 'gpt-4o' },
      plan: { provider: 'openai', model: 'gpt-4o' },
      verify: { provider: 'openai', model: 'gpt-4o' },
      security: { provider: 'openai', model: 'gpt-4o' },
    };
    const router = createRouter(minimalConfig);
    expect(router.route('code')).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  describe('routeAll', () => {
    it('returns all role-to-provider/model mappings', () => {
      const router = createRouter(baseConfig);
      const all = router.routeAll();
      expect(all).toEqual({
        code: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
        spec: { provider: 'openai', model: 'gpt-4o' },
        plan: { provider: 'openai', model: 'o3-mini' },
        verify: { provider: 'anthropic', model: 'claude-haiku-3-5-20241022' },
        security: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      });
    });

    it('returns a frozen object', () => {
      const router = createRouter(baseConfig);
      const all = router.routeAll();
      expect(Object.isFrozen(all)).toBe(true);
    });
  });
});
