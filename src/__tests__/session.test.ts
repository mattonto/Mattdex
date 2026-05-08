import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionContext } from '../types/session';
import { createContextCache } from '../storage/context-cache';

// Mock R2 binding
const mockR2Bucket = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
} as unknown as R2Bucket;

const env = {
  R2Context: mockR2Bucket,
} as { R2Context: R2Bucket };

const cache = createContextCache(env);

const sampleSession: SessionContext = {
  sessionId: 'sess_abc123',
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ],
  version: 1,
  updatedAt: 1700000000000,
};

describe('SessionContext type', () => {
  it('should have correct shape', () => {
    const ctx: SessionContext = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'test' }],
      version: 1,
      updatedAt: Date.now(),
    };
    expect(ctx.sessionId).toBe('test');
    expect(ctx.messages).toHaveLength(1);
    expect(ctx.version).toBe(1);
    expect(ctx.updatedAt).toBeGreaterThan(0);
  });
});

describe('createContextCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('AC4: should return null when session does not exist in R2', async () => {
      vi.mocked(mockR2Bucket.get).mockResolvedValue(null);

      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
      expect(mockR2Bucket.get).toHaveBeenCalledWith('sessions/nonexistent');
    });

    it('should return parsed SessionContext when object exists', async () => {
      const blob = new Blob([JSON.stringify(sampleSession)], { type: 'application/json' });
      const mockObject = {
        key: 'sessions/sess_abc123',
        body: blob,
        bodyUsed: false,
        etag: 'abc',
        size: blob.size,
        httpEtag: 'abc',
        uploaded: new Date(),
        checksums: {},
        writeHttpMetadata: vi.fn(),
        customMetadata: {},
        range: null,
      } as unknown as R2ObjectBody;
      vi.mocked(mockR2Bucket.get).mockResolvedValue(mockObject);

      const result = await cache.get('sess_abc123');
      expect(result).toEqual(sampleSession);
    });

    it('should return null when R2 object has no body', async () => {
      const mockObject = null;
      vi.mocked(mockR2Bucket.get).mockResolvedValue(mockObject);

      const result = await cache.get('sess_abc123');
      expect(result).toBeNull();
    });

    it('should return null when JSON parsing fails', async () => {
      const blob = new Blob(['invalid json'], { type: 'application/json' });
      const mockObject = {
        key: 'sessions/bad',
        body: blob,
        bodyUsed: false,
        etag: 'abc',
        size: blob.size,
        httpEtag: 'abc',
        uploaded: new Date(),
        checksums: {},
        writeHttpMetadata: vi.fn(),
        customMetadata: {},
        range: null,
      } as unknown as R2ObjectBody;
      vi.mocked(mockR2Bucket.get).mockResolvedValue(mockObject);

      const result = await cache.get('bad');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('P3: should store session context with correct key prefix', async () => {
      vi.mocked(mockR2Bucket.put).mockResolvedValue({
        key: 'sessions/sess_abc123',
        etag: 'def',
        httpEtag: 'def',
        uploaded: new Date(),
        checksums: {},
        size: 0,
        version: '1',
      } as unknown as R2Object);

      await cache.set(sampleSession);

      expect(mockR2Bucket.put).toHaveBeenCalledWith(
        'sessions/sess_abc123',
        expect.any(ReadableStream),
        expect.objectContaining({
          httpMetadata: expect.objectContaining({
            contentType: 'application/json',
          }),
        }),
      );
    });

    it('should throw when R2 put fails', async () => {
      vi.mocked(mockR2Bucket.put).mockRejectedValue(new Error('R2 write error'));

      await expect(cache.set(sampleSession)).rejects.toThrow('R2 write error');
    });
  });

  describe('delete', () => {
    it('should delete session by key prefix', async () => {
      vi.mocked(mockR2Bucket.delete).mockResolvedValue();

      await cache.delete('sess_abc123');

      expect(mockR2Bucket.delete).toHaveBeenCalledWith('sessions/sess_abc123');
    });

    it('should not throw when deleting nonexistent key', async () => {
      vi.mocked(mockR2Bucket.delete).mockResolvedValue();

      await expect(cache.delete('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all session keys with prefix', async () => {
      const mockObjects = [
        { key: 'sessions/sess_1', size: 100, etag: 'a', httpEtag: 'a', uploaded: new Date(), checksums: {} },
        { key: 'sessions/sess_2', size: 200, etag: 'b', httpEtag: 'b', uploaded: new Date(), checksums: {} },
      ] as unknown as R2Object[];
      vi.mocked(mockR2Bucket.list).mockResolvedValue({
        objects: mockObjects,
        truncated: false,
        delimitedPrefixes: [],
      });

      const result = await cache.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('sess_1');
      expect(result[1]).toBe('sess_2');
      expect(mockR2Bucket.list).toHaveBeenCalledWith({ prefix: 'sessions/' });
    });

    it('should return empty array when no sessions exist', async () => {
      vi.mocked(mockR2Bucket.list).mockResolvedValue({
        objects: [],
        truncated: false,
        delimitedPrefixes: [],
      });

      const result = await cache.list();
      expect(result).toEqual([]);
    });
  });
});
