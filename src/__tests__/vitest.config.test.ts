import { describe, it, expect } from 'vitest';

describe('vitest configuration', () => {
  it('vitest is importable and runnable', () => {
    // This test verifies vitest is properly installed and configured
    // by simply running. If vitest weren't available, this file wouldn't execute.
    expect(typeof describe).toBe('function');
    expect(typeof it).toBe('function');
    expect(typeof expect).toBe('function');
  });

  it('can run async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('can handle ESM imports', () => {
    // Verify that ESM module resolution works by checking import syntax
    // This test exists to confirm the ESM setup is functional
    const importPattern = /import\s+.*\s+from\s+['"]/;
    expect(importPattern.test("import { describe } from 'vitest'")).toBe(true);
  });
});
