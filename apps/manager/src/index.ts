import { Hono } from 'hono';

export type Env = {
  PLAN_SUPERVISOR: Fetcher;
  PLAN_DB: D1Database;
  GIT_QUEUE: Queue;
};

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ status: 'ok' }));

export default {
  fetch: app.fetch,
};
