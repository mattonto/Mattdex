import { expect, describe, it, vi } from 'vitest';
import { MODEL_PACKS, ModelPack, Role } from '../../config/model-packs';

// This E2E test simulates runtime usage of model packs in a worker context
// Validates integration with routing logic (hypothetical)

describe('Model Packs E2E', () => {
  it('should allow role-based model selection from correct pack', () => {
    // Simulate runtime model selection
    const getModelsForRole = (packName: string, role: Role) => {
      const pack = MODEL_PACKS[packName as keyof typeof MODEL_PACKS];
      if (!pack) return null;
      return pack[role];
    };

    // Test valid access
    expect(getModelsForRole('default', 'code')).toEqual(['gpt-4', 'claude-instant-1']);
    expect(getModelsForRole('fast', 'chat')).toEqual(['gpt-3.5-turbo']);
    expect(getModelsForRole('cheap', 'code')).toEqual(['claude-instant-1']);
  });

  it('should isolate packs to prevent cross-pack access', () => {
    // Ensure one pack cannot access another's config
    const defaultCodeModels = MODEL_PACKS.default.code;
    const cheapCodeModels = MODEL_PACKS.cheap.code;

    expect(defaultCodeModels).not.toEqual(cheapCodeModels);
    expect(defaultCodeModels).toContain('gpt-4');
    expect(cheapCodeModels).not.toContain('gpt-4');
  });

  it('should fail fast on invalid model definitions', () => {
    // Since validation is at module load, we test that invalid packs don't exist
    // This is enforced by the in-memory config validation
    Object.values(MODEL_PACKS).forEach(pack => {
      Object.values(pack).forEach(models => {
        models.forEach(model => {
          expect(model).inArray(['gpt-4', 'gpt-3.5-turbo', 'claude-instant-1', 'claude-2', 'llama-2-70b']);
        });
      });
    });
  });
});
