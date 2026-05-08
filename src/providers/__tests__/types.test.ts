import { describe, it, expect } from 'vitest';
import type { Provider, ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from '../types';

describe('provider types', () => {
  it('ProviderConfig accepts valid config', () => {
    const config: ProviderConfig = { name: 'openai', apiKey: 'sk-xxx' };
    expect(config.name).toBe('openai');
    expect(config.apiKey).toBe('sk-xxx');
  });

  it('ProviderConfig allows optional model', () => {
    const config: ProviderConfig = { name: 'anthropic', apiKey: 'sk-ant-xxx', model: 'claude-3-opus-20240229' };
    expect(config.model).toBe('claude-3-opus-20240229');
  });

  it('ChatRequest requires messages and model', () => {
    const req: ChatRequest = { messages: [{ role: 'user', content: 'test' }], model: 'gpt-4o' };
    expect(req.messages.length).toBe(1);
    expect(req.model).toBe('gpt-4o');
  });

  it('ChatResponse has content and optional finishReason', () => {
    const res: ChatResponse = { content: 'Hello!', finishReason: 'stop' };
    expect(res.content).toBe('Hello!');
    expect(res.finishReason).toBe('stop');
  });

  it('StreamChunk has delta and optional index', () => {
    const chunk: StreamChunk = { delta: 'Hello', index: 0 };
    expect(chunk.delta).toBe('Hello');
    expect(chunk.index).toBe(0);
  });

  it('Provider interface is structurally sound', () => {
    const provider: Provider = {
      name: 'test',
      chat: async () => ({ content: 'ok' }),
      streamChat: async function* () { yield { delta: 'ok', index: 0 }; },
    };
    expect(provider.name).toBe('test');
    expect(typeof provider.chat).toBe('function');
    expect(typeof provider.streamChat).toBe('function');
  });

  it('Provider without streamChat is valid', () => {
    const provider: Provider = {
      name: 'test',
      chat: async () => ({ content: 'ok' }),
    };
    expect(provider.streamChat).toBeUndefined();
  });
});
