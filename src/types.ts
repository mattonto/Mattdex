export interface Env {
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  // Add other environment variables as needed by your application
  // For example, if you have a Drizzle DB client:
  // DB: DrizzleD1Database;
  // If you have a KV namespace:
  // MY_KV_NAMESPACE: KVNamespace;
}
