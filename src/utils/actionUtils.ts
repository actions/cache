import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { RequestError } from "@octokit/request-error"
import { OctokitResponse } from "@octokit/types"

import { RefKey } from "../constants";
const { Octokit } = require("@octokit/action");

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

export async function deleteCacheByKey(key: string, owner: string, repo: string) : Promise <number | void> {
    const octokit = new Octokit();
    let response;
    try {
        const gitRef = process.env[RefKey];
        let cacheEntry = await octokit.rest.actions.getActionsCacheList({
            owner: owner,
            repo: repo,
            key: key,
            ref: gitRef
            });
        const { data: {
            total_count,
            actions_caches
            }
        } = cacheEntry;
        if (total_count !== 1 || total_count !== actions_caches.length) { // leave all find logic to the actual cache implementation. We just want to make sure we're returned a single element so we don't accidentally delete an entry that belongs to a different gitref.
            if (total_count > 1) {
                exports.logWarning(`More than one cache entry found for key ${key}`);
            }
            else if (total_count === 0 || actions_caches.length === 0) {
                exports.logWarning(`No cache entries for key ${key} belong to gitref ${gitRef}.`);
            }
            // This situation is likely never actually going to come up.
            // Istanbul is being dumb and I can't ignore this path.
            else if (total_count !== actions_caches.length) {
                exports.logWarning(`Reported cache entry matches for ${key} does not match length of 'actions_caches' array in API response.`);
            }
            core.info(`Skip trying to delete cache entry for key ${key}.`)
            return;
        }
        let id = actions_caches[0].id;
        response = await octokit.rest.actions.deleteActionsCacheById({
            owner: owner,
            repo: repo,
            cache_id: id
            });
        if (response.status === 204) {
            core.info(`Succesfully deleted cache with key: ${key}, id: ${id}`);
             return 204;
        }
    } catch (e) {
        if (e instanceof RequestError) {
            let err = e as RequestError;
            let errData = err.response?.data as any | undefined;
            exports.logWarning(`Github API reported error: ${err.name} '${err.status}: ${errData?.message}'`);
        }
        core.info(`Couldn't delete cache entry for key ${key}.`)
        return;
    }
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

    if (isGhes()) {
        logWarning(
            `Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.
Otherwise please upgrade to GHES version >= 3.5 and If you are also using Github Connect, please unretire the actions/cache namespace before upgrade (see https://docs.github.com/en/enterprise-server@3.5/admin/github-actions/managing-access-to-actions-from-githubcom/enabling-automatic-access-to-githubcom-actions-using-github-connect#automatic-retirement-of-namespaces-for-actions-accessed-on-githubcom)`
        );
        return false;
    }

    logWarning(
        "An internal error has occurred in cache backend. Please check https://www.githubstatus.com/ for any ongoing issue in actions."
    );
    return false;
}
