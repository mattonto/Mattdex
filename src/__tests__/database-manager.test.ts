import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../database-manager';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('DatabaseManager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-manager-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should throw when path is empty string', () => {
      expect(() => new DatabaseManager('')).toThrow('Database path must be a non-empty string');
    });

    it('should accept a valid file path', () => {
      const mgr = new DatabaseManager(path.join(tempDir, 'test.db'));
      expect(mgr.getPath()).toBe(path.join(tempDir, 'test.db'));
    });

    it('should accept :memory: for in-memory mode', () => {
      const mgr = new DatabaseManager(':memory:');
      expect(mgr.getPath()).toBe(':memory:');
    });
  });

  describe('initialize()', () => {
    it('AC: creates the SQLite file on disk when given a new file path', () => {
      const dbPath = path.join(tempDir, 'created.db');
      expect(fs.existsSync(dbPath)).toBe(false);

      const mgr = new DatabaseManager(dbPath);
      mgr.initialize();

      expect(fs.existsSync(dbPath)).toBe(true);
      mgr.close();
    });

    it('AC: creates schema_migrations table', () => {
      const mgr = new DatabaseManager(':memory:');
      mgr.initialize();

      const db = mgr.getConnection();
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
        .get() as { name: string } | undefined;

      expect(result).toBeDefined();
      expect(result!.name).toBe('schema_migrations');
      mgr.close();
    });

    it('AC: inserts a baseline migration record', () => {
      const mgr = new DatabaseManager(':memory:');
      mgr.initialize();

      const db = mgr.getConnection();
      const row = db.prepare('SELECT * FROM schema_migrations ORDER BY id').get() as {
        id: number;
        version: string;
        applied_at: string;
      };

      expect(row).toBeDefined();
      expect(row.version).toBe('V0__baseline');
      expect(row.applied_at).toBeDefined();
      expect(new Date(row.applied_at).toISOString()).toBe(row.applied_at);
      mgr.close();
    });

    it('AC: in-memory mode (:memory:) works', () => {
      const mgr = new DatabaseManager(':memory:');
      expect(() => mgr.initialize()).not.toThrow();

      const db = mgr.getConnection();
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
        .get() as { name: string } | undefined;

      expect(result).toBeDefined();
      expect(result!.name).toBe('schema_migrations');
      mgr.close();
    });

    it('should not insert duplicate baseline record on second call', () => {
      const mgr = new DatabaseManager(':memory:');
      mgr.initialize();
      mgr.initialize(); // second call is a no-op

      const db = mgr.getConnection();
      const rows = db.prepare('SELECT * FROM schema_migrations').all();
      expect(rows).toHaveLength(1);
      mgr.close();
    });

    it('should throw a descriptive error when the path is invalid', () => {
      // On most systems, a path to a non-existent directory that cannot be created
      // will cause better-sqlite3 to throw. We test that the error is wrapped.
      const invalidPath = path.join('/nonexistent-directory-12345', 'test.db');
      const mgr = new DatabaseManager(invalidPath);

      expect(() => mgr.initialize()).toThrow(/Failed to initialize database/);
    });

    it('should clean up internal state on initialization failure', () => {
      const invalidPath = path.join('/nonexistent-directory-12345', 'test.db');
      const mgr = new DatabaseManager(invalidPath);

      try {
        mgr.initialize();
      } catch {
        // Expected
      }

      // After failure, getConnection should throw because db is null
      expect(() => mgr.getConnection()).toThrow('Database not initialized');
    });
  });

  describe('getConnection()', () => {
    it('should throw if initialize() was not called', () => {
      const mgr = new DatabaseManager(':memory:');
      expect(() => mgr.getConnection()).toThrow('Database not initialized. Call initialize() first.');
    });

    it('should return the database instance after initialize()', () => {
      const mgr = new DatabaseManager(':memory:');
      mgr.initialize();
      const db = mgr.getConnection();
      expect(db).toBeDefined();
      expect(typeof db.prepare).toBe('function');
      mgr.close();
    });
  });

  describe('close()', () => {
    it('should close the database connection', () => {
      const mgr = new DatabaseManager(':memory:');
      mgr.initialize();
      mgr.close();

      expect(() => mgr.getConnection()).toThrow('Database not initialized');
    });

    it('should be safe to call close() without initialize()', () => {
      const mgr = new DatabaseManager(':memory:');
      expect(() => mgr.close()).not.toThrow();
    });

    it('should be safe to call close() multiple times', () => {
      const mgr = new DatabaseManager(':memory:');
      mgr.initialize();
      mgr.close();
      expect(() => mgr.close()).not.toThrow();
    });
  });

  describe('getPath()', () => {
    it('should return the path passed to the constructor', () => {
      const mgr = new DatabaseManager('/some/path.db');
      expect(mgr.getPath()).toBe('/some/path.db');
    });
  });
});
