import { Context } from 'hono';

/**
 * Middleware that validates X-API-Key header against VALID_API_KEYS KV.
 * Returns 401 Unauthorized if key is missing or invalid.
 */
export const requireApiKey = async (c: Context, next: Function) => {
  const apiKey = c.req.header('X-API-Key');
  
  if (!apiKey) {
    return c.json({ error: 'Missing API key' }, 401);
  }

  // Check against VALID_API_KEYS KV
  const isValid = await c.env.VALID_API_KEYS.get(apiKey);
  if (!isValid) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  await next();
};