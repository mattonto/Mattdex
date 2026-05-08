import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProvider } from '../anthropic';
import type { LLMRequest, LLMResponse, ProviderConfig } from '../../types';

// Mock the AI SDK's anthropic function
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({
    chat: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        text: 'Mocked response from Claude',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
    }),
  })),
}));

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockEnv: { ANTHROPIC_API_KEY: string };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = { ANTHROPIC_API_KEY: 'sk-ant-test-key-12345' };
    provider = new AnthropicProvider(mockEnv);
  });

  describe('constructor', () => {
    it('should throw if ANTHROPIC_API_KEY is missing', () => {
      expect(() => new AnthropicProvider({} as { ANTHROPIC_API_KEY: string })).toThrow(
        'ANTHROPIC_API_KEY is required'
      );
    });

    it('should throw if ANTHROPIC_API_KEY is empty', () => {
      expect(() => new AnthropicProvider({ ANTHROPIC_API_KEY: '' })).toThrow(
        'ANTHROPIC_API_KEY is required'
      );
    });

    it('should throw if ANTHROPIC_API_KEY is whitespace only', () => {
      expect(() => new AnthropicProvider({ ANTHROPIC_API_KEY: '   ' })).toThrow(
        'ANTHROPIC_API_KEY is required'
      );
    });

    it('should initialize successfully with valid API key', () => {
      const p = new AnthropicProvider({ ANTHROPIC_API_KEY: 'sk-ant-valid' });
      expect(p).toBeInstanceOf(AnthropicProvider);
    });
  });

  describe('name', () => {
    it('should return "anthropic"', () => {
      expect(provider.name).toBe('anthropic');
    });
  });

  describe('generate()', () => {
    const baseRequest: LLMRequest = {
      model: 'claude-v1',
      messages: [{ role: 'user', content: 'Hello, Claude!' }],
      maxTokens: 100,
      temperature: 0.7,
    };

    it('should return a valid LLMResponse on success', async () => {
      const result = await provider.generate(baseRequest);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('usage');
      expect(result.text).toBe('Mocked response from Claude');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    it('should accept claude-v1 model', async () => {
      const result = await provider.generate({ ...baseRequest, model: 'claude-v1' });
      expect(result.text).toBeDefined();
    });

    it('should accept claude-v1.2 model', async () => {
      const result = await provider.generate({ ...baseRequest, model: 'claude-v1.2' });
      expect(result.text).toBeDefined();
    });

    it('should accept claude-instant-v1 model', async () => {
      const result = await provider.generate({ ...baseRequest, model: 'claude-instant-v1' });
      expect(result.text).toBeDefined();
    });

    it('should reject unsupported model', async () => {
      await expect(
        provider.generate({ ...baseRequest, model: 'gpt-4' })
      ).rejects.toThrow('Unsupported model: gpt-4');
    });

    it('should reject empty model string', async () => {
      await expect(
        provider.generate({ ...baseRequest, model: '' })
      ).rejects.toThrow('Unsupported model:');
    });

    it('should pass temperature to the underlying model', async () => {
      const { anthropic } = await import('@ai-sdk/anthropic');
      const mockAnthropic = vi.mocked(anthropic);

      await provider.generate({ ...baseRequest, temperature: 0.5 });

      expect(mockAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.5 })
      );
    });

    it('should pass maxTokens to the underlying model', async () => {
      const { anthropic } = await import('@ai-sdk/anthropic');
      const mockAnthropic = vi.mocked(anthropic);

      await provider.generate({ ...baseRequest, maxTokens: 200 });

      expect(mockAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ maxTokens: 200 })
      );
    });

    it('should handle empty messages array', async () => {
      const result = await provider.generate({ ...baseRequest, messages: [] });
      expect(result.text).toBeDefined();
    });

    it('should handle system message', async () => {
      const result = await provider.generate({
        ...baseRequest,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      });
      expect(result.text).toBeDefined();
    });

    it('should handle multiple messages in conversation', async () => {
      const result = await provider.generate({
        ...baseRequest,
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
          { role: 'user', content: 'How are you?' },
        ],
      });
      expect(result.text).toBeDefined();
    });

    it('should propagate errors from the underlying SDK', async () => {
      const { anthropic } = await import('@ai-sdk/anthropic');
      const mockAnthropic = vi.mocked(anthropic);
      const mockError = new Error('API rate limit exceeded');

      mockAnthropic.mockImplementationOnce(() => {
        throw mockError;
      });

      await expect(provider.generate(baseRequest)).rejects.toThrow(
        'Anthropic API error: API rate limit exceeded'
      );
    });

    it('should handle non-Error thrown values gracefully', async () => {
      const { anthropic } = await import('@ai-sdk/anthropic');
      const mockAnthropic = vi.mocked(anthropic);

      mockAnthropic.mockImplementationOnce(() => {
        throw 'string error';
      });

      await expect(provider.generate(baseRequest)).rejects.toThrow(
        'Anthropic API error: Unknown error'
      );
    });

    it('should handle null/undefined thrown values gracefully', async () => {
      const { anthropic } = await import('@ai-sdk/anthropic');
      const mockAnthropic = vi.mocked(anthropic);

      mockAnthropic.mockImplementationOnce(() => {
        throw null;
      });

      await expect(provider.generate(baseRequest)).rejects.toThrow(
        'Anthropic API error: Unknown error'
      );
    });
  });

  describe('supportsModel()', () => {
    it('should return true for claude-v1', () => {
      expect(provider.supportsModel('claude-v1')).toBe(true);
    });

    it('should return true for claude-v1.2', () => {
      expect(provider.supportsModel('claude-v1.2')).toBe(true);
    });

    it('should return true for claude-instant-v1', () => {
      expect(provider.supportsModel('claude-instant-v1')).toBe(true);
    });

    it('should return true for claude-instant-v1.1', () => {
      expect(provider.supportsModel('claude-instant-v1.1')).toBe(true);
    });

    it('should return false for gpt-4', () => {
      expect(provider.supportsModel('gpt-4')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(provider.supportsModel('')).toBe(false);
    });

    it('should return false for nullish values', () => {
      expect(provider.supportsModel(null as unknown as string)).toBe(false);
      expect(provider.supportsModel(undefined as unknown as string)).toBe(false);
    });

    it('should return false for random string', () => {
      expect(provider.supportsModel('random-model-name')).toBe(false);
    });
  });

  describe('getDefaultModel()', () => {
    it('should return claude-v1', () => {
      expect(provider.getDefaultModel()).toBe('claude-v1');
    });
  });
});
