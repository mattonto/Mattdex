import { vi } from 'vitest';
import { Context } from 'hono';
import { requireApiKey } from '../../middleware/auth';

// Mock the environment with VALID_API_KEYS
const mockEnv = {
  VALID_API_KEYS: {
    get: vi.fn(),
  },
};

// Helper to create a mock context
const createMockContext = (headers: Record<string, string> = {}) => {
  return {
    req: {
      header: vi.fn((name: string) => headers[name.toLowerCase()]),
    },
    json: vi.fn(),
    env: mockEnv,
  } as unknown as Context;
};

describe('requireApiKey middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without X-API-Key header', async () => {
    const c = createMockContext();
    const next = vi.fn();

    await requireApiKey(c, next);

    expect(c.json).toHaveBeenCalledWith({ error: 'Missing API key' }, 401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests with invalid API key', async () => {
    const c = createMockContext({ 'X-API-Key': 'invalid-key' });
    const next = vi.fn();

    (mockEnv.VALID_API_KEYS.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await requireApiKey(c, next);

    expect(c.json).toHaveBeenCalledWith({ error: 'Invalid API key' }, 401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows requests with valid API key', async () => {
    const c = createMockContext({ 'X-API-Key': 'valid-key' });
    const next = vi.fn();

    (mockEnv.VALID_API_KEYS.get as ReturnType<typeof vi.fn>).mockResolvedValue('allowed');

    await requireApiKey(c, next);

    expect(c.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('is idempotent and safe for concurrent calls', async () => {
    const c1 = createMockContext({ 'X-API-Key': 'valid-key' });
    const c2 = createMockContext({ 'X-API-Key': 'valid-key' });
    const next1 = vi.fn();
    const next2 = vi.fn();

    (mockEnv.VALID_API_KEYS.get as ReturnType<typeof vi.fn>).mockResolvedValue('allowed');

    await Promise.all([requireApiKey(c1, next1), requireApiKey(c2, next2)]);

    expect(next1).toHaveBeenCalled();
    expect(next2).toHaveBeenCalled();
  });
});