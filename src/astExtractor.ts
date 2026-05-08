import type { AstMetadata, SymbolInfo, DependencyMap } from '@autoengineering/shared';
import { Parser } from 'web-tree-sitter';

// Initialize parser
const loadParser = async (): Promise<Parser> => {
  await Parser.init();
  return new Parser();
};

// Language map for file extensions
const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c++': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'c_sharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.dart': 'dart',
  '.lua': 'lua',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.clj': 'clojure',
  '.cljc': 'clojure',
  '.cljs': 'clojure',
  '.hs': 'haskell',
  '.sh': 'bash',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown'
};

// Get language grammar name from file extension
const getLanguageName = (filepath: string): string | null => {
  const ext = Object.keys(LANGUAGE_MAP)
    .find(ext => filepath.endsWith(ext));
  return ext ? LANGUAGE_MAP[ext] : null;
};

// Main AST extraction function
export const extractAstMetadata = async (filepath: string, content: string, language: string): Promise<AstMetadata> => {
  const parser = await loadParser();
  
  // Load the appropriate language grammar
  const lang = await import(`web-tree-sitter/${language}.wasm`);
  parser.setLanguage(lang);

  // Parse the source code
  const tree = parser.parse(content);
  const root = tree.rootNode;

  const metadata: Ast游戏副本