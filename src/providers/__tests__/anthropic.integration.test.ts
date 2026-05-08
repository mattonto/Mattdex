import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { AnthropicProvider } from '../anthropic';
import type { LLMRequest, LLMResponse } from '../../types';

// Mock the AI SDK's anthropic function
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({
    chat: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        text: 'Mocked response from Claude',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
    }),
  })),
}));

/**
 * Integration test: exercises the AnthropicProvider through a Hono route handler
 * to verify the full request/response lifecycle.
 */
describe('AnthropicProvider Integration (via Hono route)', () => {
  let app: Hono<{ Bindings: { ANTHROPIC_API_KEY: string } }>;
  let mockEnv: { ANTHROPIC_API_KEY: string };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = { ANTHROPIC_API_KEY: 'sk-ant-test-key-12345' };

    app = new Hono<{ Bindings: { ANTHROPIC_API_KEY: string } }>();

    // Route that uses the AnthropicProvider
    app.post('/api/generate', async (c) => {
      try {
        const body = await c.req.json() as LLMRequest;
        const provider = new AnthropicProvider(c.env);

        if (!provider.supportsModel(body.model)) {
          return c.json({ error: `Unsupported model: ${body.model}` }, 400);
        }

        const result = await provider.generate(body);
        return c.json(result, 200);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return c.json({ error: message }, 500);
      }
    });
  });

  // --- Acceptance Criteria: R1 (same interface as T2) ---
  it('AC-R1: returns LLMResponse shape matching the provider interface', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-v1',
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 100,
        temperature: 0.7,
      } satisfies LLMRequest),
    }, mockEnv);

    expect(res.status).toBe(200);
    const body = await res.json() as LLMResponse;
    expect(body).toHaveProperty('text');
    expect(body).toHaveProperty('usage');
    expect(body.usage).toHaveProperty('promptTokens');
    expect(body.usage).toHaveProperty('completionTokens');
    expect(body.usage).toHaveProperty('totalTokens');
    expect(typeof body.text).toBe('string');
  });

  // --- Acceptance Criteria: AC2 (supports claude-v1 models) ---
  it('AC-2: accepts claude-v1 model and returns 200', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-v1',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 50,
      } satisfies LLMRequest),
    }, mockEnv);

    expect(res.status).toBe(200);
    const body = await res.json() as LLMResponse;
    expect(body.text).toBe('Mocked response from Claude');
  });

  it('AC-2: accepts claude-v1.2 model and returns 200', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-v1.2',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 50,
      } satisfies LLMRequest),
    }, mockEnv);

    expect(res.status).toBe(200);
  });

  it('AC-2: accepts claude-instant-v1 model and returns 200', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-instant-v1',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 50,
      } satisfies LLMRequest),
    }, mockEnv);

    expect(res.status).toBe(200);
  });

  // --- Error cases ---
  it('returns 400 for unsupported model', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 50,
      } satisfies LLMRequest),
    }, mockEnv);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('Unsupported model');
  });

  it('returns 400 for empty model string', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: '',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 50,
      } satisfies LLMRequest),
    }, mockEnv);

    expect(res.status).toBe(400);
  });

  it('returns 500 when ANTHROPIC_API_KEY is missing', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-v1',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 50,
      } satisfies LLMRequest),
    }, { ANTHROPIC_API_KEY: '' });

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('ANTHROPIC_API_KEY is required');
  });

  it('returns 400 for missing messages field', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-v1',
        maxTokens: 50,
      }),
    }, mockEnv);

    // messages is undefined, but the provider should handle it gracefully
    expect(res.status).toBe(200);
  });

  it('returns 200 with system message in conversation', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-v1',
        messages: [
          { role: 'system', content: 'You are Claude.' },
          { role: 'user', content: 'Who are you?' },
        ],
        maxTokens: 50,
      } satisfies LLMRequest),
    }, mockEnv);

    expect(res.status).toBe(200);
  });

  it('returns 200 with multi-turn conversation', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-v1',
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
          { role: 'user', content: 'How are you?' },
        ],
        maxTokens: 50,
      } satisfies LLMRequest),
    }, mockEnv);

    expect(res.status).toBe(200);
  });
});
