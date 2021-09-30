import * as core from "@actions/core";

import { CacheService } from "./cache.service";
import { Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";

async function run(): Promise<void> {
    try {
        const primaryKey = core.getInput(Inputs.Key, { required: true });
        core.saveState(State.CachePrimaryKey, primaryKey);

        const restoreKeys = utils.getInputAsArray(Inputs.RestoreKeys);
        const cachePaths = utils.getInputAsArray(Inputs.Path, {
            required: true
        });

        try {
            const cache: CacheService = new CacheService(
                core.getInput(Inputs.AccessKeyId),
                core.getInput(Inputs.SecretAccessKey),
                core.getInput(Inputs.Region),
                core.getInput(Inputs.Bucket)
            );

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

            core.info(`Cache restored from key: ${cacheKey}`);
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
