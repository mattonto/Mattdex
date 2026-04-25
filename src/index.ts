import { Hono } from 'hono';
import { llmRequestsApp } from './handlers/llmRequests';

export type Env = {
  // Add any environment variables or bindings here
  // For this task, LLMRouterService is instantiated directly, not bound.
};

const app = new Hono<{ Bindings: Env }>();

// Mount the LLM requests handler under the /llm path
app.route('/llm', llmRequestsApp);

app.get('/', (c) => {
  return c.text('Autoengineering LLM API is running!');
});

export default app;
