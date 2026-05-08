// --------------------------------------------------------------------------
// Unit tests for src/config.ts
// --------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  MODEL_ROLE_MAP,
  FALLBACK_CHAINS,
  COST_WEIGHT,
  LATENCY_WEIGHT,
  CAPABILITY_WEIGHT,
  CONTEXT_CACHE_TTL_SECONDS,
  FALLBACK_QUEUE_NAME,
  ALL_MODEL_IDS,
  ALL_PROVIDERS,
  getFallbackChain,
  getRolesForModel,
} from '../config';

describe('config', () => {
  // ------------------------------------------------------------------------
  // AC: All configuration values are present and typed
  // ------------------------------------------------------------------------

  it('should export MODEL_ROLE_MAP as a non-empty object', () => {
    expect(MODEL_ROLE_MAP).toBeDefined();
    expect(typeof MODEL_ROLE_MAP).toBe('object');
    expect(Object.keys(MODEL_ROLE_MAP).length).toBeGreaterThan(0);
  });

  it('should export FALLBACK_CHAINS as a non-empty object', () => {
    expect(FALLBACK_CHAINS).toBeDefined();
    expect(typeof FALLBACK_CHAINS).toBe('object');
    expect(Object.keys(FALLBACK_CHAINS).length).toBeGreaterThan(0);
  });

  it('should export numeric weights that sum to 1.0', () => {
    const sum = COST_WEIGHT + LATENCY_WEIGHT + CAPABILITY_WEIGHT;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should export CONTEXT_CACHE_TTL_SECONDS as a positive integer', () => {
    expect(Number.isInteger(CONTEXT_CACHE_TTL_SECONDS)).toBe(true);
    expect(CONTEXT_CACHE_TTL_SECONDS).toBeGreaterThan(0);
  });

  it('should export FALLBACK_QUEUE_NAME as a non-empty string', () => {
    expect(typeof FALLBACK_QUEUE_NAME).toBe('string');
    expect(FALLBACK_QUEUE_NAME.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------------
  // AC: Route map includes at least one fallback chain
  // ------------------------------------------------------------------------

  it('should have at least one fallback chain with >= 2 entries', () => {
    const chains = Object.values(FALLBACK_CHAINS);
    const hasMultiEntryChain = chains.some((chain) => chain.length >= 2);
    expect(hasMultiEntryChain).toBe(true);
  });

  // ------------------------------------------------------------------------
  // Derived helpers
  // ------------------------------------------------------------------------

  describe('ALL_MODEL_IDS', () => {
    it('should contain every key from MODEL_ROLE_MAP', () => {
      expect(ALL_MODEL_IDS.sort()).toEqual(
        Object.keys(MODEL_ROLE_MAP).sort(),
      );
    });
  });

  describe('ALL_PROVIDERS', () => {
    it('should contain every key from FALLBACK_CHAINS', () => {
      expect(ALL_PROVIDERS.sort()).toEqual(
        Object.keys(FALLBACK_CHAINS).sort(),
      );
    });
  });

  describe('getFallbackChain', () => {
    it('should return the correct chain for a known model', () => {
      const chain = getFallbackChain('openai:gpt-4o');
      expect(chain).toEqual(['openai:gpt-4o', 'openai:gpt-4o-mini']);
    });

    it('should return an empty array for an unknown model', () => {
      const chain = getFallbackChain('unknown:model');
      expect(chain).toEqual([]);
    });

    it('should return an empty array for a model with no provider chain', () => {
      // If a model ID has a prefix not in FALLBACK_CHAINS
      const chain = getFallbackChain('nonexistent:foo');
      expect(chain).toEqual([]);
    });
  });

  describe('getRolesForModel', () => {
    it('should return roles for a known model', () => {
      const roles = getRolesForModel('openai:gpt-4o');
      expect(roles).toContain('reasoning');
      expect(roles).toContain('code_generation');
    });

    it('should return an empty array for an unknown model', () => {
      const roles = getRolesForModel('unknown:model');
      expect(roles).toEqual([]);
    });
  });

  // ------------------------------------------------------------------------
  // CI check: importing the config does not throw
  // ------------------------------------------------------------------------

  it('should be importable without throwing', () => {
    // This test itself verifies the import succeeded (no throw at module
    // evaluation time).  We re-assert the module is an object.
    expect(typeof require !== 'undefined' ? require('../config') : {}).toBeDefined();
  });
});
