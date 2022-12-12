import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, Inputs, Outputs, State } from "./constants";
import { IStateProvider } from "./stateProvider";
import * as utils from "./utils/actionUtils";

async function restoreImpl(
    stateProvider: IStateProvider
): Promise<string | undefined> {
    try {
        if (!utils.isCacheFeatureAvailable()) {
            core.setOutput(Outputs.CacheHit, "false");
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
        stateProvider.setState(State.CachePrimaryKey, primaryKey);

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

        // Store the matched cache key in states
        stateProvider.setState(State.CacheMatchedKey, cacheKey);

        const isExactKeyMatch = utils.isExactKeyMatch(
            core.getInput(Inputs.Key, { required: true }),
            cacheKey
        );

        core.setOutput(Outputs.CacheHit, isExactKeyMatch.toString());
        core.info(`Cache restored from key: ${cacheKey}`);

        return cacheKey;
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
}

export default restoreImpl;
