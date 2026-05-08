import { Hono } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

// Define environment bindings
interface Env {
  DB: D1Database;
}

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// Health check route
app.get('/health', (c) => {
  return c.json({ status: 'ok' }, 200);
});

// Export the Hono app as the default fetch handler
export default app;
