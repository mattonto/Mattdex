import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('package.json', () => {
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    type?: string;
  };

  it('has all required dependencies', () => {
    const requiredDeps = ['uuid', 'isomorphic-git', 'deep-diff', 'hono'];
    for (const dep of requiredDeps) {
      expect(pkg.dependencies).toHaveProperty(dep);
    }
  });

  it('has vitest as a devDependency', () => {
    expect(pkg.devDependencies).toHaveProperty('vitest');
  });

  it('has a dev script', () => {
    expect(pkg.scripts).toHaveProperty('dev');
  });

  it('has a test script', () => {
    expect(pkg.scripts).toHaveProperty('test');
  });

  it('has a build script', () => {
    expect(pkg.scripts).toHaveProperty('build');
  });

  it('is ESM (type: module)', () => {
    expect(pkg.type).toBe('module');
  });
});
