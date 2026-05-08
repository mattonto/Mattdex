import { z } from 'zod';

// Define known models per provider to validate against
const KNOWN_MODELS = {
  'gpt-4': true,
  'gpt-3.5-turbo': true,
  'claude-instant-1': true,
  'claude-2': true,
  'llama-2-70b': true,
} as const;

type ModelName = keyof typeof KNOWN_MODELS;

type Role = 'code' | 'chat' | 'summarize' | 'translate';

type ModelPack = {
  [K in Role]?: ModelName[];
};

// Schema for runtime validation using Zod
const ModelPackSchema: z.Schema<ModelPack> = z.object({
  code: z.array(z.enum(Object.keys(KNOWN_MODELS) as [ModelName])).optional(),
  chat: z.array(z.enum(Object.keys(KNOWN_MODELS) as [ModelName])).optional(),
  summarize: z.array(z.enum(Object.keys(KNOWN_MODELS) as [ModelName])).optional(),
  translate: z.array(z.enum(Object.keys(KNOWN_MODELS) as [ModelName])).optional(),
}).strict();

// In-memory configuration object
const MODEL_PACKS = {
  default: {
    code: ['gpt-4', 'claude-instant-1'] as ModelName[],
    chat: ['gpt-3.5-turbo', 'llama-2-70b'] as ModelName[],
  },
  fast: {
    chat: ['gpt-3.5-turbo'],
  },
  cheap: {
    code: ['claude-instant-1'],
    chat: ['llama-2-70b'],
  },
};

// Validate model names at load time
Object.entries(MODEL_PACKS).forEach(([packName, pack]) => {
  try {
    ModelPackSchema.parse(pack);
  } catch (err) {
    throw new Error(`Invalid model pack '\${packName}': \${(err as Error).message}`);
  }
});

export { MODEL_PACKS, ModelPack, ModelName, Role };
