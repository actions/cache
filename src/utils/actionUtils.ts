import * as cache from "@ambi-robotics/cache";
import * as core from "@actions/core";

import { RefKey } from "../constants";

export function isGhes(): boolean {
    const ghUrl = new URL(
        process.env["GITHUB_SERVER_URL"] || "https://github.com"
    );

    const hostname = ghUrl.hostname.trimEnd().toUpperCase();
    const isGitHubHost = hostname === "GITHUB.COM";
    const isGitHubEnterpriseCloudHost = hostname.endsWith(".GHE.COM");
    const isLocalHost = hostname.endsWith(".LOCALHOST");

    return !isGitHubHost && !isGitHubEnterpriseCloudHost && !isLocalHost;
}

export function isExactKeyMatch(key: string, cacheKey?: string): boolean {
    return !!(
        cacheKey &&
        cacheKey.localeCompare(key, undefined, {
            sensitivity: "accent"
        }) === 0
    );
}

export function logWarning(message: string): void {
    const warningPrefix = "[warning]";
    core.info(`${warningPrefix}${message}`);
}

// Cache token authorized for all events that are tied to a ref
// See GitHub Context https://help.github.com/actions/automating-your-workflow-with-github-actions/contexts-and-expression-syntax-for-github-actions#github-context
export function isValidEvent(): boolean {
    return RefKey in process.env && Boolean(process.env[RefKey]);
}

export function getInputAsArray(
    name: string,
    options?: core.InputOptions
): string[] {
    return core
        .getInput(name, options)
        .split("\n")
        .map(s => s.replace(/^!\s+/, "!").trim())
        .filter(x => x !== "");
}

export function getInputAsInt(
    name: string,
    options?: core.InputOptions
): number | undefined {
    const value = parseInt(core.getInput(name, options));
    if (isNaN(value) || value < 0) {
        return undefined;
    }
    return value;
}

export function getInputAsBool(
    name: string,
    options?: core.InputOptions
): boolean {
    const result = core.getInput(name, options);
    return result.toLowerCase() === "true";
}

export function isCacheFeatureAvailable(): boolean {
    if (cache.isFeatureAvailable()) {
        return true;
    }
    return false;
}
