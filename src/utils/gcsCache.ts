import * as cache from "@actions/cache";
import * as utils from "@actions/cache/lib/internal/cacheUtils";
import { CompressionMethod } from "@actions/cache/lib/internal/constants";
import {
    createTar,
    extractTar,
    listTar
} from "@actions/cache/lib/internal/tar";
import { DownloadOptions, UploadOptions } from "@actions/cache/lib/options";
import * as core from "@actions/core";
import { Storage } from "@google-cloud/storage";
import * as path from "path";

import { Inputs } from "../constants";
import { getGCSBucket, isGCSAvailable } from "./actionUtils";

const DEFAULT_PATH_PREFIX = "github-cache";

// Function to initialize GCS client using Application Default Credentials
function getGCSClient(): Storage | null {
    try {
        core.info("Initializing GCS client");
        return new Storage();
    } catch (error) {
        core.warning(
            `Failed to initialize GCS client: ${(error as Error).message}`
        );
        return null;
    }
}

export async function restoreCache(
    paths: string[],
    primaryKey: string,
    restoreKeys?: string[],
    options?: DownloadOptions,
    enableCrossOsArchive?: boolean
): Promise<string | undefined> {
    // Check if GCS is available
    if (isGCSAvailable()) {
        try {
            const result = await restoreFromGCS(
                paths,
                primaryKey,
                restoreKeys,
                options
            );

            if (result) {
                core.info(`Cache restored from GCS with key: ${result}`);
                return result;
            }

            core.info("Cache not found in GCS, falling back to GitHub cache");
        } catch (error) {
            core.warning(
                `Failed to restore from GCS: ${(error as Error).message}`
            );
            core.info("Falling back to GitHub cache");
        }
    } else {
        core.info("GCS not configured, using GitHub cache");
    }

    // Fall back to GitHub cache
    return await cache.restoreCache(
        paths,
        primaryKey,
        restoreKeys,
        options,
        enableCrossOsArchive
    );
}

export async function saveCache(
    paths: string[],
    key: string,
    options?: UploadOptions,
    enableCrossOsArchive?: boolean
): Promise<number> {
    if (isGCSAvailable()) {
        try {
            const result = await saveToGCS(paths, key);
            if (result) {
                core.info(`Cache saved to GCS with key: [${key} | ${result}]`);
                return 1; // Success ID
            }

            core.warning("Failed to save to GCS, falling back to GitHub cache");
            return -1;
        } catch (error) {
            core.warning(`Failed to save to GCS: ${(error as Error).message}`);
            core.info("Falling back to GitHub cache");
        }
    } else {
        core.info("GCS not configured, using GitHub cache");
    }

    // Fall back to GitHub cache
    return await cache.saveCache(paths, key, options, enableCrossOsArchive);
}

// Function that checks if the cache feature is available (either GCS or GitHub cache)
export function isFeatureAvailable(): boolean {
    return isGCSAvailable() || cache.isFeatureAvailable();
}

async function restoreFromGCS(
    _paths: string[], // validate paths?
    primaryKey: string,
    restoreKeys: string[] = [],
    options?: DownloadOptions
): Promise<string | undefined> {
    const storage = getGCSClient();
    if (!storage) {
        return undefined;
    }

    const bucket = getGCSBucket();
    const pathPrefix =
        core.getInput(Inputs.GCSPathPrefix) || DEFAULT_PATH_PREFIX;
    const compressionMethod = await utils.getCompressionMethod();

    const archiveFolder = await utils.createTempDirectory();
    const archivePath = path.join(
        archiveFolder,
        utils.getCacheFileName(compressionMethod)
    );

    const keys = [primaryKey, ...restoreKeys];
    const match = await findFileOnGCS(
        storage,
        bucket,
        pathPrefix,
        keys,
        compressionMethod
    );

    if (!match) {
        core.info(`No matching cache found`);
        return undefined;
    }

    // Preserve the @actions/cache contract: return the matched cache KEY
    // (primaryKey or a restoreKey), not the GCS object path. The caller
    // (restoreImpl) compares the return value against primaryKey to set the
    // `cache-hit` output — returning the gcs path makes `cache-hit` always
    // false, re-triggering downstream install/build steps that gate on it.
    const { key: matchedKey, path: gcsPath } = match;

    // If lookup only, just return the key
    if (options?.lookupOnly) {
        core.info(`Cache found in GCS with key: ${matchedKey}`);
        return matchedKey;
    }

    try {
        core.info(`Downloading from GCS: ${bucket}/${gcsPath}`);
        const file = storage.bucket(bucket).file(gcsPath);
        await file.download({ destination: archivePath });

        if (core.isDebug()) {
            await listTar(archivePath, compressionMethod);
        }

        const archiveFileSize = utils.getArchiveFileSizeInBytes(archivePath);
        core.info(
            `Cache Size: ~${Math.round(
                archiveFileSize / (1024 * 1024)
            )} MB (${archiveFileSize} B)`
        );

        await extractTar(archivePath, compressionMethod);
        core.info("Cache restored successfully");

        return matchedKey;
    } catch (error) {
        core.warning(`Failed to restore: ${(error as Error).message}`);
    } finally {
        try {
            await utils.unlinkFile(archivePath);
        } catch (error) {
            core.debug(`Failed to delete archive: ${error}`);
        }
    }
}

