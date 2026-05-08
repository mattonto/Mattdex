import { Context } from 'hono';
import { requireApiKey } from '../middleware/auth';

export const handleT3 = async (c: Context) => {
  return c.json({ message: 'T3 handler' });
};

// Wrap with auth middleware
export const t3Handler = async (c: Context, next: Function) => {
  await requireApiKey(c, async () => {
    await handleT3(c);
  });
  await next();
};