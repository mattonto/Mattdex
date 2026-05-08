import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fanOut } from '../fan-out';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a provider that resolves after `delay` ms with the given value. */
function delayedProvider<T>(value: T, delay: number): () => Promise<T> {
  return () =>
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(value), delay);
    });
}

/** Creates a provider that rejects after `delay` ms with the given reason. */
function failingProvider(reason: string, delay: number): () => Promise<never> {
  return () =>
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(reason)), delay);
    });
}

/** Creates a provider that never settles (used to test timeout / cancellation). */
function hangingProvider(): () => Promise<never> {
  return () => new Promise<never>(() => {}); // never resolves or rejects
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fanOut', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // AC5 – Happy path: first resolved provider wins
  // -----------------------------------------------------------------------
  it('AC5: returns the result of the fastest provider when all succeed', async () => {
    const fast = delayedProvider('fast-result', 10);
    const slow = delayedProvider('slow-result', 100);

    const promise = fanOut([fast, slow]);

    // Advance just enough for the fast provider to resolve
    await vi.advanceTimersByTimeAsync(20);

    await expect(promise).resolves.toBe('fast-result');
  });

  // -----------------------------------------------------------------------
  // AC5 – First resolution wins even if others would fail later
  // -----------------------------------------------------------------------
  it('AC5: returns the first resolved value even when slower providers would fail', async () => {
    const fast = delayedProvider('early-bird', 10);
    const slow = failingProvider('too-late', 200);

    const promise = fanOut([fast, slow]);

    await vi.advanceTimersByTimeAsync(20);

    await expect(promise).resolves.toBe('early-bird');
  });

  // -----------------------------------------------------------------------
  // AC5 – All providers fail → reject with AggregateError
  // -----------------------------------------------------------------------
  it('AC5: rejects with an AggregateError when every provider fails', async () => {
    const a = failingProvider('err-a', 10);
    const b = failingProvider('err-b', 20);

    const promise = fanOut([a, b]);

    await vi.advanceTimersByTimeAsync(30);

    await expect(promise).rejects.toThrow(AggregateError);
    await expect(promise).rejects.toHaveProperty('errors');
    const caught = await promise.catch((e: AggregateError) => e);
    expect(caught.errors).toHaveLength(2);
    expect(caught.errors[0]).toBeInstanceOf(Error);
    expect(caught.errors[1]).toBeInstanceOf(Error);
  });

  // -----------------------------------------------------------------------
  // R5 – 55-second timeout guardrail via AbortController
  // -----------------------------------------------------------------------
  it('R5: rejects with a timeout error when no provider resolves within 55 seconds', async () => {
    const slow = delayedProvider('too-slow', 60_000); // 60 s > 55 s

    const promise = fanOut([slow]);

    // Advance to just before the timeout – should still be pending
    await vi.advanceTimersByTimeAsync(54_000);

    // Advance past the 55 s boundary
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(promise).rejects.toThrow('Fan-out timed out after 55s');
  });

  it('R5: does NOT timeout when a provider resolves just before the 55s limit', async () => {
    const justInTime = delayedProvider('just-in-time', 54_900);

    const promise = fanOut([justInTime]);

    await vi.advanceTimersByTimeAsync(55_000);

    await expect(promise).resolves.toBe('just-in-time');
  });

  // -----------------------------------------------------------------------
  // R5 – AbortController cancels slower requests
  // -----------------------------------------------------------------------
  it('R5: cancels slower requests via AbortController when a faster one wins', async () => {
    const abortSpy = vi.fn();

    const cancellableProvider = (signal: AbortSignal) => () =>
      new Promise<string>((resolve, reject) => {
        // Register the abort listener so we can spy on it
        signal.addEventListener('abort', () => {
          abortSpy();
          reject(new DOMException('Aborted', 'AbortError'));
        });

        // Never resolve on its own – only the abort can settle it
      });

    const fast = delayedProvider('winner', 10);
    const slow = cancellableProvider;

    const promise = fanOut([fast, slow]);

    await vi.advanceTimersByTimeAsync(20);

    await expect(promise).resolves.toBe('winner');

    // The slower provider should have been aborted
    expect(abortSpy).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Edge: empty provider list
  // -----------------------------------------------------------------------
  it('rejects with an error when the provider list is empty', async () => {
    await expect(fanOut([])).rejects.toThrow('At least one provider is required');
  });

  // -----------------------------------------------------------------------
  // Edge: single provider
  // -----------------------------------------------------------------------
  it('resolves with the single provider result when only one is given', async () => {
    const single = delayedProvider('only-one', 10);

    const promise = fanOut([single]);

    await vi.advanceTimersByTimeAsync(20);

    await expect(promise).resolves.toBe('only-one');
  });

  // -----------------------------------------------------------------------
  // Edge: provider that throws synchronously
  // -----------------------------------------------------------------------
  it('handles a provider that throws synchronously without crashing', async () => {
    const syncThrower = () => {
      throw new Error('sync-fail');
    };
    const fast = delayedProvider('ok', 10);

    const promise = fanOut([syncThrower, fast]);

    await vi.advanceTimersByTimeAsync(20);

    await expect(promise).resolves.toBe('ok');
  });

  // -----------------------------------------------------------------------
  // Edge: provider that returns a non-promise value
  // -----------------------------------------------------------------------
  it('handles a provider that returns a plain value (not a promise)', async () => {
    const plainProvider = () => 'plain-value' as const;
    const slow = delayedProvider('slow', 100);

    const promise = fanOut([plainProvider, slow]);

    // plainProvider resolves synchronously
    await vi.advanceTimersByTimeAsync(1);

    await expect(promise).resolves.toBe('plain-value');
  });

  // -----------------------------------------------------------------------
  // Edge: all providers hang → timeout
  // -----------------------------------------------------------------------
  it('rejects with timeout when all providers hang indefinitely', async () => {
    const promise = fanOut([hangingProvider(), hangingProvider()]);

    await vi.advanceTimersByTimeAsync(56_000);

    await expect(promise).rejects.toThrow('Fan-out timed out after 55s');
  });
});
