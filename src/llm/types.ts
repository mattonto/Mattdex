export type LLMFinishReason = 'stop' | 'length' | 'content_filter' | 'other';

export interface LLMRequest {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  apiKeyEnvVar: string; // Name of the environment variable holding the API key
}

export interface LLMResponse {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: LLMFinishReason;
}

export interface LLMProvider {
  generate(request: LLMRequest, env: Env): Promise<LLMResponse>;
}

// This Env interface should ideally be defined in a shared location
// like packages/shared/types/env.d.ts or similar, and extended by workers.
export interface Env {
  ANTHROPIC_API_KEY?: string;
  // Add other API keys here as needed by other providers, e.g.:
  // OPENAI_API_KEY?: string;
  // GOOGLE_GENERATIVE_AI_API_KEY?: string;
}
