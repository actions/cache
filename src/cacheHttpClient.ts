import * as core from "@actions/core";
import * as fs from "fs";
import { BearerCredentialHandler } from "@actions/http-client/auth";
import { HttpClient, HttpCodes } from "@actions/http-client";
import {
    IHttpClientResponse,
    IRequestOptions,
    ITypedResponse
} from "@actions/http-client/interfaces";
import {
    ArtifactCacheEntry,
    CommitCacheRequest,
    ReserveCacheRequest,
    ReserveCacheResponse
} from "./contracts";
import * as utils from "./utils/actionUtils";

function isSuccessStatusCode(statusCode?: number): boolean {
    if (!statusCode) {
        return false;
    }
    return statusCode >= 200 && statusCode < 300;
}

function isRetryableStatusCode(statusCode?: number): boolean {
    if (!statusCode) {
        return false;
    }
    const retryableStatusCodes = [
        HttpCodes.BadGateway,
        HttpCodes.ServiceUnavailable,
        HttpCodes.GatewayTimeout
    ];
    return retryableStatusCodes.includes(statusCode);
}

function getCacheApiUrl(resource: string): string {
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

    const url = `${baseUrl}_apis/artifactcache/${resource}`;
    core.debug(`Resource Url: ${url}`);
    return url;
}

function createAcceptHeader(type: string, apiVersion: string): string {
    return `${type};api-version=${apiVersion}`;
}

function getRequestOptions(): IRequestOptions {
    const requestOptions: IRequestOptions = {
        headers: {
            Accept: createAcceptHeader("application/json", "6.0-preview.1")
        }
    };

    return requestOptions;
}

function createHttpClient(): HttpClient {
    const token = process.env["ACTIONS_RUNTIME_TOKEN"] || "";
    const bearerCredentialHandler = new BearerCredentialHandler(token);

    return new HttpClient(
        "actions/cache",
        [bearerCredentialHandler],
        getRequestOptions()
    );
}

export async function getCacheEntry(
    keys: string[]
): Promise<ArtifactCacheEntry | null> {
    const httpClient = createHttpClient();
    const resource = `cache?keys=${encodeURIComponent(keys.join(","))}`;

    const response = await httpClient.getJson<ArtifactCacheEntry>(
        getCacheApiUrl(resource)
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

// Reserve Cache
export async function reserveCache(key: string): Promise<number> {
    const httpClient = createHttpClient();

    const reserveCacheRequest: ReserveCacheRequest = {
        key
    };
    const response = await httpClient.postJson<ReserveCacheResponse>(
        getCacheApiUrl("caches"),
        reserveCacheRequest
    );
    return response?.result?.cacheId ?? -1;
}

function getContentRange(start: number, end: number): string {
    // Format: `bytes start-end/filesize
    // start and end are inclusive
    // filesize can be *
    // For a 200 byte chunk starting at byte 0:
    // Content-Range: bytes 0-199/*
    return `bytes ${start}-${end}/*`;
}

async function uploadChunk(
    httpClient: HttpClient,
    resourceUrl: string,
    data: NodeJS.ReadableStream,
    start: number,
    end: number
): Promise<void> {
    core.debug(
        `Uploading chunk of size ${end -
            start +
            1} bytes at offset ${start} with content range: ${getContentRange(
            start,
            end
        )}`
    );
    const additionalHeaders = {
        "Content-Type": "application/octet-stream",
        "Content-Range": getContentRange(start, end)
    };

    const uploadChunkRequest = async (): Promise<IHttpClientResponse> => {
        return await httpClient.sendStream(
            "PATCH",
            resourceUrl,
            data,
            additionalHeaders
        );
    };

    const response = await uploadChunkRequest();
    if (isSuccessStatusCode(response.message.statusCode)) {
        return;
    }

    if (isRetryableStatusCode(response.message.statusCode)) {
        core.debug(
            `Received ${response.message.statusCode}, retrying chunk at offset ${start}.`
        );
        const retryResponse = await uploadChunkRequest();
        if (isSuccessStatusCode(retryResponse.message.statusCode)) {
            return;
        }
    }

    throw new Error(
        `Cache service responded with ${response.message.statusCode} during chunk upload.`
    );
}

function parseEnvNumber(key: string): number | undefined {
    const value = Number(process.env[key]);
    if (Number.isNaN(value) || value < 0) {
        return undefined;
    }
    return value;
}

async function uploadFile(
    httpClient: HttpClient,
    cacheId: number,
    archivePath: string
): Promise<void> {
    // Upload Chunks
    const fileSize = fs.statSync(archivePath).size;
    const resourceUrl = getCacheApiUrl(`caches/${cacheId.toString()}`);
    const fd = fs.openSync(archivePath, "r");

    const concurrency = parseEnvNumber("CACHE_UPLOAD_CONCURRENCY") ?? 4; // # of HTTP requests in parallel
    const MAX_CHUNK_SIZE =
        parseEnvNumber("CACHE_UPLOAD_CHUNK_SIZE") ?? 32 * 1024 * 1024; // 32 MB Chunks
    core.debug(`Concurrency: ${concurrency} and Chunk Size: ${MAX_CHUNK_SIZE}`);

    const parallelUploads = [...new Array(concurrency).keys()];
    core.debug("Awaiting all uploads");
    let offset = 0;

    try {
        await Promise.all(
            parallelUploads.map(async () => {
                while (offset < fileSize) {
                    const chunkSize = Math.min(
                        fileSize - offset,
                        MAX_CHUNK_SIZE
                    );
                    const start = offset;
                    const end = offset + chunkSize - 1;
                    offset += MAX_CHUNK_SIZE;
                    const chunk = fs.createReadStream(archivePath, {
                        fd,
                        start,
                        end,
                        autoClose: false
                    });

                    await uploadChunk(
                        httpClient,
                        resourceUrl,
                        chunk,
                        start,
                        end
                    );
                }
            })
        );
    } finally {
        fs.closeSync(fd);
    }
    return;
}

async function commitCache(
    httpClient: HttpClient,
    cacheId: number,
    filesize: number
): Promise<ITypedResponse<null>> {
    const commitCacheRequest: CommitCacheRequest = { size: filesize };
    return await httpClient.postJson<null>(
        getCacheApiUrl(`caches/${cacheId.toString()}`),
        commitCacheRequest
    );
}

export async function saveCache(
    cacheId: number,
    archivePath: string
): Promise<void> {
    const httpClient = createHttpClient();

    core.debug("Upload cache");
    await uploadFile(httpClient, cacheId, archivePath);

    // Commit Cache
    core.debug("Commiting cache");
    const cacheSize = utils.getArchiveFileSize(archivePath);
    const commitCacheResponse = await commitCache(
        httpClient,
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
