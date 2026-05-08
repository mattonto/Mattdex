import { ProviderInterface, LLMProviderRequest, LLMProviderResponse } from '@autoengineering/shared';
import { OpenAIProvider } from '../../providers/openai';

// ---- Mocks (must precede worker import) ----
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => ({})),
}));
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// Log capture — hoisting-safe pattern
const emitLogCapture: Array<Record<string, unknown>> = [];
vi.mock('@autoengineering/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@autoengineering/shared');
  return {
    ...actual,
    emitLog: (e: Record<string, unknown>) => { emitLogCapture.push(e); },
  };
});

const mockGenerateText = vi.mocked(await import('ai')).generateText;

const makeValidRequest = (): LLMProviderRequest => ({
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  prompt: 'Hello, world!',
  maxTokens: 100,
});

const env = { OPENAI_API_KEY: 'sk-test-key' };
const modelMapping = { 'gpt-4o-mini': 'gpt-4o-mini-2024-07-18' };

describe.skipIf(!env.OPENAI_API_KEY)('OpenAIProvider (runtime)', () => {
  let provider: ProviderInterface;

  beforeEach(() => {
    emitLogCapture.length = 0;
    vi.clearAllMocks();
    provider = new OpenAIProvider(env, modelMapping);
  });

  it('should generate text using mapped model and return response with usage', async () => {
    const request = makeValidRequest();
    mockGenerateText.mockResolvedValueOnce({
      text: 'Hi there!',
      usage: { promptTokens: 10, completionTokens: 15 },
    });

    const result = await provider.generate(request);

    expect(mockGenerateText).toHaveBeenCalledWith({
      model: expect.any(Object),
      system: request.systemPrompt,
      prompt: request.prompt,
      maxTokens: request.maxTokens,
    });
    expect(result).toEqual({
      text: 'Hi there!',
      usage: { promptTokens: 10, completionTokens: 15 },
      model: 'gpt-4o-mini-2024-07-18',
    });
  });

  it('should throw error when model mapping is missing', async () => {
    const request = { ...makeValidRequest(), model: 'unknown-model' };
    await expect(provider.generate(request)).rejects.toThrow('Model mapping not found');
  });

  it('should handle rate limit error from OpenAI', async () => {
    const request = makeValidRequest();
    mockGenerateText.mockRejectedValueOnce(new Error('429 Too Many Requests'));

    await expect(provider.generate(request)).rejects.toThrow('Rate limit exceeded');
  });

  it('should handle context length error from OpenAI', async () => {
    const request = makeValidRequest();
    mockGenerateText.mockRejectedValueOnce(new Error('context_length exceeds max_tokens'));

    await expect(provider.generate(request)).rejects.toThrow('Request context too long');
  });

  it('should handle provider unavailable error', async () => {
    const request = makeValidRequest();
    mockGenerateText.mockRejectedValueOnce(new Error('503 Service Unavailable'));

    await expect(provider.generate(request)).rejects.toThrow('Provider temporarily unavailable');
  });
});
