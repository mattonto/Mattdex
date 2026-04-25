import { LLM, generateObject, generateText } from 'ai';
import { OpenAI } from 'ai/openai';
import { Anthropic } from 'ai/anthropic';
import { z } from 'zod';
import { Env } from '../types';

export class LLMRouterService {
  private env: Env;
  private models: Record<string, LLM>;

  constructor(env: Env) {
    this.env = env;
    this.models = this.initializeModels(env);
  }

  private initializeModels(env: Env): Record<string, LLM> {
    const models: Record<string, LLM> = {};

    if (env.OPENAI_API_KEY) {
      models['openai-gpt-4'] = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      models['openai-gpt-3.5-turbo'] = new OpenAI({ apiKey: env.OPENAI_API_KEY, model: 'gpt-3.5-turbo' });
    }
    if (env.ANTHROPIC_API_KEY) {
      models['anthropic-claude-3-opus'] = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, model: 'claude-3-opus-20240229' });
      models['anthropic-claude-3-sonnet'] = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, model: 'claude-3-sonnet-20240229' });
    }
    // Add more models as needed based on configuration or future requirements

    return models;
  }

  public async routeAndInvoke<T extends z.ZodTypeAny>(
    modelName: string,
    prompt: string,
    schema?: T,
    options?: { maxTokens?: number }
  ): Promise<z.infer<T> | string | { error: string; status: number }> {
    const model = this.models[modelName];
    if (!model) {
      // This is a known error, not an unrecoverable LLM invocation error
      return { error: `Model '${modelName}' not found`, status: 404 };
    }

    try {
      if (schema) {
        const result = await generateObject({
          model,
          schema,
          prompt,
          maxTokens: options?.maxTokens,
        });
        return result.object;
      } else {
        const result = await generateText({
          model,
          prompt,
          maxTokens: options?.maxTokens,
        });
        return result.text;
      }
    } catch (error: unknown) {
      // AC: Unrecoverable errors are logged
      console.error(`LLM invocation failed for model '${modelName}':`, error);

      // AC: Error messages are masked for sensitive info
      // AC: LLM provider errors result in 500 response
      return { error: 'Internal Server Error: LLM invocation failed.', status: 500 };
    }
  }
}
