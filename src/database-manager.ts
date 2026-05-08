import Database from 'better-sqlite3';

/**
 * Manages a SQLite database connection with schema versioning support.
 *
 * Uses better-sqlite3 (synchronous) for local persistence.
 * The database file is created lazily on first use via initialize().
 * In-memory mode is supported by passing ':memory:' as the path.
 */
export class DatabaseManager {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  /**
   * @param dbPath - Path to the SQLite database file, or ':memory:' for in-memory mode.
   */
  constructor(dbPath: string) {
    if (!dbPath || (typeof dbPath !== 'string')) {
      throw new Error('Database path must be a non-empty string');
    }
    this.dbPath = dbPath;
  }

  /**
   * Opens the database connection and ensures the schema_migrations table exists.
   *
   * - If the file does not exist, it is created.
   * - If the schema_migrations table does not exist, it is created.
   * - A baseline migration record ('V0__baseline') is inserted if no records exist.
   *
   * Calling initialize() more than once is safe — subsequent calls are no-ops
   * if the database is already open.
   */
  initialize(): void {
    if (this.db) {
      return; // Already initialized
    }

    try {
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrent read performance
      this.db.pragma('journal_mode = WAL');

      // Create the schema_migrations table if it does not exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INTEGER PRIMARY KEY,
          version TEXT NOT NULL,
          applied_at TEXT NOT NULL
        )
      `);

      // Insert a baseline migration record if the table is empty
      const rowCount = this.db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as { count: number };
      if (rowCount.count === 0) {
        const now = new Date().toISOString();
        this.db
          .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
          .run('V0__baseline', now);
      }
    } catch (err) {
      // Clean up on failure so a subsequent retry can re-attempt
      this.db = null;
      throw new Error(
        `Failed to initialize database at "${this.dbPath}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Returns the underlying better-sqlite3 Database instance.
   * Throws if initialize() has not been called yet.
   */
  getConnection(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Closes the database connection and releases resources.
   * Safe to call even if the database is not open.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Returns the path used to open the database.
   */
  getPath(): string {
    return this.dbPath;
  }
}
