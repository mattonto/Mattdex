import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('tsconfig.json', () => {
  const tsconfig = JSON.parse(
    readFileSync(resolve(__dirname, '../../tsconfig.json'), 'utf-8')
  ) as {
    compilerOptions?: Record<string, unknown>;
  };

  it('has strict mode enabled', () => {
    expect(tsconfig.compilerOptions?.strict).toBe(true);
  });

  it('has ESM module setting', () => {
    expect(tsconfig.compilerOptions?.module).toBe('ESNext');
  });

  it('has ESM moduleResolution (bundler)', () => {
    expect(tsconfig.compilerOptions?.moduleResolution).toBe('bundler');
  });

  it('has esModuleInterop enabled', () => {
    expect(tsconfig.compilerOptions?.esModuleInterop).toBe(true);
  });

  it('has isolatedModules enabled', () => {
    expect(tsconfig.compilerOptions?.isolatedModules).toBe(true);
  });

  it('has noEmit enabled', () => {
    expect(tsconfig.compilerOptions?.noEmit).toBe(true);
  });

  it('has strict additional flags', () => {
    expect(tsconfig.compilerOptions?.noUncheckedIndexedAccess).toBe(true);
    expect(tsconfig.compilerOptions?.noImplicitOverride).toBe(true);
    expect(tsconfig.compilerOptions?.forceConsistentCasingInFileNames).toBe(true);
  });
});
