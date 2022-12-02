import * as core from "@actions/core";

import { Outputs } from "./constants";
import run from "./restoreImpl";
import * as utils from "./utils/actionUtils";

async function restoreOnly(): Promise<void> {
    const cacheKey = await run();
    if (cacheKey) {
        // Store the matched cache key in output
        core.setOutput(Outputs.Key, utils.getCacheState());

        core.info(`Cache restored from key: ${cacheKey}`);
    }
}

export default restoreOnly;
