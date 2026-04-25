import { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export interface Env {
  DB: D1Database;
  API_KEY: string;
  DATABASE_URL: string;
}

// Extend Hono's Env with Drizzle DB client
declare module 'hono' {
  interface ContextVariableMap {
    drizzle: NeonHttpDatabase<Record<string, never>>;
  }
}
