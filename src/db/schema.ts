import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const modelPacks = pgTable('model_packs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  config: jsonb('config').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdate(() => sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ModelPack = typeof modelPacks.$inferSelect;
export type NewModelPack = typeof modelPacks.$inferInsert;
