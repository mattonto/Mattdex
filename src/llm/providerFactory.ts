import { LLMClient, OpenAIClient, AnthropicClient, GoogleClient } from './llmClient';

interface Env {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  // Add other environment variables as needed for the worker
}

export class LLMProviderFactory {
  public static getProvider(providerId: string, env: Env): LLMClient {
    switch (providerId) {
      case 'openai': {
        if (!env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is not set in environment');
        }
        return new OpenAIClient(env.OPENAI_API_KEY);
      }
      case 'anthropic': {
        if (!env.ANTHROPIC_API_KEY) {
          throw new Error('ANTHROPIC_API_KEY is not set in environment');
        }
        return new AnthropicClient(env.ANTHROPIC_API_KEY);
      }
      case 'google': {
        if (!env.GOOGLE_API_KEY) {
          throw new Error('GOOGLE_API_KEY is not set in environment');
        }
        return new GoogleClient(env.GOOGLE_API_KEY);
      }
      default:
        throw new Error(`Unknown LLM provider ID: ${providerId}`);
    }
  }
}
