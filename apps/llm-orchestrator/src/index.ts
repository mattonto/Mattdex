import { Router, createCors, error, json, withParams } from 'itty-router';
import { errorHandler } from './middleware/error-handler';
import { requireAuth } from './middleware/require-auth';
import { providersRouter } from './routes/providers';
import { routeHandler } from './routes/route';
import { fallbackHandler } from './routes/fallback';
import type { Env, RequestWithAuth } from './types';

const { preflight, corsify } = createCors({
  origins: ['*'],
  methods: ['GET', 'POST', 'OPTIONS'],
});

const router = Router<RequestWithAuth>({
  base: '/api',
});

// CORS preflight for all routes
router.all('*', preflight);

// Health check (no auth required)
router.get('/health', () => json({ status: 'ok', timestamp: Date.now() }));

// Public routes
router.get('/providers', requireAuth, providersRouter.fetch);

// Authenticated routes
router.post('/route', requireAuth, routeHandler);
router.post('/fallback', requireAuth, fallbackHandler);

// 404 catch-all
router.all('*', () => error(404, 'Not found'));

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    return router
      .handle(request, env, ctx)
      .then(corsify)
      .catch((err: unknown) => errorHandler(err, request));
  },
};
