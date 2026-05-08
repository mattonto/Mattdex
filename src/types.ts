// Shared types for the Worker configuration module.
// These types are consumed by src/config.ts and any code that reads config.

// ---------------------------------------------------------------------------
// Model provider identifiers
// ---------------------------------------------------------------------------
export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'deepseek';

// ---------------------------------------------------------------------------
// Model role identifiers
// ---------------------------------------------------------------------------
export type ModelRole =
  | 'primary_generation'
  | 'fast_generation'
  | 'reasoning'
  | 'classification';

// ---------------------------------------------------------------------------
// Fallback chain per provider
// ---------------------------------------------------------------------------
export interface ProviderFallbackChain {
  readonly provider: ModelProvider;
  /** Ordered list of model IDs — first is primary, rest are fallbacks. */
  readonly fallbacks: readonly string[];
}

// ---------------------------------------------------------------------------
// Scoring weights for model selection
// ---------------------------------------------------------------------------
export interface ScoringWeights {
  /** Weight for per-token cost (0–1). */
  readonly cost: number;
  /** Weight for response latency (0–1). */
  readonly latency: number;
  /** Weight for output quality score (0–1). */
  readonly quality: number;
  /** Weight for provider availability (0–1). */
  readonly availability: number;
}

// ---------------------------------------------------------------------------
// Queue configuration
// ---------------------------------------------------------------------------
export interface QueueConfig {
  /** Name of the Cloudflare Queue. */
  readonly queueName: string;
  /** Maximum number of retry attempts. */
  readonly maxRetries: number;
  /** Delay in seconds between retries. */
  readonly retryDelaySeconds: number;
}

// ---------------------------------------------------------------------------
// Context cache configuration
// ---------------------------------------------------------------------------
export interface ContextCacheConfig {
  /** TTL in seconds for cached context entries. */
  readonly ttlSeconds: number;
}
