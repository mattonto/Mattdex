import fse from 'fs-extra';
import fg from 'fast-glob';
import path from 'path';

export interface IndexerOptions {
  exclude?: string[];
}

export class Indexer {
  private rootDir: string;
  private excludePatterns: string[];

  constructor(rootDir: string, options: IndexerOptions = {}) {
    this.rootDir = rootDir;
    this.excludePatterns = options.exclude || [];
  }

  async init(): Promise<void> {
    const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    const files = await fg(patterns, {
      cwd: this.rootDir,
      absolute: true,
      ignore: this.excludePatterns,
    });

    // For now, just verify files exist. Future iterations will parse with tree-sitter.
    await Promise.all(files.map(file => fse.stat(file)));
  }
}

export async function main(rootDir: string, options: IndexerOptions = {}): Promise<Indexer> {
  const indexer = new Indexer(rootDir, options);
  await indexer.init();
  return indexer;
}