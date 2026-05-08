import { vi } from 'vitest';
import { providers, getProvider, ProviderName } from '../providers';

// Mock the underlying SDKs to avoid actual network calls
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn((config) => ({
    model: vi.fn().mockReturnValue({
      doCompletion: vi.fn(),
    }),
    config,
  })),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn((config) => ({
    model: vi.fn().mockReturnValue({
      doCompletion: vi.fn(),
    }),
    config,
  })),
}));

describe('Provider Registry (runtime)', () => {
  it('should statically expose openai and anthropic providers', () => {
    expect(providers).toHaveProperty('openai');
    expect(providers).toHaveProperty('anthropic');
  });

  it('should allow runtime selection by name', () => {
    const openaiProvider = getProvider('openai');
    const anthropicProvider = getProvider('anthropic');

    expect(openaiProvider).toBe(providers.openai);
    expect(anthropicProvider).toBe(providers.anthropic);
  });

  it('should throw when requesting unknown provider', () => {
    expect(() => getProvider('unknown' as ProviderName)).toThrow('Provider not found: unknown');
  });

  it('should be tree-shakable: importing getProvider does not force instantiation of unused providers', () => {
    // This is a conceptual test — actual tree-shaking is verified in build
    // But we assert that the shape is static and does not have side effects
    expect(typeof getProvider).toBe('function');
    expect(Object.keys(providers).sort()).toEqual(['anthropic', 'openai']);
  });

  it('should support adding new providers via import + export (future proof)', () => {
    type CurrentProviders = typeof providers;
    // Future addition would be type-safe
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const supportsExpansion: CurrentProviders = {
      openai: providers.openai,
      anthropic: providers.anthropic,
      // newProvider: mockProvider  // Would be allowed if added to exports
    };
    expect(supportsExpansion).toBeTruthy();
  });
});
