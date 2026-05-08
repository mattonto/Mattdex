import Database from 'better-sqlite3';
import { accessSync, constants, mkdirSync, dirname } from 'node:fs';
import path from 'node:path';

/**
 * Configuration for creating or opening a SQLite database.
 */
export interface DatabaseConfig {
  /** Filesystem path to the SQLite database file. */
  path: string;
  /** If true, open the database in read-only mode. Defaults to false. */
  readonly?: boolean;
  /** If true, enable WAL journal mode for better concurrent read performance. Defaults to false. */
  walMode?: boolean;
}

/**
 * Handle returned by {@link createDatabase}, wrapping the underlying better-sqlite3 instance.
 */
export interface DatabaseHandle {
  /** The underlying better-sqlite3 Database instance. */
  db: Database.Database;
}

/**
 * Creates (or opens) a SQLite database at the given path.
 *
 * - If the file does not exist, it is created (including parent directories).
 * - If the file already exists, it is opened (not recreated).
 * - Validates that the path is writable before opening.
 * - Optionally enables WAL journal mode.
 *
 * @param config - Database configuration.
 * @returns A {@link DatabaseHandle} wrapping the opened database.
 * @throws {Error} If the path is not writable or the database cannot be opened.
 */
export function createDatabase(config: DatabaseConfig): DatabaseHandle {
  const dbPath = path.resolve(config.path);

  // Ensure the parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  // Validate that the path is writable
  // If the file already exists, check write permission on the file.
  // If it doesn't exist, check write permission on the parent directory.
  try {
    accessSync(dbPath, constants.W_OK);
  } catch {
    // File doesn't exist yet — check parent directory writability
    try {
      accessSync(dirname(dbPath), constants.W_OK);
    } catch {
      throw new Error(
        `Cannot create database at "${dbPath}": path is not writable`
      );
    }
  }

  const db = new Database(dbPath, {
    readonly: config.readonly ?? false,
  });

  // Enable WAL mode if requested (only makes sense for read-write databases)
  if (config.walMode && !config.readonly) {
    db.pragma('journal_mode = WAL');
  }

  // Enable foreign keys by default for referential integrity
  db.pragma('foreign_keys = ON');

  return { db };
}
