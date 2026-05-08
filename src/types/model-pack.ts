/**
 * Role enum categorizes the purpose of a model within the system.
 *
 * - 'chat': General-purpose conversational models (e.g., gpt-4o, claude-3-sonnet)
 * - 'code': Code-specialized models (e.g., claude-3-opus, gpt-4-turbo)
 * - 'reasoning': Reasoning/planning models (e.g., o1, claude-3-opus)
 */
export enum Role {
  Chat = 'chat',
  Code = 'code',
  Reasoning = 'reasoning',
}

/**
 * ModelPack maps each Role to an ordered array of model identifier strings.
 *
 * The array order represents priority: the first model is preferred, and
 * subsequent models serve as fallbacks if the primary is unavailable or
 * rate-limited.
 *
 * @example
 * ```typescript
 * const pack: ModelPack = {
 *   [Role.Chat]: ['gpt-4o', 'claude-3-sonnet-20240229'],
 *   [Role.Code]: ['claude-3-opus-20240229', 'gpt-4-turbo'],
 *   [Role.Reasoning]: ['o1-preview', 'claude-3-opus-20240229'],
 * };
 * ```
 */
export type ModelPack = {
  [K in Role]: string[];
};

/**
 * Returns the primary (first) model for a given role from a ModelPack.
 * Throws if the array is empty.
 */
export function getPrimaryModel(pack: ModelPack, role: Role): string {
  const models = pack[role];
  if (models.length === 0) {
    throw new Error(`No models configured for role: ${role}`);
  }
  return models[0];
}

/**
 * Returns all fallback models (everything after the first) for a given role.
 */
export function getFallbackModels(pack: ModelPack, role: Role): string[] {
  return pack[role].slice(1);
}
