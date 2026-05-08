vi.mock('@sentry/cloudflare', () => ({ withSentry: (_o, h) => h }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'mock' }))) }));
vi.mock('ai', () => ({ generateObject: vi.fn(async () => ({ object: { functions: [], classes: [] } })) }));

// We do NOT mock @autoengineering/db or neon() — we want real DB interaction
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

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('parserRegistry (runtime)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const createdProjects: string[] = [];

  beforeAll(async () => { db = makeTestDb(); });
  beforeEach(() => { emitLogCapture.length = 0; vi.clearAllMocks(); });
  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) await cleanupProject(pid).catch(() => {});
  });

  it('should return undefined for unsupported file extension', async () => {
    const lang = getLanguageFromPath('src/file.unknown');
    expect(lang).toBeUndefined();
  });

  it('should map common file extensions to correct Tree-sitter language names', async () => {
    expect(getLanguageFromPath('src/app.ts')).toBe('typescript');
    expect(getLanguageFromPath('src/app.tsx')).toBe('typescript');
    expect(getLanguageFromPath('src/app.js')).toBe('javascript');
    expect(getLanguageFromPath('src/app.py')).toBe('python');
    expect(getLanguageFromPath('src/main.rs')).toBe('rust');
    expect(getLanguageFromPath('src/main.cpp')).toBe('cpp');
    expect(getLanguageFromPath('src/main.go')).toBe('go');
    expect(getLanguageFromPath('src/main.rb')).toBe('ruby');
    expect(getLanguageFromPath('src/main.php')).toBe('php');
    expect(getLanguageFromPath('src/main.cs')).toBe('c_sharp');
    expect(getLanguageFromPath('src/main.swift')).toBe('swift');
    expect(getLanguageFromPath('src/main.kt')).toBe('kotlin');
    expect(getLanguageFromPath('src/main.scala')).toBe('scala');
    expect(getLanguageFromPath('src/main.dart')).toBe('dart');
    expect(getLanguageFromPath('src/main.lua')).toBe('lua');
    expect(getLanguageFromPath('src/main.ex')).toBe('elixir');
    expect(getLanguageFromPath('src/main.clj')).toBe('clojure');
    expect(getLanguageFromPath('src/main.hs')).toBe('haskell');
    expect(getLanguageFromPath('src/main.sh')).toBe('bash');
    expect(getLanguageFromPath('src/main.yaml')).toBe('yaml');
    expect(getLanguageFromPath('src/main.md')).toBe('markdown');
  });

  it('should cache parser compilation across multiple calls for same language', async () => {
    // Mock fetch to simulate CDN
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: string) =>
      Promise.resolve(new Response(new ArrayBuffer(16), { status: 200 }))
    );

    // First call should trigger fetch
    await loadParser('typescript');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call should use cache
    await loadParser('typescript');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1

    fetchSpy.mockRestore();
  });

  it('should reject with error when parser URL returns 404', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('', { status: 404 }))
    );

    await expect(loadParser('nonexistentlang'))
      .rejects
      .toThrow('Failed to load parser from https://unpkg.com/@web-tree-sitter/nonexistentlang/tree-sitter-nonexistentlang.wasm: 404 Not Found');
  });
});