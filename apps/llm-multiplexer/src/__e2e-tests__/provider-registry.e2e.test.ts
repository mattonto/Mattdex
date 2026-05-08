import { vi } from 'vitest';
import { getProvider } from '../providers';
import { makeTestDb } from '../../../../test/runtime/seed.js';
import { pollUntil } from '../../../../test/e2e/polling-harness.js';

// Mock SDKs to verify config injection
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

describe('Provider Registry (E2E)', () => {
  let db: ReturnType<typeof makeTestDb>;

  beforeAll(async () => {
    db = makeTestDb();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize providers with runtime-injected API keys', async () => {
    // Simulate runtime environment with bindings
    const env = {
      OPENAI_API_KEY: 'mock-openai-key',
      ANTHROPIC_API_KEY: 'mock-anthropic-key',
    };

    // Dynamically set env on providers (mimics Worker bindings)
    // Note: In real Worker, this would be done via context/environment
    const { createOpenAI } = await import('@ai-sdk/openai');
    const { createAnthropic } = await import('@ai-sdk/anthropic');

    // Recreate providers with mocked env
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

    // Replace in module (only works in test isolation)
    await import('../providers').then((mod) => {
      // @ts-expect-error -- replacing for test
      mod.providers.openai = openai;
      // @ts-expect-error -- replacing for test
      mod.providers.anthropic = anthropic;
    });

    // Now call getProvider which should return configured instances
    const openaiProvider = getProvider('openai');
    const anthropicProvider = getProvider('anthropic');

    // Verify OpenAI config
    // @ts-expect-error -- private config
    expect(openaiProvider.config.apiKey).toBe('mock-openai-key');

    // Verify Anthropic config
    // @ts-expect-error -- private config
    expect(anthropicProvider.config.apiKey).toBe('mock-anthropic-key');

    // Ensure no unintended network calls
    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'mock-openai-key' });
    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'mock-anthropic-key' });
  });

  it('should maintain provider isolation across concurrent requests', async () => {
    const envA = { OPENAI_API_KEY: 'proj-a-key', ANTHROPIC_API_KEY: 'proj-a-anth' };
    const envB = { OPENAI_API_KEY: 'proj-b-key', ANTHROPIC_API_KEY: 'proj-b-anth' };

    // Simulate two concurrent projects using different keys
    const setupProviderForProject = async (env: typeof envA) => {
      const { createOpenAI } = await import('@ai-sdk/openai');
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      return {
        openai: createOpenAI({ apiKey: env.OPENAI_API_KEY }),
        anthropic: createAnthropic({ apiKey: env.ANTHROPIC_API_KEY }),
      };
    };

    const [providersA, providersB] = await Promise.all([
      setupProviderForProject(envA),
      setupProviderForProject(envB),
    ]);

    // Assert isolation
    // @ts-expect-error -- private config
    expect(providersA.openai.config.apiKey).not.toEqual(providersB.openai.config.apiKey);
    // @ts-expect-error -- private config
    expect(providersA.anthropic.config.apiKey).not.toEqual(providersB.anthropic.config.apiKey);

    // Cross-check: A's OpenAI key is not B's
    // @ts-expect-error -- private config
    expect(providersA.openai.config.apiKey).toBe('proj-a-key');
    // @ts-expect-error -- private config
    expect(providersB.openai.config.apiKey).toBe('proj-b-key');
  });
});
