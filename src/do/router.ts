import { type DurableObject } from 'cloudflare:workers';
import { type RouterRequest } from '@autoengineering/shared';

export interface Env {
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
}

export class RouterDO implements DurableObject {
  private readonly env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    console.time('RouterDO.fetch.total');
    
    try {
      // Parse request body
      console.time('RouterDO.fetch.parseBody');
      const body = (await request.json()) as RouterRequest;
      console.timeEnd('RouterDO.fetch.parseBody');
      
      // Authenticate provider credentials
      console.time('RouterDO.fetch.auth');
      const providerKey = this.getProviderKey(body.provider);
      if (!providerKey) {
        return new Response('Unauthorized: Invalid provider', { status: 401 });
      }
      console.timeEnd('RouterDO.fetch.auth');
      
      // Dispatch to provider adapter would happen here
      // For now, we'll just return a success response with timing info
      console.timeEnd('RouterDO.fetch.total');
      return new Response(JSON.stringify({
        success: true,
        timings: {
          total: performance.now(), // Note: performance.now() not available in DOs, using console.time
          // In production, we'd collect these metrics properly
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.timeEnd('RouterDO.fetch.total');
      console.error('RouterDO.fetch error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  private getProviderKey(provider: string): string | null {
    switch (provider.toLowerCase()) {
      case 'openai':
        return this.env.OPENAI_API_KEY;
      case 'anthropic':
        return this.env.ANTHROPIC_API_KEY;
      case 'google':
        return this.env.GOOGLE_GENERATIVE_AI_API_KEY;
      default:
        return null;
    }
  }
}