import * as core from "@actions/core";
import * as io from "@actions/io";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as uuidV4 from "uuid/v4";

import { Outputs, State } from "../constants";
import { ArtifactCacheEntry } from "../contracts";

// From https://github.com/actions/toolkit/blob/master/packages/tool-cache/src/tool-cache.ts#L23
export async function createTempDirectory(): Promise<string> {
    const IS_WINDOWS = process.platform === "win32";

    let tempDirectory: string = process.env["RUNNER_TEMP"] || "";

    if (!tempDirectory) {
        let baseLocation: string;
        if (IS_WINDOWS) {
            // On Windows use the USERPROFILE env variable
            baseLocation = process.env["USERPROFILE"] || "C:\\";
        } else {
            if (process.platform === "darwin") {
                baseLocation = "/Users";
            } else {
                baseLocation = "/home";
            }
        }
        tempDirectory = path.join(baseLocation, "actions", "temp");
    }
    const dest = path.join(tempDirectory, uuidV4.default());
    await io.mkdirP(dest);
    return dest;
}

export function getArchiveFileSize(path: string): number {
    return fs.statSync(path).size;
}

export function isExactKeyMatch(
    key: string,
    cacheResult?: ArtifactCacheEntry
): boolean {
    return !!(
        cacheResult &&
        cacheResult.cacheKey &&
        cacheResult.cacheKey.localeCompare(key, undefined, {
            sensitivity: "accent"
        }) === 0
    );
}

export function setOutputAndState(
    key: string,
    cacheResult?: ArtifactCacheEntry
) {
    setCacheHitOutput(isExactKeyMatch(key, cacheResult));
    // Store the cache result if it exists
    cacheResult && setCacheState(cacheResult);
}

export function getCacheState(): ArtifactCacheEntry | undefined {
    const stateData = core.getState(State.CacheResult);
    core.debug(`State: ${stateData}`);
    return (stateData && JSON.parse(stateData)) as ArtifactCacheEntry;
}

export function setCacheState(state: ArtifactCacheEntry) {
    core.saveState(State.CacheResult, JSON.stringify(state));
}

export function setCacheHitOutput(isCacheHit: boolean) {
    core.setOutput(Outputs.CacheHit, isCacheHit.toString());
}

export function resolvePath(filePath: string): string {
    if (filePath[0] === "~") {
        const home = os.homedir();
        if (!home) {
            throw new Error("Unable to resolve `~` to HOME");
        }
        return path.join(home, filePath.slice(1));
    }

    return path.resolve(filePath);
}
