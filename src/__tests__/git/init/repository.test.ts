import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeGitRepository } from '../../../src/git/init/repository';
import type { R2Bucket } from '@cloudflare/workers-types';

// Mock isomorphic-git and memfs
vi.mock('isomorphic-git', () => ({
  init: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('memfs', () => {
  const vol = {
    _files: {} as Record<string, string | Buffer>,
    readdirSync(dir: string, _opts?: { recursive?: boolean }): string[] {
      return Object.keys(this._files)
        .filter((k) => k.startsWith(dir))
        .map((k) => k.slice(dir.length + 1));
    },
    statSync(path: string): { isFile: () => boolean; isDirectory: () => boolean } {
      if (this._files[path] !== undefined) {
        return { isFile: () => true, isDirectory: () => false };
      }
      return { isFile: () => false, isDirectory: () => true };
    },
    readFileSync(path: string): string | Buffer {
      return this._files[path] ?? Buffer.alloc(0);
    },
  };
  return { fs: vol };
});

describe('initializeGitRepository', () => {
  let mockBucket: R2Bucket;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBucket = {
      list: vi.fn(),
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      head: vi.fn(),
      createMultipartUpload: vi.fn(),
      resumeMultipartUpload: vi.fn(),
    } as unknown as R2Bucket;
  });

  it('AC1: should initialize a bare repo when none exists in R2', async () => {
    // Simulate empty bucket
    (mockBucket.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      objects: [],
      truncated: false,
      delimitedPrefixes: [],
    });

    await initializeGitRepository({ GIT_REPO_BUCKET: mockBucket });

    // Should have called init
    const { init } = await import('isomorphic-git');
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ bare: true, defaultBranch: 'main' }),
    );

    // Should have written files to R2
    expect(mockBucket.put).toHaveBeenCalled();
  });

  it('AC1: should skip initialization when repo already exists in R2', async () => {
    // Simulate existing repo
    (mockBucket.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      objects: [{ key: 'repos/main.git/HEAD', size: 23, uploaded: new Date(), etag: 'abc' }],
      truncated: false,
      delimitedPrefixes: [],
    });

    await initializeGitRepository({ GIT_REPO_BUCKET: mockBucket });

    // Should NOT have called init
    const { init } = await import('isomorphic-git');
    expect(init).not.toHaveBeenCalled();

    // Should NOT have written any files
    expect(mockBucket.put).not.toHaveBeenCalled();
  });

  it('should handle R2 list errors gracefully', async () => {
    (mockBucket.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('R2 unavailable'),
    );

    await expect(
      initializeGitRepository({ GIT_REPO_BUCKET: mockBucket }),
    ).rejects.toThrow('R2 unavailable');
  });

  it('should handle init errors gracefully', async () => {
    (mockBucket.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      objects: [],
      truncated: false,
      delimitedPrefixes: [],
    });

    const { init } = await import('isomorphic-git');
    (init as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Init failed'),
    );

    await expect(
      initializeGitRepository({ GIT_REPO_BUCKET: mockBucket }),
    ).rejects.toThrow('Init failed');
  });
});
