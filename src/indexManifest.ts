import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdirp } from 'mkdirp';

const MANIFEST_PATH = './.indexer/manifest.json';

export interface FileEntry {
  path: string;
  mtime: number; // Unix timestamp in milliseconds
  symbols: string[];
}

export interface IndexManifest {
  files: FileEntry[];
}

export class IndexManifest {
  private data: IndexManifest = { files: [] };
  private loaded = false;

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(MANIFEST_PATH, 'utf-8');
      this.data = JSON.parse(data);
      this.loaded = true;
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      // Manifest doesn't exist, start fresh
      this.data = { files: [] };
      this.loaded = true;
    }
  }

  async save(): Promise<void> {
    await mkdirp('./.indexer');
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async upsertFile(path: string, mtime: number, symbols: string[]): Promise<void> {
    if (!this.loaded) await this.load();
    const normalizedPath = path.replace(/\\/g, '/');
    const existingIndex = this.data.files.findIndex(f => f.path === normalizedPath);
    const fileEntry: FileEntry = { path: normalizedPath, mtime, symbols };

    if (existingIndex >= 0) {
      this.data.files[existingIndex] = fileEntry;
    } else {
      this.data.files.push(fileEntry);
    }
  }

  async removeFile(path: string): Promise<void> {
    if (!this.loaded) await this.load();
    const normalizedPath = path.replace(/\\/g, '/');
    this.data.files = this.data.files.filter(f => f.path !== normalizedPath);
  }

  getFiles(): FileEntry[] {
    if (!this.loaded) {
      throw new Error('Manifest not loaded. Call load() first.');
    }
    return this.data.files;
  }

  getFile(path: string): FileEntry | undefined {
    if (!this.loaded) {
      throw new Error('Manifest not loaded. Call load() first.');
    }
    const normalizedPath = path.replace(/\\/g, '/');
    return this.data.files.find(f => f.path === normalizedPath);
  }

  clear(): void {
    this.data.files = [];
  }
}