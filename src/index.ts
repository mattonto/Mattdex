import { Hono } from 'hono';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

app.post('/v1/chat/completions', async (c) => {
  const modelPackId = c.req.header('X-Model-Pack-Id');
  const role = c.req.header('X-Role');

  if (!modelPackId || !role) {
    return c.json({ error: 'Missing required headers' }, 400);
  }

  const doId = c.env.ROUTER_DO.idFromName(`${modelPackId}:${role}`);
  const doStub = c.env.ROUTER_DO.get(doId);
  const response = await doStub.fetch(c.req.url, c.req.clone());

  return response;
});

export default app;