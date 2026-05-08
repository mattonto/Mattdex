export interface ProviderInterface {
  /**
   * Completes the given prompt and returns the generated text.
   * @param prompt - The input prompt to complete.
   * @returns A promise that resolves to the generated string.
   */
  complete(prompt: string): Promise<string>;

  /**
   * The latency in milliseconds for the last request made by this provider.
   */
  latencyMs: number;

  /**
   * The cost per token in USD for this provider.
   * This should be a positive number representing cost per million tokens.
   */
  costPerToken: number;
}