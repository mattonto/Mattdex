import { ProviderInterface, ProviderConfig, LLMRequest, LLMResponse, LLMError, LLMErrorCode } from './types';

interface OpenAICompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider implements ProviderInterface {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private fetchFn: typeof fetch;

  constructor(config: ProviderConfig & { fetchFn?: typeof fetch }) {
    if (!config.apiKey) {
      throw new LLMError(LLMErrorCode.AUTHENTICATION_ERROR, 'OpenAI API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.defaultModel = config.defaultModel ?? 'gpt-4o';
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const body: OpenAICompletionRequest = {
      model: request.model ?? this.defaultModel,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: false,
    };

    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new LLMError(
        LLMErrorCode.API_ERROR,
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`,
      );
    }

    const data = (await response.json()) as OpenAICompletionResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new LLMError(LLMErrorCode.EMPTY_RESPONSE, 'OpenAI returned no choices');
    }

    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  async generateStream(request: LLMRequest): Promise<ReadableStream<Uint8Array>> {
    const body: OpenAICompletionRequest = {
      model: request.model ?? this.defaultModel,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: true,
    };

    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new LLMError(
        LLMErrorCode.API_ERROR,
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`,
      );
    }

    if (!response.body) {
      throw new LLMError(LLMErrorCode.EMPTY_RESPONSE, 'OpenAI returned no response body for stream');
    }

    return response.body;
  }
}
