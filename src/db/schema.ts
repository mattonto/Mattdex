import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const modelPacks = sqliteTable('model_packs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(), // 'openai', 'anthropic', 'google'
  modelName: text('model_name').notNull(), // 'gpt-4o', 'claude-sonnet', 'gemini-pro'
  apiKeyEnvVar: text('api_key_env_var').notNull(), // 'OPENAI_API_KEY'
  maxTokens: integer('max_tokens').notNull(),
  temperature: real('temperature').notNull(), // 0.0 - 1.0
});
