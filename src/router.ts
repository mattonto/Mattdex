import { z } from 'zod';

// Define the structure of a model in the config
const ModelSchema = z.object({
  id: z.string(),
  provider: z.enum(['google', 'anthropic', 'openai']),
  role: z.enum(['manager', 'supervisor', 'code', 'task']),
  costTier: z.enum(['budget', 'mid-tier', 'premium']),
});

type Model = z.infer<typeof ModelSchema>;

// Define model pack configuration
const modelPacks: Record<string, Model[]> = {
  code: [
    {
      id: 'claude-sonnet-4-20250514',
      provider: 'anthropic' as const,
      role: 'code' as const,
      costTier: 'premium',
    },
    {
      id: 'gemini-2.5-pro-preview-05-06',
      provider: 'google' as const,
      role: 'code' as const,
      costTier: 'premium',
    },
    {
      id: 'gpt-4o',
      provider: 'openai' as const,
      role: 'code' as const,
      cost游戏副本: 'premium',
    },
  ],
  manager: [
    {
      id: 'gemini-2.0-flash',
      provider: 'google' as const,
      role: 'manager' as const,
      costTier: 'budget',
    },
    {
      id: 'gpt-4o-mini',
      provider: 'openai' as const,
      role: 'manager' as const,
      costTier: 'budget',
    },
  ],
  supervisor: [
    {
      id: 'claude-haiku-3.5',
      provider: 'anthropic' as const,
      role: 'supervisor' as const,
      costTier: 'mid-tier',
    },
    {
      id: 'gemini-2.5-flash-preview-05-20',
      provider: 'google' as const,
      role: 'supervisor' as const,
      costTier: 'mid-tier',
    },
  ],
  task: [
    {
      id: 'claude-sonnet-4-20250514',
      provider: 'anthropic' as const,
      role: 'task' as const,
      costTier: 'premium',
    },
    {
      id: 'gemini-2.5-flash-preview-05-20',
      provider: 'google' as const,
      role: 'task' as const,
      costTier: 'mid-tier',
    },
  ],
};

// Validate model config at startup
Object.values(modelPacks).flat().forEach(model => {
  const result = ModelSchema.safeParse(model);
  if (!result.success) {
    throw new Error(`Invalid model config: ${result.error.toString()}`);
  }
});

/**
 * Route a role to an appropriate provider and model ID
 * @param role The role requesting an LLM
 * @returns Object with provider and model ID
 * @throws Error if no model is available for the role
 */
export function routeModel(role: string): { provider: string; modelId: string } {
  const models = modelPacks[role];

  if (!models || models.length === 0) {
    throw new Error(`No models available for role: ${role}`);
  }

  // Select the first model in the pack (can be extended with cost/latency logic)
  const selectedModel = models[0];
  return {
    provider: selectedModel.provider,
    modelId: selectedModel.id,
  };
}
