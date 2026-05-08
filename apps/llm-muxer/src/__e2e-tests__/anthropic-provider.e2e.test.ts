import { vi } from 'vitest';
import { makeTestDb } from '../../../../test/runtime/seed';
import { QueueRecorder } from '../../../../test/runtime/queue-recorder';
import { pollUntil } from '../../../../test/e2e/polling-harness';
import worker from '../index';
import { AnthropicProvider } from '../providers/anthropic';

// Mock external dependencies
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'mock response' }),
}));
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue({
    modelId: 'claude-2',
  }),
}));

const mockEnv = {
  ANTHROPIC_API_KEY: 'test-key',
};

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('AnthropicProvider E2E', () => {
  let db: ReturnType<typeof makeTestDb>;
  const queueRecorder = new QueueRecorder();

  beforeAll(async () => {
    db = makeTestDb();
  });

  beforeEach(() => {
    queueRecorder.reset();
  });

  it('should handle concurrent requests with correct model routing and error isolation', async () => {
    const provider = new AnthropicProvider(mockEnv);
    const promises = [];

    // Simulate concurrent valid and invalid model requests
    promises.push(provider.complete('prompt 1', 'claude-2'));
    promises.push(provider.complete('prompt 2', 'claude-instant-1'));
    promises.push(provider.complete('prompt 3', 'claude-3').catch(e => e.message)); // Invalid model

    const results = await Promise.all(promises);

    // Assert two successes, one failure
    expect(results.filter(r => typeof r === 'string')).toHaveLength(2);
    expect(results.filter(r => typeof r === 'string' && r === 'mock response')).toHaveLength(2);
    expect(results.some(r => typeof r === 'string' && r.includes('Unsupported'))).toBe(true);

    // Verify correct model calls were made
    expect(require('@ai-sdk/anthropic').anthropic).toHaveBeenCalledWith('claude-2', { apiKey: 'test-key' });
    expect(require('@ai-sdk/anthropic').anthropic).toHaveBeenCalledWith('claude-instant-1', { apiKey: 'test-key' });
    expect(require('@ai-sdk/anthropic').anthropic).toHaveBeenCalledTimes(3); // Two valid + one failed attempt
  });

  it('should maintain request isolation across projects in shared DB environment', async () => {
    const { projectId: projectA } = await db.insert('projects').values({ id: 'proj-a', name: 'Project A' }).returning().get();
    const { projectId: projectB } = await db.insert('projects').values({ id: 'proj-b', name: 'Project B' }).returning().get();

    // Use queue recorder to verify message isolation
    await worker.queue(
      { message: 'test', projectId: projectA },
      { ...mockEnv, PLAN_TASKS_RETRY_QUEUE: queueRecorder }
    );

    await worker.queue(
      { message: 'test', projectId: projectB },
      { ...mockEnv, PLAN_TASKS_RETRY_QUEUE: queueRecorder }
    );

    // Ensure messages are properly scoped to their projects
    const aMessages = queueRecorder.sends.filter(m => m.message.projectId === projectA);
    const bMessages = queueRecorder.sends.filter(m => m.message.projectId === projectB);

    expect(aMessages).toHaveLength(1);
    expect(bMessages).toHaveLength(1);
  });
});
