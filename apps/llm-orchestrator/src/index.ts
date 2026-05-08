import { Hono } from 'hono';
import { handleTaskRouting } from './handlers/routing';
import { handleFallback } from './handlers/fallback';
import { getProviders } from './handlers/providers';

const app = new Hono<{ Bindings: Env }>();

// GET /providers - Return list of available LLM providers
app.get('/providers', getProviders);

// POST /route - Main entry point for task routing
app.post('/route', handleTaskRouting);

// POST /fallback - Webhook for failed sync calls
app.post('/fallback', handleFallback);

export default app;