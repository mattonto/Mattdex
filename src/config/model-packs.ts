import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A named model pack maps a role (e.g. 'code', 'reasoning', 'chat') to an
 * ordered list of model identifiers.  The first entry is the primary model;
 * subsequent entries are fallbacks used when the primary is unavailable or
 * when load-balancing across providers.
 */
export type ModelPack = Record<string, string[]>;

// ---------------------------------------------------------------------------
// Zod schema (runtime validation for config loaded from external sources)
// ---------------------------------------------------------------------------

const modelIdRegex = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

const modelPackSchema: z.ZodType<ModelPack> = z.record(
  z
    .string()
    .min(1, 'Role name must be at least 1 character')
    .max(64, 'Role name must be at most 64 characters'),
  z
    .array(
      z
        .string()
        .min(1, 'Model ID must be at least 1 character')
        .max(64, 'Model ID must be at most 64 characters')
        .regex(modelIdRegex, 'Model ID must start with a letter and contain only letters, digits, hyphens, or underscores'),
    )
    .min(1, 'Each role must have at least one model ID'),
);

/**
 * Parse and validate an unknown value as a {@link ModelPack}.
 * Throws a {@link z.ZodError} on failure.
 */
export function parseModelPack(raw: unknown): ModelPack {
  return modelPackSchema.parse(raw);
}

/**
 * Safely parse an unknown value as a {@link ModelPack}.
 * Returns `null` on failure instead of throwing.
 */
export function safeParseModelPack(raw: unknown): ModelPack | null {
  const result = modelPackSchema.safeParse(raw);
  return result.success ? result.data : null;
}

// ---------------------------------------------------------------------------
// In-memory default packs
// ---------------------------------------------------------------------------

/**
 * Default model pack used for code generation tasks.
 *
 * - `code`: primary model for code generation; fallbacks for resilience.
 * - `reasoning`: slower, more deliberate model for planning / analysis.
 * - `chat`: lightweight model for conversational / classification tasks.
 * - `review`: model used for code review and verification.
 */
export const defaultModelPack: ModelPack = {
  code: ['gpt-4', 'claude-instant-1'],
  reasoning: ['gpt-4', 'claude-2'],
  chat: ['gpt-3.5-turbo', 'claude-instant-1'],
  review: ['gpt-4', 'claude-2'],
} satisfies ModelPack;

/**
 * A minimal pack suitable for testing or low-cost environments.
 */
export const minimalModelPack: ModelPack = {
  code: ['gpt-3.5-turbo'],
  reasoning: ['gpt-3.5-turbo'],
  chat: ['gpt-3.5-turbo'],
  review: ['gpt-3.5-turbo'],
} satisfies ModelPack;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Return the primary (first) model ID for a given role.
 * Returns `undefined` when the role does not exist in the pack.
 */
export function getPrimaryModel(pack: ModelPack, role: string): string | undefined {
  const models = pack[role];
  return models?.[0];
}

/**
 * Return all model IDs for a given role.
 * Returns an empty array when the role does not exist.
 */
export function getModelsForRole(pack: ModelPack, role: string): string[] {
  return pack[role] ?? [];
}

/**
 * Return all role names defined in the pack.
 */
export function getRoles(pack: ModelPack): string[] {
  return Object.keys(pack);
}

/**
 * Check whether a given role exists in the pack.
 */
export function hasRole(pack: ModelPack, role: string): boolean {
  return role in pack;
}
