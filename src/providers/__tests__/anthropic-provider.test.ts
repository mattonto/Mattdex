import { describe, it, expect } from 'vitest';
import { createAnthropicProvider } from '../anthropic';

describe('Anthropic provider', () => {
  it('returns a provider with name "anthropic"', () => {
    const provider = createAnthropicProvider('sk-ant-test-123');
    expect(provider.name).toBe('anthropic');
  });

  it('chat() calls the underlying AI SDK and returns response', async () => {
    const provider = createAnthropicProvider('sk-ant-test-123');
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'claude-sonnet-4-20250514',
    });
    expect(result).toBeDefined();
    expect(result.content).toBeTypeOf('string');
  });

  it('chat() throws when model is empty', async () => {
    const provider = createAnthropicProvider('sk-ant-test-123');
    await expect(provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      model: '',
    })).rejects.toThrow('model is required');
  });

  it('chat() throws when messages array is empty', async () => {
    const provider = createAnthropicProvider('sk-ant-test-123');
    await expect(provider.chat({
      messages: [],
      model: 'claude-sonnet-4-20250514',
    })).rejects.toThrow('messages must not be empty');
  });

  it('streamChat() returns an async iterable', async () => {
    const provider = createAnthropicProvider('sk-ant-test-123');
    const stream = provider.streamChat!({ messages: [{ role: 'user', content: 'Hi' }], model: 'claude-sonnet-4-20250514' });
    expect(stream[Symbol.asyncIterator]).toBeTypeOf('function');
  });
});
