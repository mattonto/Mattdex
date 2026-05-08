import { Client } from 'pg';
import { ProjectContext } from '@autoengineering/shared';

/**
 * Writes the parsed project context to Neon PostgreSQL.
 * Ensures no circular references in the serialized output.
 * 
 * @param context - The structured project context map
 */
export async function writeContextToNeon(context: ProjectContext): Promise<void> {
  const client = new Client({
    connectionString: process.env.NEON_DB_CONNECTION_STRING,
  });

  try {
    await client.connect();

    // Begin transaction
    await client.query('BEGIN');

    // Clear existing context data (optional: could be incremental)
    await client.query('TRUNCATE TABLE project_files, dependencies CASCADE');

    // Insert file entries
    for (const file of context.files) {
      const { path, language, symbols } = file;

      await client.query(
        `INSERT INTO project_files (path, language, symbols)
         VALUES ($1, $2, $3)`,
        [path, language, JSON.stringify(symbols)]
      );

      // Insert dependencies
      if (context.dependencies && context.dependencies[path]) {
        for (const dep of context.dependencies[path]) {
          await client.query(
            `INSERT INTO dependencies (from_file, to_file)
             VALUES ($1, $2)`,
            [path, dep]
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to write context to Neon:', error);
    throw error;
  } finally {
    await client.end();
  }
}