function getGCSPath(
    pathPrefix: string,
    key: string,
    compressionMethod: CompressionMethod
): string {
    return `${pathPrefix}/${key}.${utils.getCacheFileName(compressionMethod)}`;
}

async function saveToGCS(
    paths: string[],
    key: string
): Promise<string | undefined> {
    const storage = getGCSClient();
    if (!storage) {
        return undefined;
    }

    const bucket = getGCSBucket();
    const pathPrefix =
        core.getInput(Inputs.GCSPathPrefix) || DEFAULT_PATH_PREFIX;
    const compressionMethod = await utils.getCompressionMethod();

    const cachePaths = await utils.resolvePaths(paths);
    core.debug("Cache Paths:");
    core.debug(`${JSON.stringify(cachePaths)}`);

    if (cachePaths.length === 0) {
        throw new Error(
            `Path Validation Error: Path(s) specified in the action for caching do(es) not exist, hence no cache is being saved.`
        );
    }

    const archiveFolder = await utils.createTempDirectory();
    const archivePath = path.join(
        archiveFolder,
        utils.getCacheFileName(compressionMethod)
    );

    core.debug(`Archive Path: ${archivePath}`);

    try {
        await createTar(archiveFolder, cachePaths, compressionMethod);
        if (core.isDebug()) {
            await listTar(archivePath, compressionMethod);
        }

        const gcsPath = getGCSPath(pathPrefix, key, compressionMethod);
        core.info(`Uploading to GCS: ${bucket}/${gcsPath}`);
        const [file] = await storage.bucket(bucket).upload(archivePath, {
            destination: gcsPath,
            resumable: false
        });

        return file.metadata.id;
    } catch (error) {
        core.warning(
            `Error creating or uploading cache: ${(error as Error).message}`
        );
        throw new Error(
            `Error creating or uploading cache: ${(error as Error).message}`
        );
    } finally {
        try {
            await utils.unlinkFile(archivePath);
        } catch (error) {
            core.debug(`Failed to delete archive: ${error}`);
        }
    }
}

async function findFileOnGCS(
    storage: Storage,
    bucket: string,
    pathPrefix: string,
    keys: string[],
    compressionMethod: CompressionMethod
): Promise<{ key: string; path: string } | undefined> {
    const [primaryKey, ...restoreKeys] = keys;
    const fileName = utils.getCacheFileName(compressionMethod);

    // Primary key: exact match only. The `cache-hit` output compares the
    // returned key against the primary key, so a prefix match here would
    // report false hits.
    const primaryPath = getGCSPath(pathPrefix, primaryKey, compressionMethod);
    if (await checkFileExists(storage, bucket, primaryPath)) {
        core.info(`Found file on bucket: ${bucket} with key: ${primaryPath}`);
        return { key: primaryKey, path: primaryPath };
    }

    // Restore keys: prefix match, newest entry wins — mirrors the
    // actions/cache restore-keys contract that callers rely on for rolling
    // caches (e.g. `nx-` matching `nx-<sha>` saved by an earlier run).
    for (const key of restoreKeys) {
        const [files] = await storage
            .bucket(bucket)
            .getFiles({ prefix: `${pathPrefix}/${key}` });
        const newest = files
            .filter(file => file.name.endsWith(`.${fileName}`))
            .sort(
                (a, b) =>
                    new Date(b.metadata.updated ?? 0).getTime() -
                    new Date(a.metadata.updated ?? 0).getTime()
            )[0];

        if (newest) {
            const matchedKey = newest.name.slice(
                pathPrefix.length + 1,
                -(fileName.length + 1)
            );
            core.info(
                `Found file on bucket: ${bucket} with key: ${newest.name}`
            );
            return { key: matchedKey, path: newest.name };
        }
    }
    return undefined;
}

async function checkFileExists(
    storage: Storage,
    bucket: string,
    path: string
): Promise<boolean> {
    const [exists] = await storage.bucket(bucket).file(path).exists();
    return exists;
}
