import { describe, it, expect } from 'vitest';
import {
  MODEL_ROLE_MAP,
  PROVIDER_FALLBACK_CHAINS,
  SCORING_WEIGHTS,
  CONTEXT_CACHE_TTL_SECONDS,
  QUEUE_CONFIG,
} from '../config';

describe('config', () => {
  // -----------------------------------------------------------------------
  // MODEL_ROLE_MAP
  // -----------------------------------------------------------------------
  describe('MODEL_ROLE_MAP', () => {
    it('maps known model IDs to valid roles', () => {
      const entries = Object.entries(MODEL_ROLE_MAP);
      expect(entries.length).toBeGreaterThan(0);

      const validRoles = ['primary_generation', 'fast_generation', 'reasoning', 'classification'];
      for (const [, role] of entries) {
        expect(validRoles).toContain(role);
      }
    });

    it('includes at least one model per role', () => {
      const roles = new Set(Object.values(MODEL_ROLE_MAP));
      expect(roles.has('primary_generation')).toBe(true);
      expect(roles.has('fast_generation')).toBe(true);
      expect(roles.has('reasoning')).toBe(true);
      expect(roles.has('classification')).toBe(true);
    });

    it('is frozen (immutable)', () => {
      expect(() => {
        (MODEL_ROLE_MAP as Record<string, string>)['new-model'] = 'primary_generation';
      }).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // PROVIDER_FALLBACK_CHAINS
  // -----------------------------------------------------------------------
  describe('PROVIDER_FALLBACK_CHAINS', () => {
    it('defines a fallback chain for every known provider', () => {
      const providers = ['openai', 'anthropic', 'google', 'deepseek'];
      for (const p of providers) {
        expect(PROVIDER_FALLBACK_CHAINS[p]).toBeDefined();
        expect(PROVIDER_FALLBACK_CHAINS[p].fallbacks.length).toBeGreaterThan(0);
      }
    });

    it('has the primary model as the first fallback entry', () => {
      // For openai, the first fallback should be 'gpt-4o'
      expect(PROVIDER_FALLBACK_CHAINS.openai.fallbacks[0]).toBe('gpt-4o');
      expect(PROVIDER_FALLBACK_CHAINS.anthropic.fallbacks[0]).toBe('claude-sonnet-4-20250514');
      expect(PROVIDER_FALLBACK_CHAINS.google.fallbacks[0]).toBe('gemini-2.5-pro');
      expect(PROVIDER_FALLBACK_CHAINS.deepseek.fallbacks[0]).toBe('deepseek-reasoner');
    });

    it('is frozen (immutable)', () => {
      expect(() => {
        (PROVIDER_FALLBACK_CHAINS as Record<string, unknown>)['new-provider'] = { provider: 'new', fallbacks: [] };
      }).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // SCORING_WEIGHTS
  // -----------------------------------------------------------------------
  describe('SCORING_WEIGHTS', () => {
    it('has all four weight fields defined', () => {
      expect(SCORING_WEIGHTS.cost).toBeTypeOf('number');
      expect(SCORING_WEIGHTS.latency).toBeTypeOf('number');
      expect(SCORING_WEIGHTS.quality).toBeTypeOf('number');
      expect(SCORING_WEIGHTS.availability).toBeTypeOf('number');
    });

    it('weights sum to 1.0', () => {
      const sum = SCORING_WEIGHTS.cost + SCORING_WEIGHTS.latency + SCORING_WEIGHTS.quality + SCORING_WEIGHTS.availability;
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('is frozen (immutable)', () => {
      expect(() => {
        (SCORING_WEIGHTS as Record<string, number>).cost = 0.5;
      }).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // CONTEXT_CACHE_TTL_SECONDS
  // -----------------------------------------------------------------------
  describe('CONTEXT_CACHE_TTL_SECONDS', () => {
    it('is a positive integer', () => {
      expect(CONTEXT_CACHE_TTL_SECONDS).toBeGreaterThan(0);
      expect(Number.isInteger(CONTEXT_CACHE_TTL_SECONDS)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // QUEUE_CONFIG
  // -----------------------------------------------------------------------
  describe('QUEUE_CONFIG', () => {
    it('has a non-empty queue name', () => {
      expect(QUEUE_CONFIG.queueName.length).toBeGreaterThan(0);
    });

    it('has positive retry settings', () => {
      expect(QUEUE_CONFIG.maxRetries).toBeGreaterThan(0);
      expect(QUEUE_CONFIG.retryDelaySeconds).toBeGreaterThan(0);
    });

    it('is frozen (immutable)', () => {
      expect(() => {
        (QUEUE_CONFIG as Record<string, unknown>).queueName = 'hacked';
      }).toThrow();
    });
  });
});
