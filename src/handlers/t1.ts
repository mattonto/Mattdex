import { Context } from 'hono';
import { requireApiKey } from '../middleware/auth';

export const handleT1 = async (c: Context) => {
  return c.json({ message: 'T1 handler' });
};

// Wrap with auth middleware
export const t1Handler = async (c: Context, next: Function) => {
  await requireApiKey(c, async () => {
    await handleT1(c);
  });
  await next();
};