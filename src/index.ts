import { Hono } from 'hono';
import { Env } from './types';
import { createModelPack, getModelPack } from './handlers/modelPacks';
import { requireSession } from './middleware/auth';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const app = new Hono<{ Bindings: Env }>();

// Middleware to initialize Drizzle client
app.use('*', async (c, next) => {
  if (!c.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    return c.json({ error: 'Internal server configuration error' }, 500);
  }
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  c.set('drizzle', db);
  await next();
});

// Health check route
app.get('/health', (c) => c.json({ status: 'ok' }));

// Model Pack Routes
const modelPacksRoutes = app.group('/model-packs');
modelPacksRoutes.post('/', requireSession, createModelPack);
modelPacksRoutes.get('/:modelPackId', requireSession, getModelPack);

export default app;
