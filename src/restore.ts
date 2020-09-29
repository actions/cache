import * as cache from "@actions/cache";
import { getCacheEntry } from "@actions/cache/lib/internal/cacheHttpClient";
import { getCompressionMethod } from "@actions/cache/lib/internal/cacheUtils";
import * as core from "@actions/core";

import { Events, Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";

async function run(): Promise<void> {
    try {
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
        const onlyCheck = utils.getInputAsBool(Inputs.OnlyCheckKey);

        try {
            if (onlyCheck) {
                const entry = await getCacheEntry([primaryKey], cachePaths, {
                    compressionMethod: await getCompressionMethod()
                });

                if (entry && entry.archiveLocation) {
                    core.info(`Cache found for key: ${primaryKey}`);
                    utils.setCacheHitOutput(true);
                } else {
                    core.info(`Cache not found for key: ${primaryKey}`);
                    utils.setCacheHitOutput(false);
                }
            } else {
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

                const isExactKeyMatch = utils.isExactKeyMatch(
                    primaryKey,
                    cacheKey
                );
                utils.setCacheHitOutput(isExactKeyMatch);

                core.info(`Cache restored from key: ${cacheKey}`);
            }
        } catch (error) {
            if (error.name === cache.ValidationError.name) {
                throw error;
            } else {
                utils.logWarning(error.message);
                utils.setCacheHitOutput(false);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();

export default run;
