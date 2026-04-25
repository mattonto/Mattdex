export interface LLMClient {
  provider: string;
  getProviderName(): string;
}

export class OpenAIClient implements LLMClient {
  public readonly provider = 'openai';
  constructor(apiKey: string) {
    if (!apiKey) throw new Error('OpenAI API key is required');
    // In a real scenario, initialize OpenAI SDK here, e.g., new OpenAI({ apiKey });
  }
  getProviderName(): string {
    return this.provider;
  }
}

export class AnthropicClient implements LLMClient {
  public readonly provider = 'anthropic';
  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Anthropic API key is required');
    // In a real scenario, initialize Anthropic SDK here, e.g., new Anthropic({ apiKey });
  }
  getProviderName(): string {
    return this.provider;
  }
}

export class GoogleClient implements LLMClient {
  public readonly provider = 'google';
  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Google API key is required');
    // In a real scenario, initialize GoogleGenerativeAI SDK here, e.g., new GoogleGenerativeAI(apiKey);
  }
  getProviderName(): string {
    return this.provider;
  }
}
