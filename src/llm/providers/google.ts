import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { LLMClient, LLMResponse, LLMProviderError } from '../types';

export class GoogleLLMClient implements LLMClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Google API key is required.');
    }
    this.apiKey = apiKey;
  }

  async generateText(params: {
    prompt: string;
    systemPrompt?: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse> {
    const { prompt, systemPrompt, model, maxTokens, temperature } = params;

    try {
      const googleModel = google(model, {
        apiKey: this.apiKey,
      });

      const result = await generateText({
        model: googleModel,
        system: systemPrompt,
        prompt: prompt,
        maxTokens: maxTokens,
        temperature: temperature,
      });

      return {
        text: result.text,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
        },
        finishReason: result.finishReason,
      };
    } catch (error: unknown) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Error calling Google LLM API',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        model,
        timestamp: new Date().toISOString()
      }));

      // Graceful error handling as per llm-patterns
      if (error instanceof Error) {
        // Specific error handling for common LLM issues
        if (error.message.includes('429') || error.message.includes('rate_limit')) {
          throw new LLMProviderError('Google LLM API rate limit exceeded.', error);
        }
        if (error.message.includes('context_length') || error.message.includes('max_tokens')) {
          throw new LLMProviderError('Google LLM API context length exceeded.', error);
        }
        if (error.message.includes('401') || error.message.includes('authentication')) {
          throw new LLMProviderError('Google LLM API authentication failed. Check API key.', error);
        }
        // Generic API error
        if (error.message.includes('500') || error.message.includes('503') || error.message.includes('overloaded')) {
          throw new LLMProviderError('Google LLM API service unavailable or internal error.', error);
        }
      }
      // Re-throw as a generic LLMProviderError for unhandled cases
      throw new LLMProviderError('Failed to generate text with Google LLM.', error);
    }
  }
}
