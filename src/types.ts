// --------------------------------------------------------------------------
// Shared types for the LLM Orchestrator Worker.
// --------------------------------------------------------------------------

/** Supported LLM providers. */
export type ProviderName =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'perplexity';

/** Roles a model can serve. */
export type Role =
  | 'reasoning'
  | 'planning'
  | 'code_generation'
  | 'analysis'
  | 'research';

/** A fully-qualified model identifier (e.g. "openai:gpt-4o"). */
export type ModelId = `${ProviderName}:${string}`;

/** Scoring dimensions used to rank candidate models. */
export interface ModelScore {
  modelId: ModelId;
  costScore: number;      // 0-1, lower is cheaper
  latencyScore: number;   // 0-1, lower is faster
  capabilityScore: number; // 0-1, higher is better fit
  combinedScore: number;  // Weighted sum of the above
}
