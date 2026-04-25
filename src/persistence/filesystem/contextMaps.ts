import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface ContextMap {
  id: string;
  name: string;
  content: string;
  [key: string]: unknown; // Allow for additional properties
}

// Default base directory, can be overridden for testing
let baseDir = './data/context-maps';

export function setBaseDir(dir: string): void {
  baseDir = dir;
}

async function ensureDirExists(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function createContextMap(id: string, data: ContextMap): Promise<void> {
  await ensureDirExists(baseDir);
  const filePath = path.join(baseDir, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getContextMap(id: string): Promise<ContextMap | null> {
  const filePath = path.join(baseDir, `${id}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as ContextMap;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null; // File not found
    }
    // Re-throw other errors like parsing errors or permission issues
    throw error;
  }
}

export async function updateContextMap(id: string, data: ContextMap): Promise<void> {
  const filePath = path.join(baseDir, `${id}.json`);
  try {
    // Check if file exists before updating
    await fs.access(filePath, fs.constants.F_OK);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Context map with ID '${id}' not found for update.`);
    }
    throw error;
  }
}

export async function deleteContextMap(id: string): Promise<void> {
  const filePath = path.join(baseDir, `${id}.json`);
  try {
    await fs.unlink(filePath);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // File not found, handle gracefully by doing nothing
      return;
    }
    throw error;
  }
}
