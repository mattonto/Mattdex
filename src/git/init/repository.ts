import type { R2Bucket } from '@cloudflare/workers-types';
import { init, log } from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

/**
 * Environment bindings required for Git repository initialization.
 */
export interface GitInitEnv {
  /** R2 bucket where bare Git repos are stored */
  readonly GIT_STORAGE: R2Bucket;
}

/**
 * The key prefix under which all bare Git repositories are stored in R2.
 */
const REPOS_PREFIX = 'repos/';

/**
 * The default repository name for the main branch.
 */
const MAIN_REPO_KEY = 'repos/main.git';

/**
 * The expected content of the HEAD file for a bare repo with main as default branch.
 */
const EXPECTED_HEAD_CONTENT = 'ref: refs/heads/main\n';

/**
 * Checks whether a bare Git repository already exists at the given R2 key prefix.
 *
 * We probe for the HEAD object because it is the minimal required file in any
 * valid Git repository. If HEAD exists, we consider the repo initialised.
 *
 * @param env - Environment bindings containing the R2 bucket.
 * @param repoKey - The R2 key prefix for the repository (e.g. 'repos/main.git').
 * @returns `true` if the HEAD object exists, `false` otherwise.
 */
async function repoExists(env: GitInitEnv, repoKey: string): Promise<boolean> {
  const headKey = `${repoKey}/HEAD`;
  const headObject = await env.GIT_STORAGE.get(headKey);
  return headObject !== null;
}

/**
 * Initialises a bare Git repository in R2 at the given key prefix if one does
 * not already exist.
 *
 * The repository is created with `main` as the default branch. The function is
 * idempotent: if the repository already exists (determined by the presence of
 * the HEAD object), it returns without making any changes.
 *
 * This function uses `isomorphic-git`'s `init` function with `bare: true` and
 * an in-memory `fs` that writes directly to the R2 bucket via a custom
 * filesystem adapter. After initialisation, it verifies that the HEAD file
 * points to `refs/heads/main`.
 *
 * @param env - Environment bindings containing the R2 bucket.
 * @throws {Error} If the R2 bucket is unavailable or the init operation fails.
 */
export async function initializeGitRepository(env: GitInitEnv): Promise<void> {
  const repoKey = MAIN_REPO_KEY;

  // Idempotency check: if HEAD already exists, the repo is already initialised.
  if (await repoExists(env, repoKey)) {
    return;
  }

  // Build an in-memory filesystem that proxies writes to R2.
  // isomorphic-git expects a filesystem object with at least:
  //   - promises (object with readFile, writeFile, unlink, readdir, mkdir, rmdir, stat, lstat, readlink, symlink)
  // We implement only the subset isomorphic-git actually uses during init.
  const fs = createR2Fs(env, repoKey);

  // Initialise the bare repository.
  // The `dir` parameter is the root of the virtual filesystem; isomorphic-git
  // will create the standard Git directory structure (HEAD, config, refs, objects)
  // under this path. Since our fs adapter prepends the repoKey, we pass '/' as dir.
  await init({
    fs,
    dir: '/',
    bare: true,
    defaultBranch: 'main',
  });

  // Verify that the HEAD file was written correctly.
  const headKey = `${repoKey}/HEAD`;
  const headObject = await env.GIT_STORAGE.get(headKey);
  if (!headObject) {
    throw new Error(
      `Git repository initialisation failed: HEAD not found at '${headKey}'`,
    );
  }

  const headContent = await headObject.text();
  if (headContent !== EXPECTED_HEAD_CONTENT) {
    throw new Error(
      `Git repository initialisation produced unexpected HEAD content: ` +
        `expected '${EXPECTED_HEAD_CONTENT.trim()}', got '${headContent.trim()}'`,
    );
  }
}

// ---------------------------------------------------------------------------
// R2-backed filesystem adapter for isomorphic-git
// ---------------------------------------------------------------------------

/**
 * Creates a minimal filesystem object that stores files in an R2 bucket.
 *
 * isomorphic-git's `init` function uses the following operations:
 *   - mkdir (to create directories like 'refs/heads', 'objects')
 *   - writeFile (to write HEAD, config, etc.)
 *   - readFile (to verify written content)
 *   - stat / lstat (to check if a path exists)
 *
 * We implement these by mapping file paths to R2 object keys under the given
 * repo prefix. Directories are not stored as separate objects; we treat any
 * path ending with '/' as a directory and return a stat indicating it exists.
 *
 * @param env - Environment bindings.
 * @param repoKey - The R2 key prefix for the repository (e.g. 'repos/main.git').
 * @returns A filesystem object compatible with isomorphic-git's `fs` parameter.
 */
