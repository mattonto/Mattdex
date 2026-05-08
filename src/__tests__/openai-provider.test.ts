import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../providers/openai';
import { LLMError, LLMErrorCode } from '../providers/types';

describe('OpenAIProvider', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  describe('constructor', () => {
    it('should throw AUTHENTICATION_ERROR when apiKey is missing', () => {
      expect(() => new OpenAIProvider({} as any)).toThrow(LLMError);
      expect(() => new OpenAIProvider({} as any)).toThrow('OpenAI API key is required');
    });

    it('should use default baseUrl and model when not provided', () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      expect(provider).toBeDefined();
    });

    it('should use custom baseUrl and model when provided', () => {
      const provider = new OpenAIProvider({
        apiKey: 'sk-test',
        baseUrl: 'https://custom.openai.com/v1',
        defaultModel: 'gpt-4-turbo',
        fetchFn: mockFetch,
      });
      expect(provider).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should return LLMResponse on successful API call', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello, world!' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      const result = await provider.generate({
        messages: [{ role: 'user', content: 'Say hello' }],
      });

      expect(result.content).toBe('Hello, world!');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });

    it('should use custom model when specified in request', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4-turbo',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      await provider.generate({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gpt-4-turbo',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('gpt-4-turbo');
    });

    it('should pass maxTokens and temperature to the API', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      await provider.generate({
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 100,
        temperature: 0.7,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.max_tokens).toBe(100);
      expect(callBody.temperature).toBe(0.7);
    });

    it('should throw API_ERROR on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      };
      mockFetch.mockResolvedValue(mockResponse);

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      await expect(
        provider.generate({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow(LLMError);
      await expect(
        provider.generate({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow('OpenAI API error: 401 Unauthorized - Invalid API key');
    });

    it('should throw EMPTY_RESPONSE when choices array is empty', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4o',
          choices: [],
          usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      await expect(
        provider.generate({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow(LLMError);
      await expect(
        provider.generate({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow('OpenAI returned no choices');
    });

    it('should throw API_ERROR on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      await expect(
        provider.generate({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow(LLMError);
    });
  });

  describe('generateStream', () => {
    it('should return a ReadableStream on successful API call', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
          controller.close();
        },
      });
      const mockResponse = {
        ok: true,
        body: mockStream,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      const stream = await provider.generateStream({
        messages: [{ role: 'user', content: 'Say hello' }],
      });

      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should set stream: true in the request body', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      const mockResponse = {
        ok: true,
        body: mockStream,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      await provider.generateStream({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.stream).toBe(true);
    });

    it('should throw API_ERROR on non-ok response for stream', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      };
      mockFetch.mockResolvedValue(mockResponse);

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      await expect(
        provider.generateStream({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow(LLMError);
      await expect(
        provider.generateStream({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow('OpenAI API error: 429 Too Many Requests - Rate limit exceeded');
    });

    it('should throw EMPTY_RESPONSE when response body is null', async () => {
      const mockResponse = {
        ok: true,
        body: null,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const provider = new OpenAIProvider({ apiKey: 'sk-test', fetchFn: mockFetch });
      await expect(
        provider.generateStream({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow(LLMError);
      await expect(
        provider.generateStream({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow('OpenAI returned no response body for stream');
    });
  });
});
