import {} from "@actions/cache";
import * as core from "@actions/core";

import { CacheService } from "./cache.service";
import { Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logWarning(e.message));

async function run(): Promise<void> {
    try {
        const state = utils.getCacheState();

        // Inputs are re-evaluted before the post action, so we want the original key used for restore
        const primaryKey = core.getState(State.CachePrimaryKey);
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

        const cachePaths = utils.getInputAsArray(Inputs.Path, {
            required: true
        });

        try {
            const cache: CacheService = new CacheService(
                core.getInput(Inputs.AccessKeyId),
                core.getInput(Inputs.SecretAccessKey),
                core.getInput(Inputs.Bucket)
            );
            await cache.saveCache(cachePaths, primaryKey);
            core.info(`Cache saved with key: ${primaryKey}`);
        } catch (error) {
            utils.logWarning(error.message);
        }
    } catch (error) {
        utils.logWarning(error.message);
    }
}

run();

export default run;
