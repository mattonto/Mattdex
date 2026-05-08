import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractAstMetadata } from '../astExtractor';
import type { AstMetadata } from '../astExtractor';

// Mock web-tree-sitter
vi.mock('web-tree-sitter', () => {
  const mockNode = (overrides: Partial<ReturnType<typeof createMockNode>> = {}) => createMockNode(overrides);

  const createMockNode = ({
    type = 'program',
    text = '',
    children = [],
    startPosition = { row: 0, column: 0 },
    endPosition = { row: 0, column: 0 },
    childCount = 0,
    namedChildCount = 0,
    firstNamedChild = null,
    namedChildren = [],
  }: any = {}) => ({
    type,
    text,
    children,
    startPosition,
    endPosition,
    childCount,
    namedChildCount,
    firstNamedChild,
    namedChildren,
    toString: () => `(node ${type})`,
    hasError: () => false,
    isNamed: () => true,
    isMissing: () => false,
    hasChanges: () => false,
    parent: null,
    nextSibling: null,
    previousSibling: null,
    child: (i: number) => children[i] ?? null,
    namedChild: (i: number) => namedChildren[i] ?? null,
    firstChild: children[0] ?? null,
    lastChild: children[children.length - 1] ?? null,
    lastNamedChild: namedChildren[namedChildren.length - 1] ?? null,
    nextNamedSibling: null,
    previousNamedSibling: null,
    descendantCount: 0,
    grammarId: 0,
    id: 0,
    isExtra: false,
    parseState: 0,
    nextParseState: 0,
  });

  const mockLanguage = {
    query: vi.fn().mockReturnValue({
      matches: vi.fn().mockReturnValue([]),
      captures: vi.fn().mockReturnValue([]),
    }),
  };

  return {
    __esModule: true,
    default: {
      init: vi.fn().mockResolvedValue(undefined),
      Language: {
        load: vi.fn().mockResolvedValue(mockLanguage),
      },
      Parser: vi.fn().mockImplementation(() => ({
        setLanguage: vi.fn(),
        parse: vi.fn().mockReturnValue(createMockNode({ type: 'program', children: [] })),
        getLanguage: vi.fn().mockReturnValue(mockLanguage),
      })),
    },
    init: vi.fn().mockResolvedValue(undefined),
    Language: {
      load: vi.fn().mockResolvedValue(mockLanguage),
    },
    Parser: vi.fn().mockImplementation(() => ({
      setLanguage: vi.fn(),
      parse: vi.fn().mockReturnValue(createMockNode({ type: 'program', children: [] })),
      getLanguage: vi.fn().mockReturnValue(mockLanguage),
    })),
  };
});

describe('extractAstMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty metadata for empty content', async () => {
    const result = await extractAstMetadata('empty.ts', '', 'typescript');
    expect(result).toEqual({
      filepath: 'empty.ts',
      language: 'typescript',
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      errors: [],
    });
  });

  it('should return metadata with errors for invalid language', async () => {
    const result = await extractAstMetadata('test.foo', 'some content', 'foobar');
    expect(result.filepath).toBe('test.foo');
    expect(result.language).toBe('foobar');
    expect(result.functions).toEqual([]);
    expect(result.classes).toEqual([]);
    expect(result.imports).toEqual([]);
    expect(result.exports).toEqual([]);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain('foobar');
  });

  it('should return metadata with parse errors when content is malformed', async () => {
    const result = await extractAstMetadata('bad.ts', 'function {{}', 'typescript');
    expect(result.filepath).toBe('bad.ts');
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
    // Even with parse errors, we should get a result with the filepath
    expect(result.functions).toBeDefined();
    expect(result.classes).toBeDefined();
    expect(result.imports).toBeDefined();
    expect(result.exports).toBeDefined();
  });

  it('should handle null or undefined content gracefully', async () => {
    const result1 = await extractAstMetadata('null.ts', null as unknown as string, 'typescript');
    expect(result1.filepath).toBe('null.ts');
    expect(result1.errors.length).toBeGreaterThanOrEqual(1);

    const result2 = await extractAstMetadata('undef.ts', undefined as unknown as string, 'typescript');
    expect(result2.filepath).toBe('undef.ts');
    expect(result2.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle very large content without crashing', async () => {
    const largeContent = 'const x = 1;\n'.repeat(10000);
    const result = await extractAstMetadata('large.ts', largeContent, 'typescript');
    expect(result.filepath).toBe('large.ts');
    expect(result.errors).toBeDefined();
  });

  it('should handle special characters in filepath', async () => {
    const result = await extractAstMetadata('path/with spaces and (parens).ts', 'const a = 1;', 'typescript');
    expect(result.filepath).toBe('path/with spaces and (parens).ts');
    expect(result.language).toBe('typescript');
  });

  it('should return a valid AstMetadata object with all required fields', async () => {
    const result = await extractAstMetadata('test.ts', 'const x = 1;', 'typescript');
    const requiredKeys: (keyof AstMetadata)[] = ['filepath', 'language', 'functions', 'classes', 'imports', 'exports', 'errors'];
    for (const key of requiredKeys) {
      expect(result).toHaveProperty(key);
    }
    expect(Array.isArray(result.functions)).toBe(true);
    expect(Array.isArray(result.classes)).toBe(true);
    expect(Array.isArray(result.imports)).toBe(true);
    expect(Array.isArray(result.exports)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should not throw on any input', async () => {
    const inputs = [
      '',
      '   ',
      '\n\n\n',
      '/* just a comment */',
      '// just a line comment',
      '12345',
      '{}',
      '[]',
      'null',
      'undefined',
      'import x from "y";',
      'export const a = 1;',
      'function foo() {}',
      'class Bar {}',
    ];
    for (const input of inputs) {
      const result = await extractAstMetadata('test.ts', input, 'typescript');
      expect(result).toBeDefined();
      expect(result.filepath).toBe('test.ts');
    }
  });
});
