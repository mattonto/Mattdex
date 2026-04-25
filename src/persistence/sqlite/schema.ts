import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const conversationHistories = sqliteTable('conversation_histories', {
  id: text('id').primaryKey(),
  data: text('data').notNull()
});

// Assuming plan_states might also exist based on context from project knowledge
export const planStates = sqliteTable('plan_states', {
  id: text('id').primaryKey(),
  data: text('data').notNull()
});
