import { Context } from 'hono';
import { requireApiKey } from '../middleware/auth';

export const handleT2 = async (c: Context) => {
  return c.json({ message: 'T2 handler' });
};

// Wrap with auth middleware
export const t2Handler = async (c: Context, next: Function) => {
  await requireApiKey(c, async () => {
    await handleT2(c);
  });
  await next();
};