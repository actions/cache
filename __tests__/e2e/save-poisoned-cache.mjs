// @ts-check
/**
 * save-poisoned-cache.mjs
 *
 * Helper script used by the path-validation E2E workflow to upload a cache
 * archive that contains entries outside the declared `path` inputs. This
 * simulates a poisoned cache that would have been produced by a build job
 * that had write access to the workspace's parent directory (the canonical
 * cache-poisoning scenario being defended against).
 *
 * Usage:
 *   node save-poisoned-cache.mjs <cache-key> <declared-path> [extra-path ...]
 *
 * The script invokes `@actions/cache.saveCache()` with the declared path(s)
 * AND extra paths that escape the workspace. The toolkit's saveCache packs
 * everything into the archive, so the resulting cache entry will contain
 * "escape" entries that resolve outside the declared `path` when the action's
 * `restore` step later extracts it (because the restore step only declares the
 * legitimate `path`).
 *
 * Important: this script is NOT shipped to users. It is purely a test fixture
 * generator used by the E2E workflow to validate that the action's client-side
 * validation correctly rejects (or warns about) such caches.
 */

import * as cache from '@actions/cache';

const [, , key, ...paths] = process.argv;

if (!key || paths.length === 0) {
    console.error(
        'Usage: node save-poisoned-cache.mjs <cache-key> <path> [extra-path ...]'
    );
    process.exit(2);
}

console.log(`Saving poisoned cache with key="${key}" paths=${JSON.stringify(paths)}`);

try {
    const cacheId = await cache.saveCache(paths, key);
    console.log(`Saved poisoned cache (cacheId=${cacheId})`);
} catch (err) {
    console.error(`Failed to save poisoned cache: ${err?.message ?? err}`);
    process.exit(1);
}
