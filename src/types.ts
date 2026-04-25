import { z } from 'zod';

export const LLMProviderSchema = z.enum(['openai', 'anthropic', 'google']);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

export const ModelPackSchema = z.object({
  id: z.string(),
  provider: LLMProviderSchema,
  modelName: z.string(),
  apiKeyEnvVar: z.string(), // e.g., 'OPENAI_API_KEY'
  maxTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(1),
});
export type ModelPack = z.infer<typeof ModelPackSchema>;

export const LLMRequestSchema = z.object({
  modelPackId: z.string(),
  role: z.string(), // e.g., 'code-generation', 'classification'
  prompt: z.string(),
  systemPrompt: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
});
export type LLMRequest = z.infer<typeof LLMRequestSchema>;

export interface LLMResponse {
  text: string;
  usage: { promptTokens: number; completionTokens: number };
  finishReason: string;
}

export interface Env {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  // Add other environment variables as needed
}
