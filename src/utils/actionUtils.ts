import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { S3ClientConfig } from "@aws-sdk/client-s3";

import { Inputs, RefKey } from "../constants";

export function isGhes(): boolean {
    const ghUrl = new URL(
        process.env["GITHUB_SERVER_URL"] || "https://github.com"
    );
    return ghUrl.hostname.toUpperCase() !== "GITHUB.COM";
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

export function getInputS3ClientConfig(): S3ClientConfig | undefined {
    const s3BucketName = core.getInput(Inputs.AWSS3Bucket);
    if (!s3BucketName) {
        return undefined;
    }

    const s3config = {
        credentials: {
            accessKeyId:
                core.getInput(Inputs.AWSAccessKeyId) ||
                process.env["AWS_ACCESS_KEY_ID"],
            secretAccessKey:
                core.getInput(Inputs.AWSSecretAccessKey) ||
                process.env["AWS_SECRET_ACCESS_KEY"],
            sessionToken:
                core.getInput(Inputs.AWSSessionToken) ||
                process.env["AWS_SESSION_TOKEN"]
        },
        region: core.getInput(Inputs.AWSRegion) || process.env["AWS_REGION"],
        endpoint: core.getInput(Inputs.AWSEndpoint),
        bucketEndpoint: core.getBooleanInput(Inputs.AWSS3BucketEndpoint),
        forcePathStyle: core.getBooleanInput(Inputs.AWSS3ForcePathStyle)
    } as S3ClientConfig;

    core.debug("Enable S3 backend mode.");

    return s3config;
}
