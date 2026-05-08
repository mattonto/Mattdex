import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionContext } from '../../types/session';
import { createContextCache } from '../../storage/context-cache';

/**
 * Integration-style tests for context-cache.
 * Uses mocked R2 binding but tests the full CRUD lifecycle.
 */

function createMockR2(): R2Bucket {
  const store = new Map<string, string>();

  return {
    put: vi.fn(async (key: string, value: ReadableStream | ArrayBuffer | string | Blob, options?: R2PutOptions) => {
      const text = value instanceof Blob ? await value.text() : String(value);
      store.set(key, text);
      return {
        key,
        etag: 'mock-etag',
        httpEtag: 'mock-etag',
        uploaded: new Date(),
        checksums: {},
        size: text.length,
        version: '1',
      } as unknown as R2Object;
    }),
    get: vi.fn(async (key: string) => {
      const data = store.get(key);
      if (!data) return null;
      const blob = new Blob([data], { type: 'application/json' });
      return {
        key,
        body: blob,
        bodyUsed: false,
        etag: 'mock-etag',
        httpEtag: 'mock-etag',
        size: blob.size,
        uploaded: new Date(),
        checksums: {},
        writeHttpMetadata: vi.fn(),
        customMetadata: {},
        range: null,
      } as unknown as R2ObjectBody;
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: R2ListOptions) => {
      const prefix = options?.prefix ?? '';
      const objects: R2Object[] = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          objects.push({
            key,
            size: store.get(key)?.length ?? 0,
            etag: 'mock-etag',
            httpEtag: 'mock-etag',
            uploaded: new Date(),
            checksums: {},
          } as unknown as R2Object);
        }
      }
      return { objects, truncated: false, delimitedPrefixes: [] };
    }),
  } as unknown as R2Bucket;
}

describe('ContextCache integration (R4, AC4, P3)', () => {
  let env: { R2Context: R2Bucket };
  let cache: ReturnType<typeof createContextCache>;

  const session1: SessionContext = {
    sessionId: 'sess_int_1',
    messages: [{ role: 'user', content: 'Hello' }],
    version: 1,
    updatedAt: 1700000000000,
  };

  const session2: SessionContext = {
    sessionId: 'sess_int_2',
    messages: [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hey' },
    ],
    version: 2,
    updatedAt: 1700000001000,
  };

  beforeEach(() => {
    env = { R2Context: createMockR2() };
    cache = createContextCache(env);
  });

  it('R4: should perform full CRUD lifecycle (create, read, update, delete)', async () => {
    // Create
    await cache.set(session1);
    let retrieved = await cache.get('sess_int_1');
    expect(retrieved).toEqual(session1);

    // Update (set with same key, higher version)
    const updated: SessionContext = {
      ...session1,
      messages: [...session1.messages, { role: 'assistant', content: 'World' }],
      version: 2,
      updatedAt: 1700000002000,
    };
    await cache.set(updated);
    retrieved = await cache.get('sess_int_1');
    expect(retrieved?.version).toBe(2);
    expect(retrieved?.messages).toHaveLength(2);

    // Delete
    await cache.delete('sess_int_1');
    retrieved = await cache.get('sess_int_1');
    expect(retrieved).toBeNull();
  });

  it('AC4: should return null for nonexistent session', async () => {
    const result = await cache.get('sess_does_not_exist');
    expect(result).toBeNull();
  });

  it('P3: should persist data across separate get/set calls', async () => {
    await cache.set(session1);
    await cache.set(session2);

    const result1 = await cache.get('sess_int_1');
    const result2 = await cache.get('sess_int_2');

    expect(result1).toEqual(session1);
    expect(result2).toEqual(session2);
  });

  it('should list all stored sessions', async () => {
    await cache.set(session1);
    await cache.set(session2);

    const keys = await cache.list();
    expect(keys).toContain('sess_int_1');
    expect(keys).toContain('sess_int_2');
    expect(keys).toHaveLength(2);
  });

  it('should return empty list when no sessions stored', async () => {
    const keys = await cache.list();
    expect(keys).toEqual([]);
  });

  it('should overwrite existing session on set with same sessionId', async () => {
    await cache.set(session1);
    const overwritten: SessionContext = {
      ...session1,
      messages: [{ role: 'system', content: 'Overwritten' }],
      version: 3,
      updatedAt: 1700000003000,
    };
    await cache.set(overwritten);

    const result = await cache.get('sess_int_1');
    expect(result?.messages[0].content).toBe('Overwritten');
    expect(result?.version).toBe(3);
  });
});
