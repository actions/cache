import * as core from "@actions/core";
import * as fs from "fs";
import { BearerCredentialHandler } from "typed-rest-client/Handlers";
import { HttpClient } from "typed-rest-client/HttpClient";
import { IHttpClientResponse } from "typed-rest-client/Interfaces";
import {
    IRequestOptions,
    RestClient,
    IRestResponse
} from "typed-rest-client/RestClient";
import {
    ArtifactCacheEntry,
    CommitCacheRequest,
    ReserveCacheRequest,
    ReserverCacheResponse
} from "./contracts";
import * as utils from "./utils/actionUtils";

const MAX_CHUNK_SIZE = 4000000; // 4 MB Chunks

function isSuccessStatusCode(statusCode: number): boolean {
    return statusCode >= 200 && statusCode < 300;
}
function getCacheApiUrl(): string {
    // Ideally we just use ACTIONS_CACHE_URL
    const baseUrl: string = (
        process.env["ACTIONS_CACHE_URL"] ||
        process.env["ACTIONS_RUNTIME_URL"] ||
        ""
    ).replace("pipelines", "artifactcache");
    if (!baseUrl) {
        throw new Error(
            "Cache Service Url not found, unable to restore cache."
        );
    }

    core.debug(`Cache Url: ${baseUrl}`);
    return `${baseUrl}_apis/artifactcache/`;
}

function createAcceptHeader(type: string, apiVersion: string): string {
    return `${type};api-version=${apiVersion}`;
}

function getRequestOptions(): IRequestOptions {
    const requestOptions: IRequestOptions = {
        acceptHeader: createAcceptHeader("application/json", "6.0-preview.1")
    };

    return requestOptions;
}

export async function getCacheEntry(
    keys: string[]
): Promise<ArtifactCacheEntry | null> {
    const cacheUrl = getCacheApiUrl();
    const token = process.env["ACTIONS_RUNTIME_TOKEN"] || "";
    const bearerCredentialHandler = new BearerCredentialHandler(token);

    const resource = `cache?keys=${encodeURIComponent(keys.join(","))}`;

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
    if (!isSuccessStatusCode(response.statusCode)) {
        throw new Error(`Cache service responded with ${response.statusCode}`);
    }
    const cacheResult = response.result;
    const cacheDownloadUrl = cacheResult?.archiveLocation;
    if (!cacheDownloadUrl) {
        throw new Error("Cache not found.");
    }
    core.setSecret(cacheDownloadUrl);
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
    archiveLocation: string,
    archivePath: string
): Promise<void> {
    const stream = fs.createWriteStream(archivePath);
    const httpClient = new HttpClient("actions/cache");
    const downloadResponse = await httpClient.get(archiveLocation);
    await pipeResponseToStream(downloadResponse, stream);
}

// Returns Cache ID
async function reserveCache(
    restClient: RestClient,
    key: string
): Promise<number> {
    const reserveCacheRequest: ReserveCacheRequest = {
        key
    };
    const response = await restClient.create<ReserverCacheResponse>(
        "caches",
        reserveCacheRequest
    );

    return response?.result?.cacheId || -1;
}

function getContentRange(start: number, length: number): string {
    // Format: `bytes start-end/filesize
    // start and end are inclusive
    // filesize can be *
    // For a 200 byte chunk starting at byte 0:
    // Content-Range: bytes 0-199/*
    return `bytes ${start}-${start + length - 1}/*`;
}

async function uploadChunk(
    restClient: RestClient,
    cacheId: number,
    data: Buffer,
    offset: number
): Promise<IRestResponse<void>> {
    const requestOptions = getRequestOptions();
    requestOptions.additionalHeaders = {
        "Content-Type": "application/octet-stream",
        "Content-Range": getContentRange(offset, data.byteLength)
    };

    return await restClient.update(
        cacheId.toString(),
        data.toString("utf8"),
        requestOptions
    );
}

async function commitCache(
    restClient: RestClient,
    cacheId: number,
    filesize: number
): Promise<IRestResponse<void>> {
    const requestOptions = getRequestOptions();
    const commitCacheRequest: CommitCacheRequest = { size: filesize };
    return await restClient.create(
        cacheId.toString(),
        commitCacheRequest,
        requestOptions
    );
}

export async function saveCache(
    key: string,
    archivePath: string
): Promise<void> {
    const token = process.env["ACTIONS_RUNTIME_TOKEN"] || "";
    const bearerCredentialHandler = new BearerCredentialHandler(token);

    const restClient = new RestClient("actions/cache", getCacheApiUrl(), [
        bearerCredentialHandler
    ]);

    // Reserve Cache
    const cacheId = await reserveCache(restClient, key);
    if (cacheId < 0) {
        throw new Error(`Unable to reserve cache.`);
    }

    // Upload Chunks
    const stream = fs.createReadStream(archivePath);
    let streamIsClosed = false;
    stream.on("close", () => {
        streamIsClosed = true;
    });

    const uploads: Promise<IRestResponse<void>>[] = [];
    let offset = 0;
    while (!streamIsClosed) {
        const chunk: Buffer = stream.read(MAX_CHUNK_SIZE);
        uploads.push(uploadChunk(restClient, cacheId, chunk, offset));
        offset += MAX_CHUNK_SIZE;
    }

    const responses = await Promise.all(uploads);

    const failedResponse = responses.find(
        x => !isSuccessStatusCode(x.statusCode)
    );
    if (failedResponse) {
        throw new Error(
            `Cache service responded with ${failedResponse.statusCode} during chunk upload.`
        );
    }

    // Commit Cache
    const cacheSize = utils.getArchiveFileSize(archivePath);
    const commitCacheResponse = await commitCache(
        restClient,
        cacheId,
        cacheSize
    );
    if (!isSuccessStatusCode(commitCacheResponse.statusCode)) {
        throw new Error(
            `Cache service responded with ${commitCacheResponse.statusCode} during commit cache.`
        );
    }

    core.info("Cache saved successfully");
}
