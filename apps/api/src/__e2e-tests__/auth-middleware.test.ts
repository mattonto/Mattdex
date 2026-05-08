import { vi } from 'vitest';
import { createMocks } from 'hono/testing';
import { requireApiKey } from '../middleware/auth';
import { handleT1, handleT2, handleT3 } from '../handlers';

// Mock environment
const mockEnv = {
  VALID_API_KEYS: {
    get: vi.fn(),
  },
};

// Helper to simulate handler call
const callHandler = async (handler: (c: any, next: Function) => Promise<void>, apiKey: string | null) => {
  const { req, c } = createMocks({
    headers: apiKey ? { 'X-API-Key': apiKey } : {},
  });
  c.env = mockEnv;
  c.req = req;

  const next = vi.fn();
  await handler(c, next);
  return { c, next };
};

describe('Auth Middleware E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const handlers = [
    { name: 'T1', handler: (c: any, n: Function) => requireApiKey(c, () => handleT1(c).then(() => n())) },
    { name: 'T2', handler: (c: any, n: Function) => requireApiKey(c, () => handleT2(c).then(() => n())) },
    { name: 'T3', handler: (c: any, n: Function) => requireApiKey(c, () => handleT3(c).then(() => n())) },
  ];

  it('protects all endpoints: rejects invalid or missing keys', async () => {
    (mockEnv.VALID_API_KEYS.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    for (const { name, handler } of handlers) {
      const { c } = await callHandler(handler, 'invalid-key');
      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid API key' }, 401);
    }

    for (const { name, handler } of handlers) {
      const { c } = await callHandler(handler, null);
      expect(c.json).toHaveBeenCalledWith({ error: 'Missing API key' }, 401);
    }
  });

  it('allows valid keys across all endpoints', async () => {
    (mockEnv.VALID_API_KEYS.get as ReturnType<typeof vi.fn>).mockResolvedValue('allowed');

    for (const { name, handler } of handlers) {
      const { next } = await callHandler(handler, 'valid-key');
      expect(next).toHaveBeenCalled();
    }
  });

  it('ensures cross-endpoint isolation: one handler failure does not affect others', async () => {
    // Simulate mixed state: one key valid, one invalid
    (mockEnv.VALID_API_KEYS.get as ReturnType<typeof vi.fn>)
      .mockImplementation(async (key) => (key === 'valid-key' ? 'allowed' : null));

    const result1 = await callHandler(handlers[0].handler, 'valid-key');
    const result2 = await callHandler(handlers[1].handler, 'invalid-key');

    expect(result1.next).toHaveBeenCalled();
    expect(result2.c.json).toHaveBeenCalledWith({ error: 'Invalid API key' }, 401);
  });
});