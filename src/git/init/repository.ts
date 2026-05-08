import { init, listBranches, log } from 'isomorphic-git';
import { fs } from 'memfs';
import type { GitAuth, R2Bucket } from '../../types/env';

/**
 * Checks for existence of a bare Git repo in R2 under key 'repos/main.git/'
 * and initializes it using isomorphic-git if not present, creating main branch
 * as default ref.
 *
 * Satisfies R1, AC1.
 */
export async function initializeGitRepository(
  env: { GIT_REPO_BUCKET: R2Bucket; GIT_AUTH?: GitAuth },
): Promise<void> {
  const bucket = env.GIT_REPO_BUCKET;
  const repoKey = 'repos/main.git/';

  // Check if the repo already exists by listing objects under the key prefix
  const existing = await bucket.list({ prefix: repoKey, limit: 1 });

  if (existing.objects.length > 0) {
    // Repo already exists — nothing to do
    return;
  }

  // Initialize a bare repo in memory
  const dir = '/tmp/repo';
  await init({ fs, dir, bare: true, defaultBranch: 'main' });

  // Write all files from the in-memory filesystem to R2
  await writeDirToR2(bucket, repoKey, fs, dir);
}

/**
 * Recursively writes all files from an in-memory directory to an R2 bucket
 * under the given key prefix.
 */
async function writeDirToR2(
  bucket: R2Bucket,
  prefix: string,
  memfs: typeof fs,
  dir: string,
): Promise<void> {
  const entries = memfs.readdirSync(dir, { recursive: true }) as string[];

  for (const entry of entries) {
    const fullPath = `${dir}/${entry}`;
    const stat = memfs.statSync(fullPath);

    if (stat.isFile()) {
      const content = memfs.readFileSync(fullPath);
      const key = `${prefix}${entry}`;
      await bucket.put(key, content);
    }
  }
}
