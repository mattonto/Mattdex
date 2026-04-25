import * as fs from 'node:fs';
import * as path from 'node:path';

// Define the base directory for pending diffs
// This will be relative to process.cwd()
const PENDING_DIFFS_BASE_DIR_NAME = 'data';
const PENDING_DIFFS_SUB_DIR_NAME = 'pending-diffs';

function getPendingDiffsDirPath(): string {
    return path.join(process.cwd(), PENDING_DIFFS_BASE_DIR_NAME, PENDING_DIFFS_SUB_DIR_NAME);
}

/**
 * Ensures the base directory for pending diffs exists, creating it if necessary.
 */
function ensureDirExists(): void {
    const dirPath = getPendingDiffsDirPath();
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Helper to get the full file path for a given pending diff ID.
 * @param id The ID of the pending diff.
 * @returns The full file path.
 */
function getFilePath(id: string): string {
    return path.join(getPendingDiffsDirPath(), `${id}.json`);
}

/**
 * Represents the structure of a pending diff.
 */
export interface PendingDiff {
    id: string;
    timestamp: number;
    diffContent: string;
    metadata?: Record<string, unknown>;
}

/**
 * Creates a new pending diff entry.
 * Throws an error if a pending diff with the given ID already exists.
 * @param id The unique ID for the pending diff.
 * @param data The pending diff data to store.
 */
export function createPendingDiff(id: string, data: PendingDiff): void {
    ensureDirExists();
    const filePath = getFilePath(id);
    if (fs.existsSync(filePath)) {
        throw new Error(`Pending diff with ID '${id}' already exists.`);
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Retrieves a pending diff by its ID.
 * Returns null if the pending diff does not exist or if the file content is corrupted.
 * @param id The ID of the pending diff to retrieve.
 * @returns The PendingDiff object or null.
 */
export function getPendingDiff(id: string): PendingDiff | null {
    const filePath = getFilePath(id);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content) as PendingDiff;
    } catch (error) {
        console.error(`Error reading or parsing pending diff file ${filePath}:`, error);
        return null; // Handle corrupted files gracefully
    }
}

/**
 * Updates an existing pending diff entry.
 * Throws an error if a pending diff with the given ID does not exist.
 * @param id The ID of the pending diff to update.
 * @param data The new pending diff data.
 */
export function updatePendingDiff(id: string, data: PendingDiff): void {
    const filePath = getFilePath(id);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Pending diff with ID '${id}' not found for update.`);
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Deletes a pending diff by its ID.
 * Handles non-existent files gracefully (does not throw an error if the file is not found).
 * @param id The ID of the pending diff to delete.
 */
export function deletePendingDiff(id: string): void {
    const filePath = getFilePath(id);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    // Handles non-existent file gracefully by doing nothing
}
