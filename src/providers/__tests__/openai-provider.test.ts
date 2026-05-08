import { describe, it, expect, vi } from 'vitest';
import { createOpenAIProvider } from '../openai';

describe('OpenAI provider', () => {
  it('returns a provider with name "openai"', () => {
    const provider = createOpenAIProvider('sk-test-123');
    expect(provider.name).toBe('openai');
  });

  it('chat() calls the underlying AI SDK and returns response', async () => {
    const provider = createOpenAIProvider('sk-test-123');
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4o',
    });
    expect(result).toBeDefined();
    expect(result.content).toBeTypeOf('string');
  });

  it('chat() throws when model is empty', async () => {
    const provider = createOpenAIProvider('sk-test-123');
    await expect(provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      model: '',
    })).rejects.toThrow('model is required');
  });

  it('chat() throws when messages array is empty', async () => {
    const provider = createOpenAIProvider('sk-test-123');
    await expect(provider.chat({
      messages: [],
      model: 'gpt-4o',
    })).rejects.toThrow('messages must not be empty');
  });

  it('streamChat() returns an async iterable', async () => {
    const provider = createOpenAIProvider('sk-test-123');
    const stream = provider.streamChat!({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o' });
    expect(stream[Symbol.asyncIterator]).toBeTypeOf('function');
  });
});
