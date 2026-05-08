import { type WebAssemblyModule } from 'wasm-tree-sitter';

// Cache for loaded parsers to avoid redundant downloads and compilation
const parserCache = new WeakMap<string, Promise<WebAssembly.Module>>();

// Mapping from file extension to language name for Tree-sitter parsers
const extensionToLanguage: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.cpp': '.cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c++': 'cpp',
  '.c': 'c',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'c_sharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.dart': 'dart',
  '.lua': 'lua',
  '.ex': 'elixir',
  '.clj': 'clojure',
  '.hs': 'haskell',
  '.sh': 'bash',
  '.yaml': 'yaml',
  '.md': 'markdown',
};

// Base URL for CDN-hosted Tree-sitter WASM parsers
const CDN_BASE_URL = 'https://unpkg.com/@web-tree-sitter/';

/**
 * Loads a Tree-sitter WebAssembly parser for the given language.
 * 
 * @param language - The language identifier (e.g., 'typescript', 'python')
 * @returns A Promise resolving to the WebAssembly.Module for the parser
 * 
 * @example
 * const parser = await loadParser('typescript');
 */
export async function loadParser(language: string): Promise<WebAssembly.Module> {
  // Normalize language name (e.g., 'javascript' -> 'js')
  const normalizedLanguage = language === 'javascript' ? 'js' : language;
  
  // Construct the CDN URL for the parser
  const parserUrl = `${CDN_BASE_URL}${normalizedLanguage}/tree-sitter-${normalizedLanguage}.wasm`;
  
  // Check if we already have a loading promise for this language
  const existingPromise = parserCache.get(parserUrl as any);
  if (existingPromise) {
    return existingPromise;
  }
  
  // Create a new loading promise and cache it
  const loadingPromise = fetch(parserUrl)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Failed to load parser from ${parserUrl}: ${res.status} ${res.statusText}`);
      }
      return res.arrayBuffer();
    })
    .then(buffer => WebAssembly.compile(buffer))
    .catch(err => {
      console.error(`Error loading or compiling parser for ${language}:`, err);
      throw err;
    });
  
  parserCache.set(parserUrl as any, loadingPromise);
  
  return loadingPromise;
}

/**
 * Maps a file path to its corresponding Tree-sitter language name.
 * 
 * @param filePath - The path to the file
 * @returns The language name, or undefined if unsupported
 */
export function getLanguageFromPath(filePath: string): string | undefined {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return extensionToLanguage[ext];
}
