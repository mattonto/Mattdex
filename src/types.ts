/**
 * Defines shared TypeScript interfaces and types for the LLM Integration Service.
 * These types provide a unified structure for interacting with various LLM providers
 * and managing custom model configurations.
 */

/**
 * Represents the supported LLM providers.
 */
export type LLMProvider = 'openai' | 'anthropic' | 'cloudflare' | 'google';

/**
 * Configuration specific to an LLM provider.
 * Contains sensitive information like API keys and optional provider-specific settings.
 */
export interface ProviderConfig {
  apiKey: string;
  baseURL?: string; // Custom base URL for the API endpoint
  headers?: Record<string, string>; // Custom headers for the API request
  organizationId?: string; // Specific to OpenAI
  accountId?: string; // Specific to Cloudflare
  projectId?: string; // Specific to Google
  // Add other provider-specific configurations as needed
}

/**
 * Represents a single message in a chat conversation.
 * Follows the OpenAI chat message format.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[]; // For assistant messages that call tools
}

/**
 * Represents a tool that the LLM can call.
 * Follows the OpenAI tool definition format.
 */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>; // JSON Schema for function arguments
  };
}

/**
 * Represents a tool call made by the LLM.
 * Follows the OpenAI tool call format.
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string of arguments to the function
  };
}

/**
 * Represents the token usage statistics of an LLM request/response.
 */
export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Defines a "Model Pack" which groups an LLM model with its configuration and roles.
 * This allows for flexible routing and management of different LLM capabilities.
 */
export interface ModelPack {
  id: string;
  name: string;
  description?: string;
  provider: LLMProvider;
  model: string; // The specific model name (e.g., 'gpt-4o', 'claude-3-opus-20240229', '@cf/meta/llama-2-7b-chat-int8')
  config: ProviderConfig; // Provider-specific configuration for this model
  roles: ('chat' | 'embedding' | 'moderation' | 'tool_use')[]; // Roles this model pack is suitable for
  enabled: boolean;
  priority?: number; // Lower number means higher priority for routing decisions
}

/**
 * Standardized input for an LLM request.
 * This DTO is used by clients to interact with the LLM Integration Service.
 */
export interface LLMRequest {
  modelPackId: string; // ID of the ModelPack to use for this request
  messages: ChatMessage[];
  temperature?: number; // Sampling temperature, between 0 and 2. Defaults to 1.
  maxTokens?: number; // The maximum number of tokens to generate in the completion.
  stream?: boolean; // If true, partial message deltas will be sent for streaming responses.
  tools?: Tool[]; // Tools available to the model for function calling
  tool_choice?: 'auto' | 'none' | { type: 'function', function: { name: string } }; // Controls which (if any) tool is called
  stop?: string | string[]; // Up to 4 sequences where the API will stop generating further tokens.
  response_format?: { type: 'text' | 'json_object' }; // Force the model to respond in a specific format.
}

/**
 * Standardized output from an LLM response.
 * This DTO is returned by the LLM Integration Service for non-streaming requests.
 */
export interface LLMResponse {
  id: string;
  model: string; // The actual model that generated the response
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call';
  }>;
  usage: Usage;
  created: number; // Unix timestamp (in seconds) of when the chat completion was created.
}

/**
 * Represents a single chunk in an LLM streaming response.
 * Contains partial message deltas and optional finish reason.
 */
export interface LLMStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>; // Only includes changed parts of the message
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call';
  }>;
  created: number;
}
