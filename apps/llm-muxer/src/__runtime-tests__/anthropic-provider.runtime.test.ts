import { vi } from 'vitest';
import { AnthropicProvider } from '../providers/anthropic';

// Mock dependencies
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'mock response' }),
}));
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue({
    modelId: 'claude-2',
  }),
}));

const mockEnv = {
  ANTHROPIC_API_KEY: 'test-key',
};

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider(mockEnv);
    vi.clearAllMocks();
  });

  it('should initialize with valid API key', () => {
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('should throw if ANTHROPIC_API_KEY is missing', () => {
    expect(() => new AnthropicProvider({ ANTHROPIC_API_KEY: '' })).toThrow('ANTHROPIC_API_KEY is required');
    expect(() => new AnthropicProvider({ ANTHROPIC_API_KEY: undefined as any })).toThrow('ANTHROPIC_API_KEY is required');
  });

  it('should use default model claude-2 when no modelId is provided', async () => {
    await provider.complete('test prompt');
    expect(require('@ai-sdk/anthropic').anthropic).toHaveBeenCalledWith('claude-2', { apiKey: 'test-key' });
  });

  it('should use provided modelId if specified', async () => {
    await provider.complete('test prompt', 'claude-instant-1');
    expect(require('@ai-sdk/anthropic').anthropic).toHaveBeenCalledWith('claude-instant-0', { apiKey: 'test-key' });
  });

  it('should reject unsupported models', async () => {
    await expect(provider.complete('test prompt', 'claude-3')).rejects.toThrow('Unsupported Anthropic model: claude-3');
  });

  it('should propagate API errors', async () => {
    const mockGenerateText = vi.mocked(require('ai').generateText);
    mockGenerateText.mockRejectedValueOnce(new Error('API error'));

    await expect(provider.complete('test prompt')).rejects.toThrow('API error');
  });
});
