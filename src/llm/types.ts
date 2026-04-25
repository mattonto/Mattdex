import { z } from 'zod';

export const ChatCompletionRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type ChatCompletionRole = z.infer<typeof ChatCompletionRoleSchema>;

export const ChatCompletionMessageSchema = z.object({
  role: ChatCompletionRoleSchema,
  content: z.string().min(1, 'Content cannot be empty'),
});
export type ChatCompletionMessage = z.infer<typeof ChatCompletionMessageSchema>;

export const LLMRequestSchema = z.object({
  model: z.string().min(1, 'Model is required'),
  messages: z.array(ChatCompletionMessageSchema).min(1, 'Messages array cannot be empty'),
  temperature: z.number().min(0).max(2).default(0.7).optional(),
  max_tokens: z.number().int().min(1).optional(),
  top_p: z.number().min(0).max(1).default(1).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  stream: z.boolean().default(false).optional(),
});
export type LLMRequest = z.infer<typeof LLMRequestSchema>;

export const LLMResponseChoiceSchema = z.object({
  index: z.number().int().min(0),
  message: ChatCompletionMessageSchema,
  finish_reason: z.string(),
});
export type LLMResponseChoice = z.infer<typeof LLMResponseChoiceSchema>;

export const LLMResponseUsageSchema = z.object({
  prompt_tokens: z.number().int().min(0),
  completion_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
});
export type LLMResponseUsage = z.infer<typeof LLMResponseUsageSchema>;

export const LLMResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number().int(),
  model: z.string(),
  choices: z.array(LLMResponseChoiceSchema),
  usage: LLMResponseUsageSchema,
});
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
