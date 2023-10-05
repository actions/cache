import * as core from "@actions/core";

import { Inputs, Outputs, RefKey, State } from "../constants";

import {S3ClientConfig} from "@aws-sdk/client-s3";

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

export function setCacheState(state: string): void {
    core.saveState(State.CacheMatchedKey, state);
}

export function setCacheHitOutput(isCacheHit: boolean): void {
    core.setOutput(Outputs.CacheHit, isCacheHit.toString());
}

export function setOutputAndState(key: string, cacheKey?: string): void {
    setCacheHitOutput(isExactKeyMatch(key, cacheKey));
    // Store the matched cache key if it exists
    cacheKey && setCacheState(cacheKey);
}

export function getCacheState(): string | undefined {
    const cacheKey = core.getState(State.CacheMatchedKey);
    if (cacheKey) {
        core.debug(`Cache state/key: ${cacheKey}`);
        return cacheKey;
    }

    return undefined;
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
        .map(s => s.trim())
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

export function getInputS3ClientConfig(): S3ClientConfig | undefined {
    const s3BucketName = core.getInput(Inputs.AWSS3Bucket)
    if (!s3BucketName) {
        return undefined
    }

    const s3config = {
        credentials: {
          accessKeyId: core.getInput(Inputs.AWSAccessKeyId) || process.env['AWS_ACCESS_KEY_ID'],
          secretAccessKey: core.getInput(Inputs.AWSSecretAccessKey)|| process.env['AWS_SECRET_ACCESS_KEY']
        },
        region: core.getInput(Inputs.AWSRegion) || process.env['AWS_REGION'],
        endpoint: core.getInput(Inputs.AWSEndpoint),
        bucketEndpoint: core.getBooleanInput(Inputs.AWSS3BucketEndpoint),
        forcePathStyle: core.getBooleanInput(Inputs.AWSS3ForcePathStyle),
    } as S3ClientConfig

    core.debug('Enable S3 backend mode.')

    return s3config
}
