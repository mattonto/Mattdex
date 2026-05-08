// --------------------------------------------------------------------------
// Configuration constants for the LLM Orchestrator Worker.
//
// All values are typed and exported as `const` bindings.  No external config
// file is used – this module is the single source of truth for routing,
// fallback, cost/latency scoring, caching TTL, and queue names.
// --------------------------------------------------------------------------

import type { ModelProvider, Role } from './types'; // eslint-disable-line @typescript-eslint/no-unused-vars

// --------------------------------------------------------------------------
// Model → Role routing map
// --------------------------------------------------------------------------

/**
 * Each entry maps a provider+model identifier to the roles it can serve.
 * The first entry in the array is the **primary** model for that role;
 * subsequent entries form the fallback chain.
 */
export const MODEL_ROLE_MAP: Record<string, Role[]> = {
  'openai:gpt-4o':          ['reasoning', 'planning', 'code_generation', 'analysis'],
  'openai:gpt-4o-mini':     ['reasoning', 'code_generation', 'analysis'],
  'anthropic:claude-3-opus': ['reasoning', 'planning', 'analysis'],
  'anthropic:claude-3-sonnet': ['reasoning', 'code_generation', 'analysis'],
  'google:gemini-1.5-pro':  ['reasoning', 'planning', 'analysis'],
  'google:gemini-1.5-flash': ['code_generation', 'analysis'],
  'mistral:mistral-large':  ['reasoning', 'code_generation'],
  'mistral:mistral-small':  ['code_generation'],
  'perplexity:sonar-pro':   ['research', 'analysis'],
  'perplexity:sonar':       ['research'],
} as const;

// --------------------------------------------------------------------------
// Fallback chain per provider
// --------------------------------------------------------------------------

/**
 * Ordered fallback chains keyed by provider name.
 * When the primary model for a provider fails, the worker tries each
 * subsequent entry in the array before giving up.
 */
export const FALLBACK_CHAINS: Record<string, string[]> = {
  openai:    ['openai:gpt-4o', 'openai:gpt-4o-mini'],
  anthropic: ['anthropic:claude-3-opus', 'anthropic:claude-3-sonnet'],
  google:    ['google:gemini-1.5-pro', 'google:gemini-1.5-flash'],
  mistral:   ['mistral:mistral-large', 'mistral:mistral-small'],
  perplexity: ['perplexity:sonar-pro', 'perplexity:sonar'],
} as const;

// --------------------------------------------------------------------------
// Cost & latency weights for scoring
// --------------------------------------------------------------------------

/**
 * Relative weight given to **cost** when scoring candidate models.
 * 0 = ignore cost entirely, 1 = cost is the only factor.
 */
export const COST_WEIGHT = 0.4 as const;

/**
 * Relative weight given to **latency** when scoring candidate models.
 * 0 = ignore latency entirely, 1 = latency is the only factor.
 */
export const LATENCY_WEIGHT = 0.3 as const;

/**
 * Relative weight given to **capability** (role fit) when scoring.
 * 0 = ignore capability, 1 = capability is the only factor.
 *
 * The three weights should sum to 1.0 for a well-calibrated score.
 */
export const CAPABILITY_WEIGHT = 0.3 as const;

// --------------------------------------------------------------------------
// Context caching TTL
// --------------------------------------------------------------------------

/**
 * Time-to-live (in seconds) for cached context entries in KV.
 * After this period the cached response is considered stale and will be
 * re-fetched from the provider.
 */
export const CONTEXT_CACHE_TTL_SECONDS = 300 as const; // 5 minutes

// --------------------------------------------------------------------------
// Queue name
// --------------------------------------------------------------------------

/**
 * Cloudflare Queue name used for asynchronous fallback processing.
 * When a synchronous fallback chain times out, the request is enqueued
 * here for out-of-band completion.
 */
export const FALLBACK_QUEUE_NAME = 'llm-fallback-queue' as const;

// --------------------------------------------------------------------------
// Derived helpers
// --------------------------------------------------------------------------

/** All known model identifiers (e.g. "openai:gpt-4o"). */
export const ALL_MODEL_IDS: readonly string[] = Object.keys(MODEL_ROLE_MAP);

/** All known provider names (e.g. "openai"). */
export const ALL_PROVIDERS: readonly string[] = Object.keys(FALLBACK_CHAINS);

/**
 * Return the fallback chain for a given model ID by extracting its provider
 * prefix.  Returns an empty array when no chain is found.
 */
export function getFallbackChain(modelId: string): readonly string[] {
  const provider = modelId.split(':')[0];
  return FALLBACK_CHAINS[provider] ?? [];
}

/**
 * Return the roles a model can serve.  Returns an empty array when the
 * model ID is unknown.
 */
export function getRolesForModel(modelId: string): readonly Role[] {
  return MODEL_ROLE_MAP[modelId] ?? [];
}
