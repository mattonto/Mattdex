import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanDirectory } from '../discovery';
import type { SymbolMap } from '../discovery';

// Mock fast-glob
vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(),
  },
}));

import fg from 'fast-glob';

const mockFgSync = fg.sync as ReturnType<typeof vi.fn>;

describe('scanDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return an empty map when no files are found', async () => {
    mockFgSync.mockReturnValue([]);
    const result = await scanDirectory('/some/empty/dir');
    expect(result).toEqual({});
  });

  it('should ignore .git and node_modules directories', async () => {
    mockFgSync.mockReturnValue([]);
    await scanDirectory('/any/path');
    const patterns = mockFgSync.mock.calls[0][0];
    expect(patterns).toContain('**/*.{ts,tsx,js,jsx,mjs,cjs}');
    const options = mockFgSync.mock.calls[0][1];
    expect(options.ignore).toContain('**/node_modules/**');
    expect(options.ignore).toContain('**/.git/**');
  });

  it('should extract function declarations', async () => {
    mockFgSync.mockReturnValue(['src/foo.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
function hello() {}
function greet(name: string) { return 'hi'; }
`);

    const result = await scanDirectory('/test');
    expect(result['hello']).toBe('src/foo.ts');
    expect(result['greet']).toBe('src/foo.ts');
  });

  it('should extract async function declarations', async () => {
    mockFgSync.mockReturnValue(['src/bar.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
async function fetchData() {}
export async function load() {}
`);

    const result = await scanDirectory('/test');
    expect(result['fetchData']).toBe('src/bar.ts');
    expect(result['load']).toBe('src/bar.ts');
  });

  it('should extract class declarations', async () => {
    mockFgSync.mockReturnValue(['src/models/user.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
class User {}
export class Admin extends User {}
`);

    const result = await scanDirectory('/test');
    expect(result['User']).toBe('src/models/user.ts');
    expect(result['Admin']).toBe('src/models/user.ts');
  });

  it('should extract import statements (default and named)', async () => {
    mockFgSync.mockReturnValue(['src/index.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
import { scanDirectory } from './discovery';
import fs from 'fs';
import type { SymbolMap } from './types';
`);

    const result = await scanDirectory('/test');
    expect(result['scanDirectory']).toBe('src/index.ts');
    expect(result['fs']).toBe('src/index.ts');
    // type imports should also be captured
    expect(result['SymbolMap']).toBe('src/index.ts');
  });

  it('should handle multiple files and merge results', async () => {
    mockFgSync.mockReturnValue(['src/a.ts', 'src/b.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile
      .mockResolvedValueOnce(`function alpha() {}`)
      .mockResolvedValueOnce(`function beta() {}`);

    const result = await scanDirectory('/test');
    expect(result['alpha']).toBe('src/a.ts');
    expect(result['beta']).toBe('src/b.ts');
  });

  it('should handle files with no extractable symbols', async () => {
    mockFgSync.mockReturnValue(['src/empty.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`// just a comment
const x = 1;
`);

    const result = await scanDirectory('/test');
    expect(result).toEqual({});
  });

  it('should handle read errors gracefully (skip file)', async () => {
    mockFgSync.mockReturnValue(['src/broken.ts', 'src/good.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(`function fine() {}`);

    const result = await scanDirectory('/test');
    expect(result['fine']).toBe('src/good.ts');
    expect(result['broken']).toBeUndefined();
  });

  it('should extract exported function declarations', async () => {
    mockFgSync.mockReturnValue(['src/utils.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
export function helper() {}
export default function main() {}
`);

    const result = await scanDirectory('/test');
    expect(result['helper']).toBe('src/utils.ts');
    expect(result['main']).toBe('src/utils.ts');
  });

  it('should extract exported class declarations', async () => {
    mockFgSync.mockReturnValue(['src/service.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
export class Service {}
export default class DefaultService {}
`);

    const result = await scanDirectory('/test');
    expect(result['Service']).toBe('src/service.ts');
    expect(result['DefaultService']).toBe('src/service.ts');
  });

  it('should handle re-exports (export from)', async () => {
    mockFgSync.mockReturnValue(['src/index.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
export { scanDirectory } from './discovery';
export { SymbolMap } from './types';
`);

    const result = await scanDirectory('/test');
    expect(result['scanDirectory']).toBe('src/index.ts');
    expect(result['SymbolMap']).toBe('src/index.ts');
  });

  it('should handle export * from (capture as re-export)', async () => {
    mockFgSync.mockReturnValue(['src/barrel.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
export * from './module';
export * as utils from './utils';
`);

    const result = await scanDirectory('/test');
    // export * from doesn't name specific symbols, but export * as does
    expect(result['utils']).toBe('src/barrel.ts');
  });

  it('should handle default exports of functions and classes', async () => {
    mockFgSync.mockReturnValue(['src/def.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
export default function() {}
export default class {}
`);

    const result = await scanDirectory('/test');
    // anonymous defaults have no name to extract
    expect(Object.keys(result).length).toBe(0);
  });

  it('should handle TypeScript type/interface exports', async () => {
    mockFgSync.mockReturnValue(['src/types.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
export interface User { name: string }
export type Status = 'active' | 'inactive';
`);

    const result = await scanDirectory('/test');
    expect(result['User']).toBe('src/types.ts');
    expect(result['Status']).toBe('src/types.ts');
  });

  it('should handle const exports (export const)', async () => {
    mockFgSync.mockReturnValue(['src/constants.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
export const API_URL = 'https://api.example.com';
export const MAX_RETRIES = 3;
`);

    const result = await scanDirectory('/test');
    expect(result['API_URL']).toBe('src/constants.ts');
    expect(result['MAX_RETRIES']).toBe('src/constants.ts');
  });

  it('should handle enum exports', async () => {
    mockFgSync.mockReturnValue(['src/enums.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
export enum Color { Red, Green, Blue }
`);

    const result = await scanDirectory('/test');
    expect(result['Color']).toBe('src/enums.ts');
  });

  it('should deduplicate by first occurrence when same symbol appears in multiple files', async () => {
    mockFgSync.mockReturnValue(['src/a.ts', 'src/b.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile
      .mockResolvedValueOnce(`function duplicate() {}`)
      .mockResolvedValueOnce(`function duplicate() {}`);

    const result = await scanDirectory('/test');
    // First file wins
    expect(result['duplicate']).toBe('src/a.ts');
  });

  it('should handle files with mixed content', async () => {
    mockFgSync.mockReturnValue(['src/mixed.ts']);
    const mockReadFile = vi.spyOn(require('fs/promises'), 'readFile');
    mockReadFile.mockResolvedValue(`
import { something } from './other';
import fs from 'fs';

function helper() {}

class Manager {}

export function run() {}
export class Runner {}
export const VERSION = '1.0';
`);

    const result = await scanDirectory('/test');
    expect(result['something']).toBe('src/mixed.ts');
    expect(result['fs']).toBe('src/mixed.ts');
    expect(result['helper']).toBe('src/mixed.ts');
    expect(result['Manager']).toBe('src/mixed.ts');
    expect(result['run']).toBe('src/mixed.ts');
    expect(result['Runner']).toBe('src/mixed.ts');
    expect(result['VERSION']).toBe('src/mixed.ts');
  });
});
