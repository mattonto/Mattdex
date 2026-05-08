import { sql } from 'drizzle-orm';
import { integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const sandboxStateTable = pgTable('sandbox_state', {
  id: text('id').notNull().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().default(sql`now()`),
  originalChecksum: text('original_checksum').notNull(),
  cumulativeHash: text('cumulative_hash').notNull(),
  checkpointBeforeApply: text('checkpoint_before_apply').notNull(),
});

export const stagedDiffsTable = pgTable('staged_diffs', {
  id: text('id').notNull().primaryKey(),
  sandboxId: text('sandbox_id')
    .notNull()
    .references(() => sandboxStateTable.id, { onDelete: 'cascade' }),
  patchHash: text('patch_hash').notNull(),
  diffText: text('diff_text').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true, precision: 6 }),
  r2Version: text('r2_version').notNull(),
});

// Index for foreign key lookups
export const stagedDiffsSandboxIdIdx = index('staged_diffs_sandbox_id_idx').on(
  stagedDiffsTable.sandboxId
);
