import { ProviderInterface, LLMProviderRequest, LLMProviderResponse } from '@autoengineering/shared';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * OpenAIProvider implements the ProviderInterface using OpenAI models via the Vercel AI SDK.
 * It uses environment binding OPENAI_API_KEY automatically.
 */
export class OpenAIProvider implements ProviderInterface {
  private readonly modelMapping: Record<string, string>;

  constructor(env: { OPENAI_API_KEY: string }, modelMapping: Record<string, string>) {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
    this.modelMapping = modelMapping;
  }

  async generate(request: LLMProviderRequest): Promise<LLMProviderResponse> {
    const modelId = this.modelMapping[request.model];
    if (!modelId) {
      throw new Error(`Model mapping not found for: ${request.model}`);
    }

    const model = openai(modelId);

    try {
      const result = await generateText({
        model,
        system: request.systemPrompt,
        prompt: request.prompt,
        maxTokens: request.maxTokens,
      });

      return {
        text: result.text,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
        },
        model: modelId,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.message.includes('429')) {
        return new Error('Rate limit exceeded');
      }
      if (error.message.includes('context_length') || error.message.includes('max_tokens')) {
        return new Error('Request context too long');
      }
      if (error.message.includes('503') || error.message.includes('overloaded')) {
        return new Error('Provider temporarily unavailable');
      }
    }
    return error instanceof Error ? error : new Error('Unknown error');
  }
}
