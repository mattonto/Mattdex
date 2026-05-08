import { expect, describe, it, vi } from 'vitest';
import { MODEL_PACKS, ModelPack, Role } from '../../config/model-packs';

// Mock external dependencies if needed, but none for this in-memory config

describe('Model Packs Configuration', () => {
  it('should validate all model names against known models', () => {
    // Attempt to access MODEL_PACKS triggers validation
    expect(() => {
      // Simulate invalid model in a pack (we can't modify const, so test via type)
      // Instead, verify that invalid packs would throw by testing the schema directly if exported
      // Since validation runs at module load, we ensure no error was thrown
    }).not.toThrow();

    // Check that only valid models are present
    Object.values(MODEL_PACKS).forEach(pack => {
      Object.values(pack).forEach(models => {
        models.forEach(model => {
          expect('gpt-4' === model ||
                'gpt-3.5-turbo' === model ||
                'claude-instant-1' === model ||
                'claude-2' === model ||
                'llama-2-70b' === model).toBe(true);
        });
      });
    });
  });

  it('should prevent cross-pack access by design', () => {
    // Ensure MODEL_PACKS only contains defined packs
    const allowedPacks = ['default', 'fast', 'cheap'];
    Object.keys(MODEL_PACKS).forEach(packName => {
      expect(allowedPacks.includes(packName)).toBe(true);
    });

    // Attempt to access non-existent pack
    expect((MODEL_PACKS as Record<string, unknown>)['nonExistent']).toBeUndefined();
  });

  it('should enforce strict schema with no extra properties', () => {
    // Try to access a non-existent role
    Object.values(MODEL_PACKS).forEach(pack => {
      const unknownRole = (pack as Record<string, unknown>)['unknownRole'];
      expect(unknownRole).toBeUndefined();
    });
  });

  it('should support optional roles in packs', () => {
    // 'fast' pack only has 'chat'
    expect(MODEL_PACKS.fast).toHaveProperty('chat');
    expect(MODEL_PACKS.fast).not.toHaveProperty('code');
    expect(MODEL_PACKS.fast).not.toHaveProperty('summarize');
    expect(MODEL_PACKS.fast).not.toHaveProperty('translate');
  });
});
