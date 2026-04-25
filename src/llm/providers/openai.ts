import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { LLMResponse, Env } from '../../types';

export class OpenAIClient {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    if (!this.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in the environment.');
    }
  }

  async callLLM(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    try {
      // The openai() function from @ai-sdk/openai can take an `apiKey` option.
      // Explicitly passing it ensures compatibility with Cloudflare Workers' `env` object.
      const model = openai(modelId, {
        apiKey: this.env.OPENAI_API_KEY
      });

      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature,
        maxTokens
      });

      return {
        text: result.text,
        usage: result.usage,
        finishReason: result.finishReason
      };
    } catch (error: unknown) {
      console.error('OpenAI API error:', error);
      if (error instanceof Error) {
        // Specific error handling as per llm-patterns
        if (error.message.includes('429') || error.message.includes('rate_limit')) {
          throw new Error('OpenAI API rate limit exceeded.');
        }
        if (error.message.includes('context_length') || error.message.includes('max_tokens')) {
          throw new Error('OpenAI API context length exceeded.');
        }
        // Generic API error
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('An unknown error occurred during OpenAI API call.');
    }
  }
}
