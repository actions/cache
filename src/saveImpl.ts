import * as cacheUtils from "@actions/cache/lib/internal/cacheUtils";
import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { writeFileSync } from "fs";
import * as path from "path";

import { Events, Inputs } from "./constants";
import * as utils from "./utils/actionUtils";

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logWarning(e.message));

async function saveImpl(): Promise<number | void> {
    try {
        if (!utils.isCacheFeatureAvailable()) {
            return;
        }

        if (!utils.isValidEvent()) {
            utils.logWarning(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
            return;
        }

        const key = core.getInput(Inputs.Key);
        const bucket = core.getInput(Inputs.Bucket);
        const paths = utils.getInputAsArray(Inputs.Path, {
            required: true
        });

        // https://github.com/actions/toolkit/blob/c861dd8859fe5294289fcada363ce9bc71e9d260/packages/cache/src/internal/tar.ts#L75
        const cachePaths = await cacheUtils.resolvePaths(paths);
        const tmpFolder = await cacheUtils.createTempDirectory();
        // Write source directories to manifest.txt to avoid command length limits
        const manifestPath = path.join(tmpFolder, "manifest.txt");
        writeFileSync(manifestPath, cachePaths.join("\n"));

        const workspace = process.env["GITHUB_WORKSPACE"] ?? process.cwd();
        const exitCode = await exec("/bin/bash", [
            "-c",
            `tar -cf - -P -C ${workspace} --files-from ${manifestPath} | gsutil -o 'GSUtil:parallel_composite_upload_threshold=250M' cp - "gs://${bucket}/${key}"`
        ]);
        if (exitCode !== 0) {
            utils.logWarning("Failed to upload cache...");
        }
    } catch (error: unknown) {
        utils.logWarning((error as Error).message);
    }
    // cache-id return set to 1
    return 1;
}

export default saveImpl;
