import * as core from "@actions/core";
import { exec } from "@actions/exec";

import { Events, Inputs, Outputs } from "./constants";
import * as utils from "./utils/actionUtils";

export async function restoreImpl(): Promise<string | undefined> {
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

        const key = core.getInput(Inputs.Key, { required: true });
        const bucket = core.getInput(Inputs.Bucket);
        const workspace = process.env["GITHUB_WORKSPACE"] ?? process.cwd();
        const exitCode = await exec("/bin/bash", [
            "-c",
            `gsutil -o 'GSUtil:parallel_thread_count=1' -o 'GSUtil:sliced_object_download_max_components=8' cp "gs://${bucket}/${key}" - | tar --skip-old-files -x -P -C "${workspace}"`
        ]);
        if (exitCode === 1) {
            console.log("[warning]Failed to extract cache...");
            return;
        }

        // cache-id return set to 1
        return "1";
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
}

async function run(earlyExit: boolean | undefined): Promise<void> {
    try {
        await restoreImpl();
    } catch (err) {
        console.error(err);
        if (earlyExit) {
            process.exit(1);
        }
    }

    // node will stay alive if any promises are not resolved,
    // which is a possibility if HTTP requests are dangling
    // due to retries or timeouts. We know that if we got here
    // that all promises that we care about have successfully
    // resolved, so simply exit with success.
    if (earlyExit) {
        process.exit(0);
    }
}

export async function restoreOnlyRun(
    earlyExit?: boolean | undefined
): Promise<void> {
    await run(earlyExit);
}

export async function restoreRun(
    earlyExit?: boolean | undefined
): Promise<void> {
    await run(earlyExit);
}
