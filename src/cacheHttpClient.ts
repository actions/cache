import * as core from "@actions/core";
import * as fs from "fs";
import { BearerCredentialHandler } from "typed-rest-client/Handlers";
import { HttpClient } from "typed-rest-client/HttpClient";
import { IHttpClientResponse } from "typed-rest-client/Interfaces";
import { IRequestOptions, RestClient } from "typed-rest-client/RestClient";
import { ArtifactCacheEntry } from "./contracts";

function getCacheUrl(): string {
    // Ideally we just use ACTIONS_CACHE_URL
    const cacheUrl: string = (
        process.env["ACTIONS_CACHE_URL"] ||
        process.env["ACTIONS_RUNTIME_URL"] ||
        ""
    ).replace("pipelines", "artifactcache");
    if (!cacheUrl) {
        throw new Error(
            "Cache Service Url not found, unable to restore cache."
        );
    }

    core.debug(`Cache Url: ${cacheUrl}`);
    return cacheUrl;
}

function createAcceptHeader(type: string, apiVersion: string): string {
    return `${type};api-version=${apiVersion}`;
}

function getRequestOptions(): IRequestOptions {
    const requestOptions: IRequestOptions = {
        acceptHeader: createAcceptHeader("application/json", "5.2-preview.1")
    };

    return requestOptions;
}

export async function getCacheEntry(
    keys: string[]
): Promise<ArtifactCacheEntry | null> {
    const cacheUrl = getCacheUrl();
    const token = process.env["ACTIONS_RUNTIME_TOKEN"] || "";
    const bearerCredentialHandler = new BearerCredentialHandler(token);

    const resource = `_apis/artifactcache/cache?keys=${encodeURIComponent(
        keys.join(",")
    )}`;

    const restClient = new RestClient("actions/cache", cacheUrl, [
        bearerCredentialHandler
    ]);

    const response = await restClient.get<ArtifactCacheEntry>(
        resource,
        getRequestOptions()
    );
    if (response.statusCode === 204) {
        return null;
    }
    if (response.statusCode !== 200) {
        throw new Error(`Cache service responded with ${response.statusCode}`);
    }
    const cacheResult = response.result;
    if (!cacheResult || !cacheResult.archiveLocation) {
        throw new Error("Cache not found.");
    }
    core.setSecret(cacheResult.archiveLocation);
    core.debug(`Cache Result:`);
    core.debug(JSON.stringify(cacheResult));

    return cacheResult;
}

async function pipeResponseToStream(
    response: IHttpClientResponse,
    stream: NodeJS.WritableStream
): Promise<void> {
    return new Promise(resolve => {
        response.message.pipe(stream).on("close", () => {
            resolve();
        });
    });
}

export async function downloadCache(
    cacheEntry: ArtifactCacheEntry,
    archivePath: string
): Promise<void> {
    const stream = fs.createWriteStream(archivePath);
    const httpClient = new HttpClient("actions/cache");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const downloadResponse = await httpClient.get(cacheEntry.archiveLocation!);
    await pipeResponseToStream(downloadResponse, stream);
}

export async function saveCache(
    key: string,
    archivePath: string
): Promise<void> {
    const stream = fs.createReadStream(archivePath);

    const cacheUrl = getCacheUrl();
    const token = process.env["ACTIONS_RUNTIME_TOKEN"] || "";
    const bearerCredentialHandler = new BearerCredentialHandler(token);

    const resource = `_apis/artifactcache/cache/${encodeURIComponent(key)}`;
    const postUrl = cacheUrl + resource;

    const restClient = new RestClient("actions/cache", undefined, [
        bearerCredentialHandler
    ]);

    const requestOptions = getRequestOptions();
    requestOptions.additionalHeaders = {
        "Content-Type": "application/octet-stream"
    };

    const response = await restClient.uploadStream<void>(
        "POST",
        postUrl,
        stream,
        requestOptions
    );
    if (response.statusCode !== 200) {
        throw new Error(`Cache service responded with ${response.statusCode}`);
    }

    core.info("Cache saved successfully");
}
