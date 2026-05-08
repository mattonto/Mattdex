// Normalized response from any LLM provider
// All providers must map their native response to this shape
export interface NormalizedResponse {
  content: string;
  finish_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Canonical task shape passed to every provider adapter
export interface Task {
  role: string;
  prompt: string;
  model?: string;
  contextId?: string;
  rateLimitRetry?: number;
}

// Every provider must implement this interface.
// The function signature is intentionally a single method so it can be
// used as a service-binding RPC or a direct function call.
export interface ProviderAdapter {
  (task: Task): Promise<NormalizedResponse>;
}
