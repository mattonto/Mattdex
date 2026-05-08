import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

// Define the same interface as T1 for consistency
export interface LlmProvider {
  complete(prompt: string, modelId?: string): Promise<string>;
}

// Supported Anthropic models
const ANTHROPIC_MODELS = [
  'claude-2',
  'claude-2.1',
  'claude-instant-1',
  'claude-instant-1.2',
] as const;

type AnthropicModel = typeof ANTHROPIC_MODELS[number];

export class AnthropicProvider implements LlmProvider {
  private readonly apiKey: string;

  constructor(env: { ANTHROPIC_API_KEY: string }) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    this.apiKey = env.ANTHROPIC_API_KEY;
  }

  async complete(prompt: string, modelId?: string): Promise<string> {
    // Default to claude-2 if no model specified
    const model = modelId as AnthropicModel || 'claude-2';

    // Validate model is supported
    if (!ANTHROPIC_MODELS.includes(model)) {
      throw new Error(`Unsupported Anthropic model: ${model}`);
    }

    try {
      const { text } = await generateText({
        model: anthropic(model, { apiKey: this.apiKey }),
        prompt,
        maxTokens: 1024,
      });

      return text;
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }
}
