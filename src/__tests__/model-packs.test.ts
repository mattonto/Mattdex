import { describe, it, expect } from 'vitest';
import {
  type ModelPack,
  parseModelPack,
  safeParseModelPack,
  defaultModelPack,
  minimalModelPack,
  getPrimaryModel,
  getModelsForRole,
  getRoles,
  hasRole,
} from '../config/model-packs';

// ---------------------------------------------------------------------------
// Unit tests – parseModelPack / safeParseModelPack
// ---------------------------------------------------------------------------

describe('parseModelPack', () => {
  it('accepts a valid model pack', () => {
    const input: unknown = { code: ['gpt-4', 'claude-instant-1'] };
    const result = parseModelPack(input);
    expect(result).toEqual({ code: ['gpt-4', 'claude-instant-1'] });
  });

  it('accepts a pack with multiple roles', () => {
    const input: unknown = {
      code: ['gpt-4'],
      chat: ['gpt-3.5-turbo'],
    };
    const result = parseModelPack(input);
    expect(result).toEqual({
      code: ['gpt-4'],
      chat: ['gpt-3.5-turbo'],
    });
  });

  it('rejects a non-object value', () => {
    expect(() => parseModelPack('not-an-object')).toThrow();
  });

  it('rejects null', () => {
    expect(() => parseModelPack(null)).toThrow();
  });

  it('rejects an empty array for a role', () => {
    const input: unknown = { code: [] };
    expect(() => parseModelPack(input)).toThrow();
  });

  it('rejects an empty role name', () => {
    const input: unknown = { '': ['gpt-4'] };
    expect(() => parseModelPack(input)).toThrow();
  });

  it('rejects a model ID with invalid characters', () => {
    const input: unknown = { code: ['gpt 4'] };
    expect(() => parseModelPack(input)).toThrow();
  });

  it('rejects a model ID that starts with a digit', () => {
    const input: unknown = { code: ['4-gpt'] };
    expect(() => parseModelPack(input)).toThrow();
  });

  it('rejects a model ID that is empty string', () => {
    const input: unknown = { code: [''] };
    expect(() => parseModelPack(input)).toThrow();
  });

  it('rejects a model ID longer than 64 characters', () => {
    const longId = 'a'.repeat(65);
    const input: unknown = { code: [longId] };
    expect(() => parseModelPack(input)).toThrow();
  });

  it('rejects a role name longer than 64 characters', () => {
    const longRole = 'a'.repeat(65);
    const input: unknown = { [longRole]: ['gpt-4'] };
    expect(() => parseModelPack(input)).toThrow();
  });
});

describe('safeParseModelPack', () => {
  it('returns the parsed pack for valid input', () => {
    const input: unknown = { code: ['gpt-4'] };
    const result = safeParseModelPack(input);
    expect(result).toEqual({ code: ['gpt-4'] });
  });

  it('returns null for invalid input', () => {
    const result = safeParseModelPack('invalid');
    expect(result).toBeNull();
  });

  it('returns null for null', () => {
    const result = safeParseModelPack(null);
    expect(result).toBeNull();
  });

  it('returns null for an empty array role', () => {
    const result = safeParseModelPack({ code: [] });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unit tests – defaultModelPack / minimalModelPack
// ---------------------------------------------------------------------------

describe('defaultModelPack', () => {
  it('satisfies the ModelPack type', () => {
    const pack: ModelPack = defaultModelPack;
    expect(pack).toBeDefined();
  });

  it('has at least one model per role', () => {
    for (const [role, models] of Object.entries(defaultModelPack)) {
      expect(models.length, `Role "${role}" has no models`).toBeGreaterThanOrEqual(1);
    }
  });

  it('includes expected roles', () => {
    expect(defaultModelPack).toHaveProperty('code');
    expect(defaultModelPack).toHaveProperty('reasoning');
    expect(defaultModelPack).toHaveProperty('chat');
    expect(defaultModelPack).toHaveProperty('review');
  });

  it('passes validation via parseModelPack', () => {
    expect(() => parseModelPack(defaultModelPack)).not.toThrow();
  });
});

describe('minimalModelPack', () => {
  it('satisfies the ModelPack type', () => {
    const pack: ModelPack = minimalModelPack;
    expect(pack).toBeDefined();
  });

  it('has exactly one model per role', () => {
    for (const [role, models] of Object.entries(minimalModelPack)) {
      expect(models.length, `Role "${role}" should have exactly 1 model`).toBe(1);
    }
  });

  it('passes validation via parseModelPack', () => {
    expect(() => parseModelPack(minimalModelPack)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Unit tests – lookup helpers
// ---------------------------------------------------------------------------

describe('getPrimaryModel', () => {
  const pack: ModelPack = { code: ['gpt-4', 'claude-instant-1'] };

  it('returns the first model for an existing role', () => {
    expect(getPrimaryModel(pack, 'code')).toBe('gpt-4');
  });

  it('returns undefined for a missing role', () => {
    expect(getPrimaryModel(pack, 'missing')).toBeUndefined();
  });

  it('returns undefined for an empty pack', () => {
    expect(getPrimaryModel({}, 'code')).toBeUndefined();
  });
});

describe('getModelsForRole', () => {
  const pack: ModelPack = { code: ['gpt-4', 'claude-instant-1'] };

  it('returns all models for an existing role', () => {
    expect(getModelsForRole(pack, 'code')).toEqual(['gpt-4', 'claude-instant-1']);
  });

  it('returns an empty array for a missing role', () => {
    expect(getModelsForRole(pack, 'missing')).toEqual([]);
  });

  it('returns an empty array for an empty pack', () => {
    expect(getModelsForRole({}, 'code')).toEqual([]);
  });
});

describe('getRoles', () => {
  it('returns all role names', () => {
    const pack: ModelPack = { a: ['m1'], b: ['m2'] };
    const roles = getRoles(pack);
    expect(roles).toEqual(expect.arrayContaining(['a', 'b']));
    expect(roles).toHaveLength(2);
  });

  it('returns an empty array for an empty pack', () => {
    expect(getRoles({})).toEqual([]);
  });
});

describe('hasRole', () => {
  const pack: ModelPack = { code: ['gpt-4'] };

  it('returns true for an existing role', () => {
    expect(hasRole(pack, 'code')).toBe(true);
  });

  it('returns false for a missing role', () => {
    expect(hasRole(pack, 'missing')).toBe(false);
  });

  it('returns false for an empty pack', () => {
    expect(hasRole({}, 'code')).toBe(false);
  });
});
