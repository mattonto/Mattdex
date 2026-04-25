import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const planState = sqliteTable('plan_state', {
  id: text('id').primaryKey(),
  data: text('data').notNull()
});

export const conversationHistory = sqliteTable('conversation_history', {
  id: text('id').primaryKey(),
  data: text('data').notNull()
});
