import * as core from "@actions/core";
import { exec } from "@actions/exec";
import * as io from "@actions/io";
import * as path from "path";
import * as cacheHttpClient from "./cacheHttpClient";
import { Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";

async function run(): Promise<void> {
    try {
        const state = utils.getCacheState();

        // Inputs are re-evaluted before the post action, so we want the original key used for restore
        const primaryKey = core.getState(State.CacheKey);
        if (!primaryKey) {
            core.warning(`Error retrieving key from state.`);
            return;
        }

        if (utils.isExactKeyMatch(primaryKey, state)) {
            core.info(
                `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
            );
            return;
        }

        let cachePath = utils.resolvePath(
            core.getInput(Inputs.Path, { required: true })
        );
        core.debug(`Cache Path: ${cachePath}`);

        let archivePath = path.join(
            await utils.createTempDirectory(),
            "cache.tgz"
        );
        core.debug(`Archive Path: ${archivePath}`);

        // http://man7.org/linux/man-pages/man1/tar.1.html
        // tar [-options] <name of the tar archive> [files or directories which to add into archive]
        const IS_WINDOWS = process.platform === "win32";
        const args = IS_WINDOWS
            ? [
                  "-cz",
                  "--force-local",
                  "-f",
                  archivePath.replace(/\\/g, "/"),
                  "-C",
                  cachePath.replace(/\\/g, "/"),
                  "."
              ]
            : ["-cz", "-f", archivePath, "-C", cachePath, "."];

        const tarPath = await io.which("tar", true);
        core.debug(`Tar Path: ${tarPath}`);
        await exec(`"${tarPath}"`, args);

        const fileSizeLimit = 400 * 1024 * 1024; // 400MB
        const archiveFileSize = utils.getArchiveFileSize(archivePath);
        core.debug(`File Size: ${archiveFileSize}`);
        if (archiveFileSize > fileSizeLimit) {
            core.warning(
                `Cache size of ~${Math.round(
                    archiveFileSize / (1024 * 1024)
                )} MB (${archiveFileSize} B) is over the 400MB limit, not saving cache.`
            );
            return;
        }

        await cacheHttpClient.saveCache(primaryKey, archivePath);
    } catch (error) {
        core.warning(error.message);
    }
}

run();

export default run;
