import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { R2Bucket, R2Object, R2Objects } from '@cloudflare/workers-types';
import { initializeGitRepository, type GitInitEnv } from '../../../git/init/repository';

// ---------------------------------------------------------------------------
// Mock R2Bucket
// ---------------------------------------------------------------------------

function createMockR2Bucket(): {
  bucket: R2Bucket;
  stored: Map<string, Uint8Array>;
} {
  const stored = new Map<string, Uint8Array>();

  const bucket: R2Bucket = {
    get: vi.fn(async (key: string) => {
      const data = stored.get(key);
      if (!data) return null;
      return {
        key,
        size: data.byteLength,
        etag: 'mock-etag',
        httpEtag: 'mock-http-etag',
        uploaded: new Date(),
        checksums: {},
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(data);
            controller.close();
          },
        }),
        bodyUsed: false,
        arrayBuffer: async () => data.buffer as ArrayBuffer,
        text: async () => new TextDecoder().decode(data),
        json: async <T>(): Promise<T> => {
          const text = new TextDecoder().decode(data);
          return JSON.parse(text) as T;
        },
        blob: async () => new Blob([data]),
        writeHttpMetadata: vi.fn(),
      } as unknown as R2Object;
    }),

    put: vi.fn(async (key: string, data: ArrayBuffer | ReadableStream | string) => {
      if (typeof data === 'string') {
        stored.set(key, new TextEncoder().encode(data));
      } else if (data instanceof ArrayBuffer) {
        stored.set(key, new Uint8Array(data));
      } else {
        // ReadableStream — read it into a buffer
        const reader = data.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLength = chunks.reduce((acc, c) => acc + c.byteLength, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.byteLength;
        }
        stored.set(key, combined);
      }
    }),

    delete: vi.fn(async (key: string) => {
      stored.delete(key);
    }),

    list: vi.fn(async (options?: { prefix?: string }) => {
      const prefix = options?.prefix ?? '';
      const keys = Array.from(stored.keys()).filter((k) => k.startsWith(prefix));
      const objects: R2Object[] = keys.map((key) => ({
        key,
        size: stored.get(key)?.byteLength ?? 0,
        etag: 'mock-etag',
        httpEtag: 'mock-http-etag',
        uploaded: new Date(),
        checksums: {},
      })) as unknown as R2Object[];
      return {
        objects,
        truncated: false,
        delimitedPrefixes: [],
      } as R2Objects;
    }),

    head: vi.fn(),
  } as unknown as R2Bucket;

  return { bucket, stored };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initializeGitRepository', () => {
  let mockBucket: ReturnType<typeof createMockR2Bucket>;
  let env: GitInitEnv;

  beforeEach(() => {
    mockBucket = createMockR2Bucket();
    env = { GIT_STORAGE: mockBucket.bucket };
  });

  it('AC1: should create a bare repository in R2 at repos/main.git/ if not exists', async () => {
    await initializeGitRepository(env);

    // Verify that HEAD was written
    const headKey = 'repos/main.git/HEAD';
    const headObject = await env.GIT_STORAGE.get(headKey);
    expect(headObject).not.toBeNull();
    const headContent = await headObject!.text();
    expect(headContent).toBe('ref: refs/heads/main\n');

    // Verify that standard Git directory structure was created
    const refsHeadsKey = 'repos/main.git/refs/heads';
    const refsHeadsObj = await env.GIT_STORAGE.get(refsHeadsKey);
    expect(refsHeadsObj).not.toBeNull();

    const objectsKey = 'repos/main.git/objects';
    const objectsObj = await env.GIT_STORAGE.get(objectsKey);
    expect(objectsObj).not.toBeNull();

    const configKey = 'repos/main.git/config';
    const configObj = await env.GIT_STORAGE.get(configKey);
    expect(configObj).not.toBeNull();
  });

  it('AC2: should set main as default branch', async () => {
    await initializeGitRepository(env);

    const headKey = 'repos/main.git/HEAD';
    const headObject = await env.GIT_STORAGE.get(headKey);
    const headContent = await headObject!.text();

    // The HEAD file should point to refs/heads/main
    expect(headContent).toBe('ref: refs/heads/main\n');
  });

  it('AC3: should be idempotent — not fail if repo already exists', async () => {
    // First call — creates the repo
    await initializeGitRepository(env);

    // Second call — should not throw and should not overwrite
    await expect(initializeGitRepository(env)).resolves.toBeUndefined();

    // Verify HEAD still has the correct content
    const headKey = 'repos/main.git/HEAD';
    const headObject = await env.GIT_STORAGE.get(headKey);
    const headContent = await headObject!.text();
    expect(headContent).toBe('ref: refs/heads/main\n');
  });

  it('should not modify an existing valid repository', async () => {
    // Pre-populate a valid repo
    const encoder = new TextEncoder();
    mockBucket.stored.set('repos/main.git/HEAD', encoder.encode('ref: refs/heads/main\n'));
    mockBucket.stored.set('repos/main.git/config', encoder.encode('[core]\n\tbare = true\n'));
    mockBucket.stored.set('repos/main.git/refs/heads', new Uint8Array(0));
    mockBucket.stored.set('repos/main.git/objects', new Uint8Array(0));

    // Spy on put to detect any writes
    const putSpy = vi.spyOn(env.GIT_STORAGE, 'put');

    await initializeGitRepository(env);

    // Should not have written anything because the repo already exists
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('should throw a descriptive error if HEAD is missing after init', async () => {
    // Simulate a write failure by making put throw for HEAD
    const originalPut = mockBucket.bucket.put.bind(mockBucket.bucket);
    vi.spyOn(mockBucket.bucket, 'put').mockImplementation(async (key: string) => {
      if (key === 'repos/main.git/HEAD') {
        // Don't actually store it
        return;
      }
      return originalPut(key);
    });

    await expect(initializeGitRepository(env)).rejects.toThrow(
      'Git repository initialisation failed: HEAD not found',
    );
  });

  it('should throw if HEAD content is unexpected after init', async () => {
    // Simulate a write that produces wrong content
    const originalPut = mockBucket.bucket.put.bind(mockBucket.bucket);
    vi.spyOn(mockBucket.bucket, 'put').mockImplementation(async (key: string, data: any) => {
      if (key === 'repos/main.git/HEAD') {
        // Write wrong content
        const encoder = new TextEncoder();
        mockBucket.stored.set(key, encoder.encode('ref: refs/heads/master\n'));
        return;
      }
      return originalPut(key, data);
    });

    await expect(initializeGitRepository(env)).rejects.toThrow(
      'unexpected HEAD content',
    );
  });

  it('should handle R2 get failure gracefully', async () => {
    // Make get throw for the HEAD check after init
    vi.spyOn(mockBucket.bucket, 'get').mockRejectedValue(new Error('R2 unavailable'));

    await expect(initializeGitRepository(env)).rejects.toThrow('R2 unavailable');
  });
});
