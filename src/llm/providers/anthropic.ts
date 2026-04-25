import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { LLMRequest, LLMResponse, Env, LLMFinishReason } from '../types';

export class AnthropicLLMClient {
  async generate(request: LLMRequest, env: Env): Promise<LLMResponse> {
    const { model, prompt, system, temperature, maxTokens, apiKeyEnvVar } = request;

    const apiKey = env[apiKeyEnvVar as keyof Env];
    if (!apiKey) {
      throw new Error(`Anthropic API key not found in environment variable: ${apiKeyEnvVar}`);
    }

    try {
      const result = await generateText({
        model: anthropic(model, { apiKey }),
        system: system,
        prompt: prompt,
        temperature: temperature,
        maxTokens: maxTokens,
      });

      const finishReason: LLMFinishReason = result.finishReason === 'stop' ? 'stop' :
                                            result.finishReason === 'length' ? 'length' :
                                            result.finishReason === 'content_filter' ? 'content_filter' :
                                            'other';

      return {
        text: result.text,
        model: model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        finishReason: finishReason,
      };
    } catch (error) {
      console.error('Anthropic API error:', error);
      // Re-throw a more generic error or specific custom errors for upstream handling
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('rate_limit')) {
          throw new Error('Anthropic API rate limit exceeded.');
        }
        if (error.message.includes('context_length') || error.message.includes('max_tokens')) {
          throw new Error('Anthropic API context length exceeded.');
        }
        // Generic API error
        throw new Error(`Anthropic API error: ${error.message}`);
      }
      throw new Error('An unknown error occurred with the Anthropic API.');
    }
  }
}
