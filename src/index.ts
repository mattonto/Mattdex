import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ greeting: 'hello world' }, 200, {
    'Content-Type': 'application/json',
  });
});

export default app;
