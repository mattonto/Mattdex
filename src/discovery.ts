import fs from 'fs';
import fg from 'fast-glob';

// Lightweight parser for top-level JS/TS function, class, and import declarations
function extractSymbols(content: string, filePath: string, symbols: Map<string, string>): void {
  // Match: function name(...
  const functionRegex = /^\s*(async\s+)?function\s+([\w$_]+)\s*\(/gm;
  // Match: const name = | let name = | var name = | const name: | let name: | var name:
  const constRegex = /^\s*(const|let|var)\s+([\w$_]+)\s*[:=]/gm;
  // Match: class Name
  const classRegex = /^\s*class\s+([\w$_]+)/gm;
  // Match: import { name, name2 } from
  const importRegex = /^\s*import\s+(?:{[^}]+}|\w+)\s+from/gm;
  // Match: import name from
  const importDefaultRegex = /^\s*import\s+(\w+)/gm;

  let match: RegExpExecArray | null;

  while ((match = functionRegex.exec(content)) !== null) {
    symbols.set(match[2], filePath);
  }

  while ((match = constRegex.exec(content)) !== null) {
    symbols.set(match[2], filePath);
  }

  while ((match = classRegex.exec(content)) !== null) {
    symbols.set(match[1], filePath);
  }

  while ((match = importRegex.exec(content)) !== null) {
    // Extract named imports
    const importContent = match[0];
    const namedImportMatch = importContent.match(/{([^}]+)}/);
    if (namedImportMatch) {
      const names = namedImportMatch[1].split(',').map(n => n.trim());
      names.forEach(name => {
        if (name) symbols.set(name, filePath);
      });
    }
  }

  while ((match = importDefaultRegex.exec(content)) !== null) {
    symbols.set(match[1], filePath);
  }
}

export type SymbolMap = Map<string, string>;

export async function scanDirectory(rootPath: string): Promise<SymbolMap> {
  // fast-glob options to exclude unwanted directories
  const globOptions = {
    cwd: rootPath,
    ignore: ['**/node_modules/**', '**/.git/**'],
    absolute: true,
  };

  // Scan for .ts, .tsx, .js, .jsx files
  const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
  const files: string[] = [];

  for (const pattern of patterns) {
    const matches = await fg(pattern, globOptions);
    files.push(...matches);
  }

  const symbols = new Map<string, string>();

  // Read and parse each file
  for (const file of files) {
    try {
      const content = await fs.promises.readFile(file, 'utf-8');
      extractSymbols(content, file, symbols);
    } catch (err) {
      console.error(`Error reading/parsing ${file}:`, err);
    }
  }

  return symbols;
}