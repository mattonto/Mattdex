export interface NormalizedResponse {
  content: string;
  finish_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface Task {
  role: string;
  prompt: string;
  model?: string;
  contextId?: string;
  rateLimitRetry?: number;
}

export interface ProviderAdapter {
  (task: Task): Promise<NormalizedResponse>;
}
