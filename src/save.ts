import * as core from "@actions/core";
import * as path from "path";

import * as cacheHttpClient from "./cacheHttpClient";
import { Events, Inputs, State } from "./constants";
import { createTar } from "./tar";
import * as utils from "./utils/actionUtils";

async function run(): Promise<void> {
    try {
        if (!utils.isValidEvent()) {
            utils.logWarning(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported. Only ${utils
                    .getSupportedEvents()
                    .join(", ")} events are supported at this time.`
            );
            return;
        }

        const state = utils.getCacheState();

        // Inputs are re-evaluted before the post action, so we want the original key used for restore
        const primaryKey = core.getState(State.CacheKey);
        if (!primaryKey) {
            utils.logWarning(`Error retrieving key from state.`);
            return;
        }

        if (utils.isExactKeyMatch(primaryKey, state)) {
            core.info(
                `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
            );
            return;
        }

        const compressionMethod = await utils.getCompressionMethod();

        core.debug("Reserving Cache");
        const cacheId = await cacheHttpClient.reserveCache(primaryKey, {
            compressionMethod: compressionMethod
        });
        if (cacheId == -1) {
            core.info(
                `Unable to reserve cache with key ${primaryKey}, another job may be creating this cache.`
            );
            return;
        }
        core.debug(`Cache ID: ${cacheId}`);
        const cachePaths = await utils.resolvePaths(
            core
                .getInput(Inputs.Path, { required: true })
                .split("\n")
                .filter(x => x !== "")
        );

        core.debug("Cache Paths:");
        core.debug(`${JSON.stringify(cachePaths)}`);

        const archiveFolder = await utils.createTempDirectory();
        const archivePath = path.join(
            archiveFolder,
            utils.getCacheFileName(compressionMethod)
        );

        core.debug(`Archive Path: ${archivePath}`);

        await createTar(archiveFolder, cachePaths, compressionMethod);

        const fileSizeLimit = 5 * 1024 * 1024 * 1024; // 5GB per repo limit
        const archiveFileSize = utils.getArchiveFileSize(archivePath);
        core.debug(`File Size: ${archiveFileSize}`);
        if (archiveFileSize > fileSizeLimit) {
            utils.logWarning(
                `Cache size of ~${Math.round(
                    archiveFileSize / (1024 * 1024)
                )} MB (${archiveFileSize} B) is over the 5GB limit, not saving cache.`
            );
            return;
        }

        core.debug(`Saving Cache (ID: ${cacheId})`);
        await cacheHttpClient.saveCache(cacheId, archivePath);
    } catch (error) {
        utils.logWarning(error.message);
    }
}

run();

export default run;
