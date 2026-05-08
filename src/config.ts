// Configuration constants for the Worker
// All values are typed constants — no external config file needed.

import type { ModelProvider, ModelRole, ProviderFallbackChain, ScoringWeights, ContextCacheConfig, QueueConfig } from './types';

// ---------------------------------------------------------------------------
// Model → Role routing map
// ---------------------------------------------------------------------------
// Maps each model ID to its primary role in the system.
// A model may serve multiple roles; the first match wins at routing time.

export const MODEL_ROLE_MAP: Readonly<Record<string, ModelRole>> = {
  'gpt-4o':               'primary_generation',
  'gpt-4o-mini':          'fast_generation',
  'claude-sonnet-4-20250514': 'primary_generation',
  'claude-haiku-3-5-sonnet-20241022': 'fast_generation',
  'gemini-2.0-flash':     'fast_generation',
  'gemini-2.5-pro':       'primary_generation',
  'o1':                   'reasoning',
  'o3-mini':              'reasoning',
  'deepseek-chat':        'classification',
  'deepseek-reasoner':    'reasoning',
} as const;

// ---------------------------------------------------------------------------
// Fallback chain per provider
// ---------------------------------------------------------------------------
// Ordered list of model IDs to try when the primary model fails or is
// rate-limited.  The first entry is the primary; subsequent entries are
// fallbacks in priority order.

export const PROVIDER_FALLBACK_CHAINS: Readonly<Record<ModelProvider, ProviderFallbackChain>> = {
  openai: {
    provider: 'openai',
    fallbacks: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
  },
  anthropic: {
    provider: 'anthropic',
    fallbacks: ['claude-sonnet-4-20250514', 'claude-haiku-3-5-sonnet-20241022'],
  },
  google: {
    provider: 'google',
    fallbacks: ['gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  deepseek: {
    provider: 'deepseek',
    fallbacks: ['deepseek-reasoner', 'deepseek-chat'],
  },
} as const;

// ---------------------------------------------------------------------------
// Cost & latency weights for scoring
// ---------------------------------------------------------------------------
// Used by the model router to compute a composite score for each candidate
// model.  Higher weight = more influence on the final score.

export const SCORING_WEIGHTS: Readonly<ScoringWeights> = {
  cost:       0.35,
  latency:    0.25,
  quality:    0.30,
  availability: 0.10,
} as const;

// ---------------------------------------------------------------------------
// Context caching TTL (seconds)
// ---------------------------------------------------------------------------
// How long a cached context entry lives before being evicted.
// Set to 300 seconds (5 minutes) as a reasonable default for LLM context
// windows that may span multiple turns.

export const CONTEXT_CACHE_TTL_SECONDS: number = 300;

// ---------------------------------------------------------------------------
// Queue name
// ---------------------------------------------------------------------------
// Name of the Cloudflare Queue used for async code-generation tasks.

export const QUEUE_CONFIG: Readonly<QueueConfig> = {
  queueName: 'code-gen-tasks',
  maxRetries: 3,
  retryDelaySeconds: 10,
} as const;
