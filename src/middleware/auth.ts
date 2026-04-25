import { Context, Next } from 'hono';
import { Env } from '../types';

export async function requireSession(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  // In a real application, validate the token (e.g., against a session store, JWT verification)
  // For this task, we'll use a simple check against an environment variable for demonstration.
  // This is NOT secure for production and should be replaced with proper session/token validation.
  if (token !== c.env.API_KEY) {
    return c.json({ error: 'Invalid API Key' }, 401);
  }

  await next();
}
