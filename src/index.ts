import { Router } from 'itty-router';

export interface Env {
  // Example binding: MY_KV_NAMESPACE: KVNamespace;
}

const router = Router();

router.get('/', () => new Response('LLM Integration Service is running!'));

router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return router.handle(request, env, ctx);
  },
};
