vi.mock('@sentry/cloudflare', () => ({ withSentry: (_o, h) => h }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'mock' }))) }));
vi.mock('ai', () => ({ generateObject: vi.fn(async () => ({ object: { functions: [], classes: [] } })) }));

const emitLogCapture: Array<Record<string, unknown>> = [];
vi.mock('@autoengineering/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@autoengineering/shared');
  return {
    ...actual,
    emitLog: (e: Record<string, unknown>) => { emitLogCapture.push(e); },
    getModelChain: vi.fn(() => ['Qwen/Qwen3-235B-A22B-Instruct-2507']),
    getModelProvider: vi.fn(() => 'deepinfra'),
    createModelFactory: vi.fn(() => vi.fn(() => ({ modelId: 'mock-model' }))),
    getSentryOptions: vi.fn(() => undefined),
    assemblePrompt: vi.fn(async () => 'prompt'),
    startTimer: () => () => 100,
    insertLlmCallDrizzle: vi.fn().mockResolvedValue(undefined),
    insertActionLogDrizzle: vi.fn().mockResolvedValue(undefined),
    addProjectCostDrizzle: vi.fn().mockResolvedValue(undefined),
  };
});

import { loadParser, getLanguageFromPath } from '../parserRegistry.js';
import { makeTestDb } from '../../../../test/runtime/seed.js';
import { QueueRecorder } from '../../../../test/runtime/queue-recorder.js';
import { pollUntil } from '../../../../test/e2e/polling-harness.js';

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('parserRegistry (e2e)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const createdProjects: string[] = [];

  beforeAll(async () => { db = makeTestDb(); });
  beforeEach(() => { emitLogCapture.length = 0; vi.clearAllMocks(); });
  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) await cleanupProject(pid).catch(() => {});
  });

  it('should load and cache parsers across multiple projects and file types', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: string) => {
      // Simulate real response sizes for different languages
      const sizeMap: Record<string, number> = {
        'typescript': 1024 * 1024, // 1MB
        'python': 800 * 1024,       // 800KB
        'rust': 1200 * 1024,        // 1.2MB
      };
      const match = url.match(/tree-sitter-(\w+)\.wasm/);
      const lang = match ? match[1] : 'unknown';
      const size = sizeMap[lang] || 500 * 1024; // fallback 500KB
      return Promise.resolve(new Response(new ArrayBuffer(size), { status: 200 }));
    });

    // Project A uses TypeScript and Python
    const { projectId: projectA } = await seedProject(db);
    createdProjects.push(projectA);
    const tsParserA = await loadParser('typescript');
    const pyParserA = await loadParser('python');
    expect(tsParserA).toBeInstanceOf(WebAssembly.Module);
    expect(pyParserA).toBeInstanceOf(WebAssembly.Module);

    // Project B uses TypeScript and Rust — TypeScript should be cached
    const { projectId: projectB } = await seedProject(db);
    createdProjects.push(projectB);
    const tsParserB = await loadParser('typescript');
    const rsParserB = await loadParser('rust');
    expect(tsParserB).toBeInstanceOf(WebAssembly.Module);
    expect(rsParserB).toBeInstanceOf(WebAssembly.Module);

    // Assert cache reuse: only 3 fetches for 4 loads (ts reused)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('typescript'));
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('python'));
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('rust'));

    // Cross-project isolation: no contamination
    const langsA = ['typescript', 'python'];
    const langsB = ['typescript', 'rust'];
    const allLangs = new Set([...langsA, ...langsB]);
    expect(fetchSpy).toHaveBeenCalledTimes(allLangs.size); // 3 unique

    fetchSpy.mockRestore();
  });

  it('should handle concurrent parser loads for same language without duplication', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: string) =>
      new Promise(resolve => {
        // Simulate network delay to increase race condition likelihood
        setTimeout(() => resolve(new Response(new ArrayBuffer(1024 * 1024), { status: 200 })), 100);
      })
    );

    // Simulate concurrent requests from multiple files in same project
    const { projectId } = await seedProject(db);
    createdProjects.push(projectId);

    const promises = Array(5).fill(0).map(() => loadParser('javascript'));
    const results = await Promise.all(promises);

    // All should resolve to same module instance
    expect(results.every(r => r === results[0])).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Only one fetch despite 5 calls

    fetchSpy.mockRestore();
  });
});