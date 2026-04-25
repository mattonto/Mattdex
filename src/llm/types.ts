import { GenerateTextFinishReason } from 'ai';

export interface LLMResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  finishReason: GenerateTextFinishReason;
}

export interface LLMClient {
  generateText(params: {
    prompt: string;
    systemPrompt?: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse>;
}

export class LLMProviderError extends Error {
  public originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'LLMProviderError';
    this.originalError = originalError;
  }
}
