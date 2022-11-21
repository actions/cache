import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";

async function run(): Promise<void> {
    try {
        if (!utils.isCacheFeatureAvailable()) {
            utils.setCacheHitOutput(false);
            return;
        }

        // Validate inputs, this can cause task failure
        if (!utils.isValidEvent()) {
            utils.logWarning(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
            return;
        }

        const primaryKey = core.getInput(Inputs.Key, { required: true });
        core.saveState(State.CachePrimaryKey, primaryKey);

        const restoreKeys = utils.getInputAsArray(Inputs.RestoreKeys);
        const cachePaths = utils.getInputAsArray(Inputs.Path, {
            required: true
        });

        const cacheKey = await cache.restoreCache(
            cachePaths,
            primaryKey,
            restoreKeys
        );

        if (!cacheKey) {
            if (core.getInput(Inputs.StrictRestore) == "true") {
                throw new Error(
                    `Cache with the given input key ${primaryKey} is not found, hence exiting the workflow as the strict-restore requirement is not met.`
                );
            }
            core.info(
                `Cache not found for input keys: ${[
                    primaryKey,
                    ...restoreKeys
                ].join(", ")}`
            );

            return;
        }

        // Store the matched cache key
        utils.setCacheState(cacheKey);

        const isExactKeyMatch = utils.isExactKeyMatch(primaryKey, cacheKey);
        utils.setCacheHitOutput(isExactKeyMatch);

        if (!isExactKeyMatch && core.getInput(Inputs.StrictRestore) == "true") {
            throw new Error(
                `Restored cache key doesn't match the given input key ${primaryKey}, hence exiting the workflow as the strict-restore requirement is not met.`
            );
        }
        core.info(`Cache restored from key: ${cacheKey}`);

        const saveCache = core.getInput(Inputs.SaveCacheOnAnyFailure);

        if (saveCache === "yes") {
            core.saveState(State.SaveCache, saveCache);
            core.info(
                `Input save-cache-on-any-failure is set to yes, the cache will be saved despite of any failure in the build.`
            );
        }
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
}

run();

export default run;
