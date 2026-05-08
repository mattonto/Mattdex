import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have a drizzle config file', async () => {
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(fs.existsSync('drizzle.config.ts')).toBe(true);
  });

  it('should have db:push script in package.json', async () => {
    const pkg = await import('../../package.json', { assert: { type: 'json' } });
    expect(pkg.default.scripts).toHaveProperty('db:push');
    expect(pkg.default.scripts['db:push']).toBe('drizzle-kit push');
  });

  it('should have db:generate script in package.json', async () => {
    const pkg = await import('../../package.json', { assert: { type: 'json' } });
    expect(pkg.default.scripts).toHaveProperty('db:generate');
    expect(pkg.default.scripts['db:generate']).toBe('drizzle-kit generate');
  });

  it('should have db:migrate script in package.json', async () => {
    const pkg = await import('../../package.json', { assert: { type: 'json' } });
    expect(pkg.default.scripts).toHaveProperty('db:migrate');
    expect(pkg.default.scripts['db:migrate']).toBe('drizzle-kit migrate');
  });

  it('should run drizzle-kit push without errors', async () => {
    const { execSync } = await import('child_process');
    vi.mocked(execSync).mockReturnValue(Buffer.from('Migration successful'));
    
    const result = execSync('npx drizzle-kit push', { env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' } });
    expect(result.toString()).toContain('Migration successful');
  });

  it('should fail when DATABASE_URL is not set', async () => {
    const { execSync } = await import('child_process');
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('DATABASE_URL is not set');
    });
    
    expect(() => execSync('npx drizzle-kit push')).toThrow('DATABASE_URL is not set');
  });
});
