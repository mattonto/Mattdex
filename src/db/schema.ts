import { sql } from 'kysely';

// Define the enum values for status
export const PendingDiffStatus = {
  STAGED: 'staged',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

type PendingDiffStatus = typeof PendingDiffStatus[keyof typeof PendingDiffStatus];

// Raw SQL for creating the pending_diffs table
export async function createPendingDiffsTable(db: any): Promise<void> {
  await db.schema
    .createTable('pending_diffs')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) => col.notNull())
    .addColumn('order', 'integer', (col) => col.notNull())
    .addColumn('diff_content', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => 
      col.notNull().check(sql`status IN ('staged', 'approved', 'rejected')`)
    )
    .addColumn('commit_sha', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();
}

// Raw SQL for dropping the table
export async function dropPendingDiffsTable(db: any): Promise<void> {
  await db.schema.dropTable('pending_diffs').ifExists().execute();
}