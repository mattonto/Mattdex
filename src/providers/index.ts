import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

// Initialize providers with API keys from environment
// Note: These will be injected at runtime via env bindings
const openai = createOpenAI({
  apiKey: 'process.env.OPENAI_API_KEY', // Will be replaced by env.OPENAI_API_KEY
});

const anthropic = createAnthropic({
  apiKey: 'process.env.ANTHROPIC_API_KEY', // Will be replaced by env.ANTHROPIC_API_KEY
});

// Export providers for tree-shaking
export const providers = {
  openai,
  anthropic,
} as const;

// Type-safe provider names
export type ProviderName = keyof typeof providers;

// Runtime selection function
export const getProvider = (name: ProviderName) => {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Provider not found: ${name}`);
  }
  return provider;
};
