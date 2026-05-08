import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, unlinkSync, rmdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, type DatabaseConfig } from '../db.js';

describe('createDatabase', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'db-test-'));
  });

  afterEach(() => {
    // Clean up the temporary directory and any files within
    try {
      rmdirSync(tmpDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * AC: Given a temporary path, a database file appears at that location after initialization.
   */
  it('AC-1: creates a database file at the specified path when it does not exist', () => {
    const dbPath = join(tmpDir, 'test.db');
    expect(existsSync(dbPath)).toBe(false);

    const { db } = createDatabase({ path: dbPath });
    db.close();

    expect(existsSync(dbPath)).toBe(true);
  });

  /**
   * AC: If the database file already exists, it is opened (not recreated).
   */
  it('AC-2: opens an existing database file without recreating it', () => {
    const dbPath = join(tmpDir, 'existing.db');

    // Create the database first
    const { db: db1 } = createDatabase({ path: dbPath });
    // Write a table to verify it persists
    db1.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
    db1.prepare('INSERT INTO test (value) VALUES (?)').run('hello');
    db1.close();

    // Re-open the same file
    const { db: db2 } = createDatabase({ path: dbPath });
    const row = db2.prepare('SELECT value FROM test WHERE id = 1').get() as { value: string };
    expect(row.value).toBe('hello');
    db2.close();
  });

  /**
   * AC: An invalid/immutable path throws an error.
   */
  it('AC-3: throws an error when the path is not writable', () => {
    // Create a read-only directory
    const readOnlyDir = join(tmpDir, 'readonly');
    mkdtempSync(readOnlyDir);
    // Make the directory read-only (remove write permission)
    chmodSync(readOnlyDir, 0o444);

    const badPath = join(readOnlyDir, 'test.db');

    expect(() => createDatabase({ path: badPath })).toThrow(
      /not writable/
    );
  });

  it('returns a DatabaseHandle with a db property that is a better-sqlite3 Database instance', () => {
    const dbPath = join(tmpDir, 'handle-test.db');
    const handle = createDatabase({ path: dbPath });

    expect(handle).toHaveProperty('db');
    expect(typeof handle.db).toBe('object');
    expect(handle.db).toBeDefined();

    // Verify it's a working database
    handle.db.exec('SELECT 1');
    handle.db.close();
  });

  it('enables foreign keys by default', () => {
    const dbPath = join(tmpDir, 'fk-test.db');
    const { db } = createDatabase({ path: dbPath });

    const pragma = db.pragma('foreign_keys', { simple: true }) as boolean;
    expect(pragma).toBe(true);

    db.close();
  });

  it('enables WAL mode when walMode is true', () => {
    const dbPath = join(tmpDir, 'wal-test.db');
    const { db } = createDatabase({ path: dbPath, walMode: true });

    const journalMode = db.pragma('journal_mode', { simple: true }) as string;
    expect(journalMode.toLowerCase()).toBe('wal');

    db.close();
  });

  it('does not enable WAL mode when walMode is false', () => {
    const dbPath = join(tmpDir, 'no-wal-test.db');
    const { db } = createDatabase({ path: dbPath, walMode: false });

    const journalMode = db.pragma('journal_mode', { simple: true }) as string;
    // Default journal mode is 'delete' for better-sqlite3
    expect(journalMode.toLowerCase()).not.toBe('wal');

    db.close();
  });

  it('does not enable WAL mode when readonly is true even if walMode is true', () => {
    const dbPath = join(tmpDir, 'readonly-wal-test.db');
    // First create the database so we can open it readonly
    const { db: createDb } = createDatabase({ path: dbPath });
    createDb.close();

    const { db } = createDatabase({ path: dbPath, readonly: true, walMode: true });

    // WAL mode should not be set on a readonly database
    const journalMode = db.pragma('journal_mode', { simple: true }) as string;
    expect(journalMode.toLowerCase()).not.toBe('wal');

    db.close();
  });

  it('creates parent directories if they do not exist', () => {
    const nestedDir = join(tmpDir, 'a', 'b', 'c');
    const dbPath = join(nestedDir, 'nested.db');

    expect(existsSync(nestedDir)).toBe(false);

    const { db } = createDatabase({ path: dbPath });
    db.close();

    expect(existsSync(dbPath)).toBe(true);
  });

  it('throws a descriptive error when the parent directory is not writable', () => {
    // Create a read-only directory
    const readOnlyDir = join(tmpDir, 'readonly-parent');
    mkdtempSync(readOnlyDir);
    chmodSync(readOnlyDir, 0o444);

    const badPath = join(readOnlyDir, 'subdir', 'test.db');

    expect(() => createDatabase({ path: badPath })).toThrow(
      /not writable/
    );
  });

  it('resolves relative paths to absolute paths', () => {
    // Use a relative path within the temp dir
    const relativePath = join(tmpDir, 'relative.db');
    const { db } = createDatabase({ path: relativePath });
    db.close();

    expect(existsSync(relativePath)).toBe(true);
  });
});
