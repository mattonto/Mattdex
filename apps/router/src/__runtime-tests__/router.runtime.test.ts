import { routeModel } from '../router.js';
import { vi } from 'vitest';

// Mock shared dependencies that might be imported, but keep actual logic intact
vi.mock('@autoengineering/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@autoengineering/shared');
  return {
    ...actual,
    emitLog: vi.fn(),
  };
});

describe('routeModel (runtime)', () => {
  it('should route "code" role to a code-capable model and enforce isolation', () => {
    const result = routeModel('code');
    expect(result).toBeDefined();
    expect(result.provider).toBe('anthropic');
    expect(result.modelId).toBe('claude-sonnet-4-20250514');
  });

  it('should route "manager" role to a budget-tier model', () => {
    const result = routeModel('manager');
    expect(result).toBeDefined();
    expect(result.provider).toBe('google');
    expect(result.modelId).toBe('gemini-2.0-flash');
  });

  it('should route "supervisor" role to a mid-tier model', () => {
    const result = routeModel('supervisor');
    expect(result).toBeDefined();
    expect(result.provider).toBe('anthropic');
    expect(result.modelId).toBe('claude-haiku-3.5');
  });

  it('should route "task" role to a premium or mid-tier model', () => {
    const result = routeModel('task');
    expect(result).toBeDefined();
    expect(result.provider).toBe('anthropic');
    expect(result.modelId).toBe('claude-sonnet-4-20250514');
  });

  it('should throw an error when requesting a non-existent role', () => {
    expect(() => routeModel('nonexistent')).toThrow('No models available for role: nonexistent');
  });

  it('should enforce model isolation: "code" role must not receive non-code models', () => {
    const result = routeModel('code');
    const model = Object.values(modelPacks)
      .flat()
      .find(m => m.id === result.modelId);
    expect(model).toBeDefined();
    expect(model?.role).toBe('code');
  });
});
