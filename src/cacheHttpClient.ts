import * as core from "@actions/core";
import { HttpClient, HttpCodes } from "@actions/http-client";
import { BearerCredentialHandler } from "@actions/http-client/auth";
import {
    IHttpClientResponse,
    IRequestOptions,
    ITypedResponse
} from "@actions/http-client/interfaces";
import * as crypto from "crypto";
import * as fs from "fs";
import * as stream from "stream";
import * as util from "util";

import { CompressionMethod, Inputs, SocketTimeout } from "./constants";
import {
    ArtifactCacheEntry,
    CacheOptions,
    CommitCacheRequest,
    ReserveCacheRequest,
    ReserveCacheResponse
} from "./contracts";
import * as utils from "./utils/actionUtils";

const versionSalt = "1.0";

function isSuccessStatusCode(statusCode?: number): boolean {
    if (!statusCode) {
        return false;
    }
    return statusCode >= 200 && statusCode < 300;
}

function isServerErrorStatusCode(statusCode?: number): boolean {
    if (!statusCode) {
        return true;
    }
    return statusCode >= 500;
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

export function getCacheVersion(compressionMethod?: CompressionMethod): string {
    const components = [core.getInput(Inputs.Path, { required: true })].concat(
        compressionMethod == CompressionMethod.Zstd ? [compressionMethod] : []
    );

    // Add salt to cache version to support breaking changes in cache entry
    components.push(versionSalt);

    return crypto
        .createHash("sha256")
        .update(components.join("|"))
        .digest("hex");
}

export async function retry<T>(
    name: string,
    method: () => Promise<T>,
    getStatusCode: (T) => number | undefined,
    maxAttempts = 2
): Promise<T> {
    let response: T | undefined = undefined;
    let statusCode: number | undefined = undefined;
    let isRetryable = false;
    let errorMessage = "";
    let attempt = 1;

    while (attempt <= maxAttempts) {
        try {
            response = await method();
            statusCode = getStatusCode(response);

            if (!isServerErrorStatusCode(statusCode)) {
                return response;
            }

            isRetryable = isRetryableStatusCode(statusCode);
            errorMessage = `Cache service responded with ${statusCode}`;
        } catch (error) {
            isRetryable = true;
            errorMessage = error.message;
        }

        core.debug(
            `${name} - Attempt ${attempt} of ${maxAttempts} failed with error: ${errorMessage}`
        );

        if (!isRetryable) {
            core.debug(`${name} - Error is not retryable`);
            break;
        }

        attempt++;
    }

    throw Error(`${name} failed: ${errorMessage}`);
}

export async function retryTypedResponse<T>(
    name: string,
    method: () => Promise<ITypedResponse<T>>,
    maxAttempts = 2
): Promise<ITypedResponse<T>> {
    return await retry(
        name,
        method,
        (response: ITypedResponse<T>) => response.statusCode,
        maxAttempts
    );
}

export async function retryHttpClientResponse<T>(
    name: string,
    method: () => Promise<IHttpClientResponse>,
    maxAttempts = 2
): Promise<IHttpClientResponse> {
    return await retry(
        name,
        method,
        (response: IHttpClientResponse) => response.message.statusCode,
        maxAttempts
    );
}

export async function getCacheEntry(
    keys: string[],
    options?: CacheOptions
): Promise<ArtifactCacheEntry | null> {
    const httpClient = createHttpClient();
    const version = getCacheVersion(options?.compressionMethod);
    const resource = `cache?keys=${encodeURIComponent(
        keys.join(",")
    )}&version=${version}`;

    const response = await retryTypedResponse("getCacheEntry", () =>
        httpClient.getJson<ArtifactCacheEntry>(getCacheApiUrl(resource))
    );

    if (response.statusCode === 204) {
        return null;
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
    output: NodeJS.WritableStream
): Promise<void> {
    const pipeline = util.promisify(stream.pipeline);
    await pipeline(response.message, output);
}

export async function downloadCache(
    archiveLocation: string,
    archivePath: string
): Promise<void> {
    const stream = fs.createWriteStream(archivePath);
    const httpClient = new HttpClient("actions/cache");
    const downloadResponse = await retryHttpClientResponse(
        "downloadCache",
        () => httpClient.get(archiveLocation)
    );

    // Abort download if no traffic received over the socket.
    downloadResponse.message.socket.setTimeout(SocketTimeout, () => {
        downloadResponse.message.destroy();
        core.debug(
            `Aborting download, socket timed out after ${SocketTimeout} ms`
        );
    });

    await pipeResponseToStream(downloadResponse, stream);

    // Validate download size.
    const contentLengthHeader =
        downloadResponse.message.headers["content-length"];

    if (contentLengthHeader) {
        const expectedLength = parseInt(contentLengthHeader);
        const actualLength = utils.getArchiveFileSize(archivePath);

        if (actualLength != expectedLength) {
            throw new Error(
                `Incomplete download. Expected file size: ${expectedLength}, actual file size: ${actualLength}`
            );
        }
    } else {
        core.debug("Unable to validate download, no Content-Length header");
    }
}

// Reserve Cache
export async function reserveCache(
    key: string,
    options?: CacheOptions
): Promise<number> {
    const httpClient = createHttpClient();
    const version = getCacheVersion(options?.compressionMethod);

    const reserveCacheRequest: ReserveCacheRequest = {
        key,
        version
    };
    const response = await retryTypedResponse("reserveCache", () =>
        httpClient.postJson<ReserveCacheResponse>(
            getCacheApiUrl("caches"),
            reserveCacheRequest
        )
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
    openStream: () => NodeJS.ReadableStream,
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
            openStream(),
            additionalHeaders
        );
    };

    await retryHttpClientResponse(
        `uploadChunk (start: ${start}, end: ${end})`,
        uploadChunkRequest
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

                    await uploadChunk(
                        httpClient,
                        resourceUrl,
                        () =>
                            fs.createReadStream(archivePath, {
                                fd,
                                start,
                                end,
                                autoClose: false
                            }),
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
    return await retryTypedResponse("commitCache", () =>
        httpClient.postJson<null>(
            getCacheApiUrl(`caches/${cacheId.toString()}`),
            commitCacheRequest
        )
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
