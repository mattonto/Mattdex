import { Context } from 'hono';
import { KVNamespace } from '@cloudflare/workers-types';

// Pricing in USD per 1,000 tokens
const PRICING = {
  OPENAI: { input: 0.005, output: 0.015 }, // gpt-4o
  ANTHROPIC: { input: 0.003, output: 0.015 }, // claude-3-haiku
};

export type CostEntry = {
  requestId: string;
  provider: 'OPENAI' | 'ANTHROPIC';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: number;
};

export class CostTracker {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async log(
    requestId: string,
    provider: 'OPENAI' | 'ANTHROPIC',
    model: string,
    inputTokens: number,
    outputTokens: number,
    ctx: Context
  ): Promise<void> {
    const inputCost = (inputTokens / 1000) * PRICING[provider].input;
    const outputCost = (outputTokens / 1000) * PRICING[provider].output;
    const totalCost = inputCost + outputCost;

    const entry: CostEntry = {
      requestId,
      provider,
      model,
      inputTokens,
      outputTokens,
      costUsd: Number(totalCost.toFixed(6)), // sub-cent precision
      timestamp: Date.now(),
    };

    try {
      await this.kv.put(`cost:${requestId}`, JSON.stringify(entry));
    } catch (error) {
      // Log to console but do not throw
      ctx.executionCtx.waitUntil(
        Promise.resolve().then(async () => {
          // Best effort logging
          console.error('Failed to log cost:', error);
        })
      );
    }
  }
}