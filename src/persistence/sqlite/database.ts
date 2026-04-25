import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export interface Env {
  PLANDEX_SQLITE_PATH?: string;
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Initializes and returns a Drizzle ORM client for SQLite.
 * Uses a singleton pattern to ensure only one database connection is active.
 * Tables 'plan_state' and 'conversation_history' are created if they do not exist.
 * The database file path is configured via the PLANDEX_SQLITE_PATH environment variable.
 * @param env The environment object containing PLANDEX_SQLITE_PATH.
 * @returns The Drizzle ORM client instance.
 * @throws Error if PLANDEX_SQLITE_PATH is not set.
 */
export function initializeDb(env: Env) {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = env.PLANDEX_SQLITE_PATH;
  if (!dbPath) {
    throw new Error('PLANDEX_SQLITE_PATH environment variable is not set.');
  }

  const sqlite = new Database(dbPath);

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS plan_state (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversation_history (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);

  dbInstance = drizzle(sqlite, { schema });
  return dbInstance;
}

/**
 * Closes the underlying better-sqlite3 database connection.
 * This function is primarily for testing purposes to ensure a clean state between tests.
 * In a typical Cloudflare Worker, the database connection would persist for the worker's lifetime.
 */
export function closeDb() {
  if (dbInstance) {
    // Drizzle client does not directly expose the underlying better-sqlite3 instance.
    // This is a workaround for testing cleanup.
    const sqlite = (dbInstance as any).client.db;
    if (sqlite && typeof sqlite.close === 'function') {
      sqlite.close();
    }
    dbInstance = null;
  }
}
