import * as core from "@actions/core";

import { Inputs } from "./constants";
import run from "./restoreImpl";
import * as utils from "./utils/actionUtils";

async function restore(): Promise<void> {
    const cacheKey = await run();
    if (cacheKey) {
        // Store the matched cache key in states
        utils.setCacheState(cacheKey);

        const isExactKeyMatch = utils.isExactKeyMatch(
            core.getInput(Inputs.Key, { required: true }),
            cacheKey
        );
        utils.setCacheHitOutput(isExactKeyMatch);
        core.info(`Cache restored from key: ${cacheKey}`);
    }
}

export default restore;
