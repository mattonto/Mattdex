import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { ModelPack, Env } from '../types';
import { LanguageModel } from 'ai';

export class LLMProviderFactory {
  public static create(modelPack: ModelPack, env: Env): LanguageModel {
    const apiKey = env[modelPack.apiKeyEnvVar as keyof Env];

    if (!apiKey) {
      throw new Error(`API key for ${modelPack.provider} (${modelPack.apiKeyEnvVar}) is not set in environment.`);
    }

    switch (modelPack.provider) {
      case 'openai':
        return openai(modelPack.modelName, { apiKey });
      case 'anthropic':
        return anthropic(modelPack.modelName, { apiKey });
      case 'google':
        return google(modelPack.modelName, { apiKey });
      default:
        // This case should ideally not be reached if ModelPackSchema is strictly enforced
        throw new Error(`Unsupported LLM provider: ${modelPack.provider}`);
    }
  }
}
