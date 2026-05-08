import { Hono } from 'hono';

export type Env = {
  PLAN_DB: D1Database;
  GIT_DLQ: Queue;
};

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ status: 'ok' }));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        // Git commit/push logic will be implemented here
        msg.ack();
      } catch (err) {
        console.error('Git operation failed', err);
        msg.retry();
      }
    }
  },
};
