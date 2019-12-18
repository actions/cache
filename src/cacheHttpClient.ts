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

function createRestClient(): RestClient {
    const token = process.env["ACTIONS_RUNTIME_TOKEN"] || "";
    const bearerCredentialHandler = new BearerCredentialHandler(token);

    return new RestClient("actions/cache", getCacheApiUrl(), [
        bearerCredentialHandler
    ]);
}

export async function getCacheEntry(
    keys: string[]
): Promise<ArtifactCacheEntry | null> {
    const restClient = createRestClient();
    const resource = `cache?keys=${encodeURIComponent(keys.join(","))}`;

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

// Reserve Cache
export async function reserveCache(key: string): Promise<number> {
    const restClient = createRestClient();

    const reserveCacheRequest: ReserveCacheRequest = {
        key
    };
    const response = await restClient.create<ReserverCacheResponse>(
        "caches",
        reserveCacheRequest,
        getRequestOptions()
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
    restClient: RestClient,
    resourceUrl: string,
    data: NodeJS.ReadableStream,
    start: number,
    end: number
): Promise<IRestResponse<void>> {
    core.debug(
        `Uploading chunk of size ${end -
            start +
            1} bytes at offset ${start} with content range: ${getContentRange(
            start,
            end
        )}`
    );
    const requestOptions = getRequestOptions();
    requestOptions.additionalHeaders = {
        "Content-Type": "application/octet-stream",
        "Content-Range": getContentRange(start, end)
    };

    return await restClient.uploadStream<void>(
        "PATCH",
        resourceUrl,
        data,
        requestOptions
    );
}

async function uploadFile(
    restClient: RestClient,
    cacheId: number,
    archivePath: string
): Promise<void> {
    // Upload Chunks
    const fileSize = fs.statSync(archivePath).size;
    const resourceUrl = getCacheApiUrl() + "caches/" + cacheId.toString();
    const responses: IRestResponse<void>[] = [];
    const fd = fs.openSync(archivePath, "r");

    const concurrency = 4; // # of HTTP requests in parallel
    const MAX_CHUNK_SIZE = 32000000; // 32 MB Chunks
    core.debug(`Concurrency: ${concurrency} and Chunk Size: ${MAX_CHUNK_SIZE}`);

    const parallelUploads = [...new Array(concurrency).keys()];
    core.debug("Awaiting all uploads");
    let offset = 0;
    await Promise.all(
        parallelUploads.map(async () => {
            while (offset < fileSize) {
                const chunkSize =
                    offset + MAX_CHUNK_SIZE > fileSize
                        ? fileSize - offset
                        : MAX_CHUNK_SIZE;
                const start = offset;
                const end = offset + chunkSize - 1;
                offset += MAX_CHUNK_SIZE;
                const chunk = fs.createReadStream(archivePath, {
                    fd,
                    start,
                    end,
                    autoClose: false
                });
                responses.push(
                    await uploadChunk(
                        restClient,
                        resourceUrl,
                        chunk,
                        start,
                        end
                    )
                );
            }
        })
    );

    fs.closeSync(fd);

    const failedResponse = responses.find(
        x => !isSuccessStatusCode(x.statusCode)
    );
    if (failedResponse) {
        throw new Error(
            `Cache service responded with ${failedResponse.statusCode} during chunk upload.`
        );
    }

    return;
}

async function commitCache(
    restClient: RestClient,
    cacheId: number,
    filesize: number
): Promise<IRestResponse<void>> {
    const requestOptions = getRequestOptions();
    const commitCacheRequest: CommitCacheRequest = { size: filesize };
    return await restClient.create(
        `caches/${cacheId.toString()}`,
        commitCacheRequest,
        requestOptions
    );
}

export async function saveCache(
    cacheId: number,
    archivePath: string
): Promise<void> {
    const restClient = createRestClient();

    core.debug("Upload cache");
    await uploadFile(restClient, cacheId, archivePath);

    // Commit Cache
    core.debug("Commiting cache");
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
