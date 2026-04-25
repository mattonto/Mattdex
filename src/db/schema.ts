import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const modelPacks = pgTable('model_packs', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  models: jsonb('models').notNull().$type<Array<{ provider: string; model: string; config?: Record<string, unknown> }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type ModelPack = typeof modelPacks.$inferSelect;
export type NewModelPack = typeof modelPacks.$inferInsert;