function createR2Fs(
  env: GitInitEnv,
  repoKey: string,
): {
  promises: {
    readFile: (path: string) => Promise<Uint8Array>;
    writeFile: (path: string, data: Uint8Array) => Promise<void>;
    unlink: (path: string) => Promise<void>;
    readdir: (path: string) => Promise<string[]>;
    mkdir: (path: string) => Promise<void>;
    rmdir: (path: string) => Promise<void>;
    stat: (path: string) => Promise<{ isDirectory: () => boolean; isFile: () => boolean; size: number }>;
    lstat: (path: string) => Promise<{ isDirectory: () => boolean; isFile: () => boolean; size: number }>;
    readlink: (path: string) => Promise<string>;
    symlink: (path: string, target: string) => Promise<void>;
  };
} {
  /**
   * Converts a virtual filesystem path (e.g. '/HEAD', '/refs/heads/main')
   * to an R2 object key by stripping the leading slash and prepending the
   * repo key prefix.
   */
  function toR2Key(path: string): string {
    // Remove leading slash(es) and join with repoKey
    const normalized = path.replace(/^\/+/g, '');
    if (!normalized) {
      return repoKey;
    }
    return `${repoKey}/${normalized}`;
  }

  /**
   * Determines if a path represents a directory (ends with '/' or is empty).
   */
  function isDirectoryPath(path: string): boolean {
    return path === '' || path === '/' || path.endsWith('/');
  }

  return {
    promises: {
      async readFile(path: string): Promise<Uint8Array> {
        const key = toR2Key(path);
        const obj = await env.GIT_STORAGE.get(key);
        if (!obj) {
          throw new Error(`ENOENT: no such file or directory, open '${path}'`);
        }
        const arrayBuffer = await obj.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      },

      async writeFile(path: string, data: Uint8Array): Promise<void> {
        const key = toR2Key(path);
        await env.GIT_STORAGE.put(key, data);
      },

      async unlink(path: string): Promise<void> {
        const key = toR2Key(path);
        await env.GIT_STORAGE.delete(key);
      },

      async readdir(path: string): Promise<string[]> {
        const prefix = toR2Key(path);
        // Ensure prefix ends with '/' for listing
        const searchPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
        const objects = await env.GIT_STORAGE.list({ prefix: searchPrefix });
        // Return relative names (strip the prefix)
        return objects.objects.map((o) => {
          const relative = o.key.slice(searchPrefix.length);
          // If there's a '/' in the remainder, it's a subdirectory — return the first segment
          const slashIndex = relative.indexOf('/');
          return slashIndex >= 0 ? relative.slice(0, slashIndex) : relative;
        });
      },

      async mkdir(_path: string): Promise<void> {
        // R2 does not have real directories; we create a zero-byte placeholder
        // object to mark the directory's existence. This is optional but helps
        // with stat() calls.
        // For init, isomorphic-git calls mkdir on paths like 'refs', 'refs/heads',
        // 'objects', 'objects/pack', 'objects/info'. We create a zero-byte marker.
        const key = toR2Key(_path);
        // Only create if it doesn't already exist (idempotent)
        const existing = await env.GIT_STORAGE.get(key);
        if (!existing) {
          await env.GIT_STORAGE.put(key, new Uint8Array(0));
        }
      },

      async rmdir(path: string): Promise<void> {
        const key = toR2Key(path);
        await env.GIT_STORAGE.delete(key);
      },

      async stat(path: string): Promise<{
        isDirectory: () => boolean;
        isFile: () => boolean;
        size: number;
      }> {
        if (isDirectoryPath(path)) {
          return {
            isDirectory: () => true,
            isFile: () => false,
            size: 0,
          };
        }

        const key = toR2Key(path);
        const obj = await env.GIT_STORAGE.get(key);
        if (!obj) {
          // Check if it's a directory marker
          const dirObj = await env.GIT_STORAGE.get(key + '/');
          if (dirObj) {
            return {
              isDirectory: () => true,
              isFile: () => false,
              size: 0,
            };
          }
          throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
        }
        return {
          isDirectory: () => false,
          isFile: () => true,
          size: obj.size,
        };
      },

      async lstat(path: string): Promise<{
        isDirectory: () => boolean;
        isFile: () => boolean;
        size: number;
      }> {
        // In our simple adapter, lstat behaves identically to stat
        return stat(path);
      },

      async readlink(_path: string): Promise<string> {
        throw new Error('ENOSYS: readlink not supported in R2 filesystem adapter');
      },

      async symlink(_path: string, _target: string): Promise<void> {
        throw new Error('ENOSYS: symlink not supported in R2 filesystem adapter');
      },
    },
  };
}
