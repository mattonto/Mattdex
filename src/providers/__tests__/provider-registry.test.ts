import { describe, it, expect } from 'vitest';
import { getProvider, listProviders, type ProviderConfig } from '../index';

describe('provider registry', () => {
  describe('getProvider', () => {
    it('returns OpenAI provider when name is "openai"', () => {
      const config: ProviderConfig = { name: 'openai', apiKey: 'sk-test-123' };
      const provider = getProvider(config);
      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai');
      expect(typeof provider.chat).toBe('function');
    });

    it('returns Anthropic provider when name is "anthropic"', () => {
      const config: ProviderConfig = { name: 'anthropic', apiKey: 'sk-ant-test-123' };
      const provider = getProvider(config);
      expect(provider).toBeDefined();
      expect(provider.name).toBe('anthropic');
      expect(typeof provider.chat).toBe('function');
    });

    it('throws for unsupported provider name', () => {
      const config: ProviderConfig = { name: 'ollama', apiKey: 'test' };
      expect(() => getProvider(config)).toThrow('Unsupported provider: ollama');
    });

    it('throws when name is empty string', () => {
      const config: ProviderConfig = { name: '', apiKey: 'test' };
      expect(() => getProvider(config)).toThrow('Unsupported provider: ');
    });

    it('throws when name is missing from config', () => {
      const config = { apiKey: 'test' } as ProviderConfig;
      expect(() => getProvider(config)).toThrow('Unsupported provider: undefined');
    });
  });

  describe('listProviders', () => {
    it('returns both openai and anthropic', () => {
      const names = listProviders();
      expect(names).toContain('openai');
      expect(names).toContain('anthropic');
      expect(names.length).toBe(2);
    });

    it('returns a frozen array', () => {
      const names = listProviders();
      expect(Object.isFrozen(names)).toBe(true);
    });
  });

  describe('provider interface contract', () => {
    it('each provider has name, chat, and optional streamChat', () => {
      for (const name of listProviders()) {
        const provider = getProvider({ name, apiKey: 'test-key' });
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('chat');
        expect(typeof provider.name).toBe('string');
        expect(typeof provider.chat).toBe('function');
        if (provider.streamChat !== undefined) {
          expect(typeof provider.streamChat).toBe('function');
        }
      }
    });
  });
});
