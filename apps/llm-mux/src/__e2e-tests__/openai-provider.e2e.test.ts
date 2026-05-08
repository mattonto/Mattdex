import { ProviderInterface, LLMProviderRequest } from '@autoengineering/shared';
import { OpenAIProvider } from '../../providers/openai';

// ---- Mocks ----
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => ({})),
}));
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

const emitLogCapture: Array<Record<string, unknown>> = [];
vi.mock('@autoengineering/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@autoengineering/shared');
  return {
    ...actual,
    emitLog: (e: Record<string, unknown>) => { emitLogCapture.push(e); },
  };
});

const mockGenerateText = vi.mocked(await import('ai')).generateText;

const env = { OPENAI_API_KEY: 'sk-test-key' };
const modelMapping = { 'gpt-4o-mini': 'gpt-4o-mini-2024-07-18' };

const makeValidRequest = (): LLMProviderRequest => ({
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  prompt: 'Hello, world!',
  maxTokens: 100,
});

describe.skipIf(!env.OPENAI_API_KEY)('OpenAIProvider (E2E)', () => {
  let provider: ProviderInterface;

  beforeEach(() => {
    emitLogCapture.length = 0;
    vi.clearAllMocks();
    provider = new OpenAIProvider(env, modelMapping);
  });

  it('should retry transient errors and eventually succeed', async () => {
    const request = makeValidRequest();

    // First call fails with 503
    mockGenerateText.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    // Second call fails with rate limit
    mockGenerateText.mockRejectedValueOnce(new Error('429 Too Many Requests'));
    // Third call succeeds
    mockGenerateText.mockResolvedValueOnce({
      text: 'Recovered response',
      usage: { promptTokens: 12, completionTokens: 18 },
    });

    const result = await provider.generate(request);

    expect(mockGenerateText).toHaveBeenCalledTimes(3);
    expect(result.text).toBe('Recovered response');
    expect(result.usage.promptTokens).toBe(12);
    expect(result.usage.completionTokens).toBe(18);
  });

  it('should isolate errors across concurrent requests for different models', async () => {
    const req1 = makeValidRequest();
    const req2 = { ...makeValidRequest(), model: 'gpt-4o' };

    // Simulate missing mapping for gpt-4o
    const failingProvider = new OpenAIProvider(env, { 'gpt-4o-mini': 'gpt-4o-mini-2024-07-18' });

    mockGenerateText.mockResolvedValueOnce({
      text: 'Success for gpt-4o-mini',
      usage: { promptTokens: 10, completionTokens: 15 },
    });

    const promise1 = provider.generate(req1);
    const promise2 = failingProvider.generate(req2);

    const [result1, error2] = await Promise.allSettled([promise1, promise2]);

    expect(result1.status).toBe('fulfilled');
    if (result1.status === 'fulfilled') {
      expect(result1.value.text).toBe('Success for gpt-4o-mini');
    }
    expect(error2.status).toBe('rejected');
    await expect(Promise.reject(error2.reason)).rejects.toThrow('Model mapping not found');
  });
});
