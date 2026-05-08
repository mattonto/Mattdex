import type { z } from 'zod';

/**
 * ProviderInterface defines the contract for any LLM provider integration.
 * All providers (OpenAI, Anthropic, etc.) must implement this interface.
 */
export interface ProviderInterface {
  /**
   * Sends a prompt to the provider and returns the completion text.
   * @param prompt - The input prompt string
   * @returns The completion response as a string
   */
  complete(prompt: string): Promise<string>;

  /**
   * Human-readable name of the provider (e.g., 'openai', 'anthropic').
   */
  name: string;

  /**
   * The model identifier used for completions (e.g., 'gpt-4o', 'claude-3-opus-20240229').
   */
  model: string;

  /**
   * Average latency in milliseconds for recent completions.
   * Updated after each call to complete().
   */
  latencyMs: number;

  /**
   * Cost per token in fractional cents (e.g., 0.00015 for $0.15/1M tokens).
   * Used for cost tracking and budgeting.
   */
  costPerToken: number;

  /**
   * Total tokens consumed across all calls to this provider instance.
   */
  totalTokens: number;

  /**
   * Timestamp (epoch ms) of the most recent completion call.
   * 0 if no calls have been made yet.
   */
  lastCallAt: number;
}

/**
 * Zod schema for validating provider configuration objects.
 */
export const ProviderConfigSchema = z.object({
  name: z.string().min(1, 'Provider name is required'),
  model: z.string().min(1, 'Model identifier is required'),
  costPerToken: z.number().nonnegative('Cost per token must be non-negative'),
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url('Base URL must be a valid URL').optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
