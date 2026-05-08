import { generateText } from 'ai';
import { google, anthropic, openai } from '@ai-sdk/provider';

// Define the provider models to use
const providers = [
  {
    name: 'google',
    model: google('gemini-2.5-flash-preview-05-20'),
  },
  {
    name: 'anthropic',
    model: anthropic('claude-haiku-3.5'),
  },
  {
    name: 'openai',
    model: openai('gpt-4o-mini'),
  },
];

/**
 * Fan-out strategy that invokes multiple LLM providers concurrently
 * and returns the fastest response within a 55s timeout.
 * Pending requests are canceled once the first one resolves.
 */
export async function fanOutStrategy(prompt: string, system?: string) {
  const controller = new AbortController();
  const timeoutMs = 55_000;

  // Set up timeout to enforce 55s limit
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    // Create a race across all provider calls
    const result = await Promise.race(
      providers.map(async ({ name, model }) => {
        try {
          const { text, usage } = await generateText({
            model,
            prompt,
            system,
            maxTokens: 1024,
            abortSignal: controller.signal,
          });

          return {
            provider: name,
            response: text,
            usage,
            error: null,
          };
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            throw error; // Re-throw abort to avoid winning the race
          }
          return {
            provider: name,
            response: null,
            usage: null,
            error: (error as Error).message,
          };
        }
      })
    );

    // Cancel remaining requests by aborting the controller
    controller.abort();

    // Clear timeout to prevent unnecessary abort
    clearTimeout(timeoutId);

    return result;
  } catch (error) {
    // Ensure timeout is cleared on error
    clearTimeout(timeoutId);

    // If error is due to abort, return timeout result
    if ((error as Error).name === 'AbortError') {
      return {
        provider: null,
        response: null,
        usage: null,
        error: 'Request timed out after 55s',
      };
    }

    // Re-throw unexpected errors
    throw error;
  }
}