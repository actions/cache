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
            core.info(
                "Cache with exact key not found, hence exiting the workflow as strict-restore is set to true"
            );
            return;
        }
        core.info(`Cache restored from key: ${cacheKey}`);
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
}

run();

export default run;
