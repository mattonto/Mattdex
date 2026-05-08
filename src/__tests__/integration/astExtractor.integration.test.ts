import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractAstMetadata } from '../../astExtractor';

// Mock web-tree-sitter for integration tests
vi.mock('web-tree-sitter', () => {
  const createMockNode = (overrides: any = {}) => ({
    type: overrides.type ?? 'program',
    text: overrides.text ?? '',
    children: overrides.children ?? [],
    startPosition: overrides.startPosition ?? { row: 0, column: 0 },
    endPosition: overrides.endPosition ?? { row: 0, column: 0 },
    childCount: overrides.children?.length ?? 0,
    namedChildCount: overrides.namedChildren?.length ?? 0,
    firstNamedChild: overrides.firstNamedChild ?? null,
    namedChildren: overrides.namedChildren ?? [],
    toString: () => `(node ${overrides.type ?? 'program'})`,
    hasError: () => false,
    isNamed: () => true,
    isMissing: () => false,
    hasChanges: () => false,
    parent: null,
    nextSibling: null,
    previousSibling: null,
    child: (i: number) => (overrides.children ?? [])[i] ?? null,
    namedChild: (i: number) => (overrides.namedChildren ?? [])[i] ?? null,
    firstChild: (overrides.children ?? [])[0] ?? null,
    lastChild: (overrides.children ?? [])[(overrides.children ?? []).length - 1] ?? null,
    lastNamedChild: (overrides.namedChildren ?? [])[(overrides.namedChildren ?? []).length - 1] ?? null,
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

describe('extractAstMetadata Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle TypeScript content with functions', async () => {
    const content = `
function greet(name: string): string {
  return "Hello, " + name;
}

const add = (a: number, b: number): number => a + b;
`;
    const result = await extractAstMetadata('greet.ts', content, 'typescript');
    expect(result.filepath).toBe('greet.ts');
    expect(result.language).toBe('typescript');
    expect(Array.isArray(result.functions)).toBe(true);
    expect(Array.isArray(result.classes)).toBe(true);
    expect(Array.isArray(result.imports)).toBe(true);
    expect(Array.isArray(result.exports)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should handle TypeScript content with classes', async () => {
    const content = `
class Animal {
  constructor(public name: string) {}
  speak(): void {
    console.log(this.name);
  }
}
`;
    const result = await extractAstMetadata('animal.ts', content, 'typescript');
    expect(result.filepath).toBe('animal.ts');
    expect(result.language).toBe('typescript');
    expect(Array.isArray(result.classes)).toBe(true);
  });

  it('should handle TypeScript content with imports and exports', async () => {
    const content = `
import { foo } from './foo';
import bar from './bar';
export const baz = 42;
export function qux() {}
`;
    const result = await extractAstMetadata('module.ts', content, 'typescript');
    expect(result.filepath).toBe('module.ts');
    expect(result.language).toBe('typescript');
    expect(Array.isArray(result.imports)).toBe(true);
    expect(Array.isArray(result.exports)).toBe(true);
  });

  it('should handle JavaScript content', async () => {
    const content = `
function sum(a, b) {
  return a + b;
}
`;
    const result = await extractAstMetadata('sum.js', content, 'javascript');
    expect(result.filepath).toBe('sum.js');
    expect(result.language).toBe('javascript');
    expect(Array.isArray(result.functions)).toBe(true);
  });

  it('should handle Python content', async () => {
    const content = `
def greet(name):
    return f"Hello, {name}"
`;
    const result = await extractAstMetadata('greet.py', content, 'python');
    expect(result.filepath).toBe('greet.py');
    expect(result.language).toBe('python');
    expect(Array.isArray(result.functions)).toBe(true);
  });

  it('should handle Rust content', async () => {
    const content = `
fn greet(name: &str) -> String {
    format!("Hello, {}", name)
}
`;
    const result = await extractAstMetadata('greet.rs', content, 'rust');
    expect(result.filepath).toBe('greet.rs');
    expect(result.language).toBe('rust');
    expect(Array.isArray(result.functions)).toBe(true);
  });

  it('should handle Go content', async () => {
    const content = `
package main

func greet(name string) string {
    return "Hello, " + name
}
`;
    const result = await extractAstMetadata('greet.go', content, 'go');
    expect(result.filepath).toBe('greet.go');
    expect(result.language).toBe('go');
    expect(Array.isArray(result.functions)).toBe(true);
  });

  it('should handle unsupported language gracefully', async () => {
    const content = 'some content';
    const result = await extractAstMetadata('test.xyz', content, 'unsupported');
    expect(result.filepath).toBe('test.xyz');
    expect(result.language).toBe('unsupported');
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].toLowerCase()).toContain('unsupported');
  });

  it('should handle empty filepath', async () => {
    const result = await extractAstMetadata('', 'const x = 1;', 'typescript');
    expect(result.filepath).toBe('');
    expect(result.language).toBe('typescript');
  });

  it('should handle content with only whitespace', async () => {
    const result = await extractAstMetadata('whitespace.ts', '   \n  \n  ', 'typescript');
    expect(result.filepath).toBe('whitespace.ts');
    expect(result.functions).toEqual([]);
    expect(result.classes).toEqual([]);
    expect(result.imports).toEqual([]);
    expect(result.exports).toEqual([]);
  });

  it('should handle content with syntax errors', async () => {
    const content = 'function ( { }';
    const result = await extractAstMetadata('syntax-error.ts', content, 'typescript');
    expect(result.filepath).toBe('syntax-error.ts');
    // Should not throw, should return gracefully
    expect(result.errors).toBeDefined();
  });
});
