import * as core from "@actions/core";
import * as path from "path";

import * as cacheHttpClient from "./cacheHttpClient";
import { Events, Inputs, State } from "./constants";
import { extractTar } from "./tar";
import * as utils from "./utils/actionUtils";

async function run(): Promise<void> {
    try {
        const primaryKey = core.getInput(Inputs.Key, { required: true });
        core.saveState(State.CacheKey, primaryKey);

        const restoreKeys = core
            .getInput(Inputs.RestoreKeys)
            .split("\n")
            .filter(x => x !== "");
        const keys = [primaryKey, ...restoreKeys];

        core.debug("Resolved Keys:");
        core.debug(JSON.stringify(keys));

        if (keys.length > 10) {
            core.setFailed(
                `Key Validation Error: Keys are limited to a maximum of 10.`
            );
            return;
        }
        for (const key of keys) {
            if (key.length > 512) {
                core.setFailed(
                    `Key Validation Error: ${key} cannot be larger than 512 characters.`
                );
                return;
            }
            const regex = /^[^,]*$/;
            if (!regex.test(key)) {
                core.setFailed(
                    `Key Validation Error: ${key} cannot contain commas.`
                );
                return;
            }
        }

        const compressionMethod = await utils.getCompressionMethod();

        try {
            const cacheEntry = await cacheHttpClient.getCacheEntry(keys, {
                compressionMethod: compressionMethod
            });
            if (!cacheEntry?.archiveLocation) {
                core.info(`Cache not found for input keys: ${keys.join(", ")}`);
                return;
            }

            const archivePath = path.join(
                await utils.createTempDirectory(),
                utils.getCacheFileName(compressionMethod)
            );
            core.debug(`Archive Path: ${archivePath}`);

            // Store the cache result
            utils.setCacheState(cacheEntry);

            try {
                // Download the cache from the cache entry
                await cacheHttpClient.downloadCache(
                    cacheEntry.archiveLocation,
                    archivePath
                );

                const archiveFileSize = utils.getArchiveFileSize(archivePath);
                core.info(
                    `Cache Size: ~${Math.round(
                        archiveFileSize / (1024 * 1024)
                    )} MB (${archiveFileSize} B)`
                );

                await extractTar(archivePath, compressionMethod);
            } finally {
                // Try to delete the archive to save space
                try {
                    await utils.unlinkFile(archivePath);
                } catch (error) {
                    core.debug(`Failed to delete archive: ${error}`);
                }
            }

            const isExactKeyMatch = utils.isExactKeyMatch(
                primaryKey,
                cacheEntry
            );
            utils.setCacheHitOutput(isExactKeyMatch);

            core.info(
                `Cache restored from key: ${cacheEntry && cacheEntry.cacheKey}`
            );
        } catch (error) {
            utils.logWarning(error.message);
            utils.setCacheHitOutput(false);
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();

export default run;
