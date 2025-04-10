import * as core from "@actions/core";
import * as path from "path";
import { Inputs } from "../constants";
import { isGCSAvailable } from "./actionUtils";
import * as utils from "@actions/cache/lib/internal/cacheUtils"
import { Storage } from "@google-cloud/storage";
import * as cache from "@actions/cache";
import { DownloadOptions, UploadOptions } from '@actions/cache/lib/options'
import { createTar, extractTar, listTar } from "@actions/cache/lib/internal/tar"
import { CompressionMethod } from "@actions/cache/lib/internal/constants";

const DEFAULT_PATH_PREFIX = "github-cache"

// Function to initialize GCS client using Application Default Credentials
function getGCSClient(): Storage | null {
    try {
        core.info("Initializing GCS client");
        return new Storage();
    } catch (error) {
        core.warning(`Failed to initialize GCS client: ${(error as Error).message}`);
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
            core.warning(`Failed to restore from GCS: ${(error as Error).message}`);
            core.info("Falling back to GitHub cache");
        }
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
                core.info(`Cache saved to GCS with key: ${key}`);
                return result; // Success ID
            }

            core.warning("Failed to save to GCS, falling back to GitHub cache");
        } catch (error) {
            core.warning(`Failed to save to GCS: ${(error as Error).message}`);
            core.info("Falling back to GitHub cache");
        }
    }

    // Fall back to GitHub cache
    return await cache.saveCache(
        paths,
        key,
        options,
        enableCrossOsArchive
    );
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

    const bucket = core.getInput(Inputs.GCSBucket);
    const pathPrefix = core.getInput(Inputs.GCSPathPrefix) || DEFAULT_PATH_PREFIX;
    const compressionMethod = await utils.getCompressionMethod()

    const archiveFolder = await utils.createTempDirectory()
    const archivePath = path.join(
        archiveFolder,
        utils.getCacheFileName(compressionMethod)
    )

    const keys = [primaryKey, ...restoreKeys]
    const gcsPath = await findFileOnGCS(storage, bucket, pathPrefix, keys, compressionMethod)

    if (!gcsPath) {
        core.info(`No matching cache found`)
        return undefined;
    }

    // If lookup only, just return the key
    if (options?.lookupOnly) {
        core.info(`Cache found in GCS with key: ${gcsPath}`);
        return gcsPath;
    }

    try {
        core.info(`Downloading from GCS: ${bucket}/${gcsPath}`);
        const file = storage.bucket(bucket).file(gcsPath);
        await file.download({ destination: archivePath });


        if (core.isDebug()) {
            await listTar(archivePath, compressionMethod)
        }

        const archiveFileSize = utils.getArchiveFileSizeInBytes(archivePath)
        core.info(
            `Cache Size: ~${Math.round(
                archiveFileSize / (1024 * 1024)
            )} MB (${archiveFileSize} B)`
        )

        await extractTar(archivePath, compressionMethod)
        core.info('Cache restored successfully')


        return gcsPath;
    } catch (error) {
        core.warning(`Failed to restore: ${(error as Error).message}`)
    } finally {

        try {
            await utils.unlinkFile(archivePath)
        } catch (error) {
            core.debug(`Failed to delete archive: ${error}`)
        }
    }
}

function getGCSPath(pathPrefix: any, key: any, compressionMethod: CompressionMethod) {
    return `${pathPrefix}/${key}.${utils.getCacheFileName(compressionMethod)}`;
}


async function saveToGCS(
    paths: string[],
    key: string
): Promise<number> {
    let cacheId = -1
    const storage = getGCSClient();
    if (!storage) {
        return cacheId;
    }

    const bucket = core.getInput(Inputs.GCSBucket);
    const pathPrefix = core.getInput(Inputs.GCSPathPrefix) || DEFAULT_PATH_PREFIX;
    const compressionMethod = await utils.getCompressionMethod()

    const cachePaths = await utils.resolvePaths(paths)
    core.debug('Cache Paths:')
    core.debug(`${JSON.stringify(cachePaths)}`)

    if (cachePaths.length === 0) {
        throw new Error(
            `Path Validation Error: Path(s) specified in the action for caching do(es) not exist, hence no cache is being saved.`
        )
    }

    const archiveFolder = await utils.createTempDirectory()
    const archivePath = path.join(
        archiveFolder,
        utils.getCacheFileName(compressionMethod)
    )

    core.debug(`Archive Path: ${archivePath}`)

    try {
        await createTar(archiveFolder, cachePaths, compressionMethod)
        if (core.isDebug()) {
            await listTar(archivePath, compressionMethod)
        }

        const gcsPath = getGCSPath(pathPrefix, key, compressionMethod)
        core.info(`Uploading to GCS: ${bucket}/${gcsPath}`);
        await storage.bucket(bucket).upload(archivePath, {
            destination: gcsPath,
            resumable: true, // this may not be necessary
        });

        return 1;
    } catch (error) {
        core.warning(`Error creating or uploading cache: ${(error as Error).message}`);
        return -1;
    } finally {
        try {
            await utils.unlinkFile(archivePath)
        } catch (error) {
            core.debug(`Failed to delete archive: ${error}`)
        }
    }
}

async function findFileOnGCS(
    storage: Storage,
    bucket: string,
    pathPrefix: string,
    keys: string[],
    compressionMethod: CompressionMethod,
): Promise<string | undefined> {
    for (const key of keys) {
        const gcsPath = getGCSPath(pathPrefix, key, compressionMethod)
        if (await checkFileExists(storage, bucket, gcsPath)) {
            core.info(`Found file on bucket: ${bucket} with key: ${gcsPath}`)
            return gcsPath
        }
    }
    return undefined
}

async function checkFileExists(storage: Storage, bucket: string, path: string): Promise<boolean> {
    const [exists] = await storage.bucket(bucket).file(path).exists()
    return exists
}
