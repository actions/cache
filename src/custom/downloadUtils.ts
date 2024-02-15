// Just a copy of the original file from the toolkit/actions/cache repository, with a change for byte range used in the downloadCacheHttpClientConcurrent function.
import * as core from "@actions/core";
import { HttpClient } from "@actions/http-client";
import { TransferProgressEvent } from "@azure/ms-rest-js";
import * as fs from "fs";
import { DownloadOptions } from "@actions/cache/lib/options";
import { retryHttpClientResponse } from "@actions/cache/lib/internal/requestUtils";

export interface RunsOnDownloadOptions extends DownloadOptions {
    partSize: number;
}

/**
 * Class for tracking the download state and displaying stats.
 */
export class DownloadProgress {
    contentLength: number;
    segmentIndex: number;
    segmentSize: number;
    segmentOffset: number;
    receivedBytes: number;
    startTime: number;
    displayedComplete: boolean;
    timeoutHandle?: ReturnType<typeof setTimeout>;

    constructor(contentLength: number) {
        this.contentLength = contentLength;
        this.segmentIndex = 0;
        this.segmentSize = 0;
        this.segmentOffset = 0;
        this.receivedBytes = 0;
        this.displayedComplete = false;
        this.startTime = Date.now();
    }

    /**
     * Progress to the next segment. Only call this method when the previous segment
     * is complete.
     *
     * @param segmentSize the length of the next segment
     */
    nextSegment(segmentSize: number): void {
        this.segmentOffset = this.segmentOffset + this.segmentSize;
        this.segmentIndex = this.segmentIndex + 1;
        this.segmentSize = segmentSize;
        this.receivedBytes = 0;

        core.debug(
            `Downloading segment at offset ${this.segmentOffset} with length ${this.segmentSize}...`
        );
    }

    /**
     * Sets the number of bytes received for the current segment.
     *
     * @param receivedBytes the number of bytes received
     */
    setReceivedBytes(receivedBytes: number): void {
        this.receivedBytes = receivedBytes;
    }

    /**
     * Returns the total number of bytes transferred.
     */
    getTransferredBytes(): number {
        return this.segmentOffset + this.receivedBytes;
    }

    /**
     * Returns true if the download is complete.
     */
    isDone(): boolean {
        return this.getTransferredBytes() === this.contentLength;
    }

    /**
     * Prints the current download stats. Once the download completes, this will print one
     * last line and then stop.
     */
    display(): void {
        if (this.displayedComplete) {
            return;
        }

        const transferredBytes = this.segmentOffset + this.receivedBytes;
        const percentage = (
            100 *
            (transferredBytes / this.contentLength)
        ).toFixed(1);
        const elapsedTime = Date.now() - this.startTime;
        const downloadSpeed = (
            transferredBytes /
            (1024 * 1024) /
            (elapsedTime / 1000)
        ).toFixed(1);

        core.info(
            `Received ${transferredBytes} of ${this.contentLength} (${percentage}%), ${downloadSpeed} MBs/sec`
        );

        if (this.isDone()) {
            this.displayedComplete = true;
        }
    }

    /**
     * Returns a function used to handle TransferProgressEvents.
     */
    onProgress(): (progress: TransferProgressEvent) => void {
        return (progress: TransferProgressEvent) => {
            this.setReceivedBytes(progress.loadedBytes);
        };
    }

    /**
     * Starts the timer that displays the stats.
     *
     * @param delayInMs the delay between each write
     */
    startDisplayTimer(delayInMs = 1000): void {
        const displayCallback = (): void => {
            this.display();

            if (!this.isDone()) {
                this.timeoutHandle = setTimeout(displayCallback, delayInMs);
            }
        };

        this.timeoutHandle = setTimeout(displayCallback, delayInMs);
    }

    /**
     * Stops the timer that displays the stats. As this typically indicates the download
     * is complete, this will display one last line, unless the last line has already
     * been written.
     */
    stopDisplayTimer(): void {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = undefined;
        }

        this.display();
    }
}

/**
 * Download the cache using the Actions toolkit http-client concurrently
 *
 * @param archiveLocation the URL for the cache
 * @param archivePath the local path where the cache is saved
 */
export async function downloadCacheHttpClientConcurrent(
    archiveLocation: string,
    archivePath: fs.PathLike,
    options: RunsOnDownloadOptions
): Promise<void> {
    const archiveDescriptor = await fs.promises.open(archivePath, "w");
    const httpClient = new HttpClient("actions/cache", undefined, {
        socketTimeout: options.timeoutInMs,
        keepAlive: true
    });
    try {
        const res = await retryHttpClientResponse(
            "downloadCacheMetadata",
            async () =>
                await httpClient.request("GET", archiveLocation, null, {
                    Range: "bytes=0-1"
                })
        );

        const contentRange = res.message.headers["content-range"];
        if (!contentRange) {
            throw new Error("Range request not supported by server");
        }
        const match = contentRange?.match(/bytes \d+-\d+\/(\d+)/);
        if (!match) {
            throw new Error(
                "Content-Range header in server response not in correct format"
            );
        }
        const length = parseInt(match[1]);
        if (Number.isNaN(length)) {
            throw new Error(`Could not interpret Content-Length: ${length}`);
        }

        const downloads: {
            offset: number;
            promiseGetter: () => Promise<DownloadSegment>;
        }[] = [];

        const blockSize = options.partSize;

        for (let offset = 0; offset < length; offset += blockSize) {
            const count = Math.min(blockSize, length - offset);
            downloads.push({
                offset,
                promiseGetter: async () => {
                    return await downloadSegmentRetry(
                        httpClient,
                        archiveLocation,
                        offset,
                        count
                    );
                }
            });
        }

        // reverse to use .pop instead of .shift
        downloads.reverse();
        let actives = 0;
        let bytesDownloaded = 0;
        const progress = new DownloadProgress(length);
        progress.startDisplayTimer();
        const progressFn = progress.onProgress();

        const activeDownloads: { [offset: number]: Promise<DownloadSegment> } =
            [];
        let nextDownload:
            | { offset: number; promiseGetter: () => Promise<DownloadSegment> }
            | undefined;

        const waitAndWrite: () => Promise<void> = async () => {
            const segment = await Promise.race(Object.values(activeDownloads));
            await archiveDescriptor.write(
                segment.buffer,
                0,
                segment.count,
                segment.offset
            );
            actives--;
            delete activeDownloads[segment.offset];
            bytesDownloaded += segment.count;
            progressFn({ loadedBytes: bytesDownloaded });
        };

        while ((nextDownload = downloads.pop())) {
            activeDownloads[nextDownload.offset] = nextDownload.promiseGetter();
            actives++;

            if (actives >= (options.downloadConcurrency ?? 10)) {
                await waitAndWrite();
            }
        }

        while (actives > 0) {
            await waitAndWrite();
        }
    } finally {
        httpClient.dispose();
        await archiveDescriptor.close();
    }
}

async function downloadSegmentRetry(
    httpClient: HttpClient,
    archiveLocation: string,
    offset: number,
    count: number
): Promise<DownloadSegment> {
    const retries = 5;
    let failures = 0;

    while (true) {
        try {
            const timeout = 30000;
            const result = await promiseWithTimeout(
                timeout,
                downloadSegment(httpClient, archiveLocation, offset, count)
            );
            if (typeof result === "string") {
                throw new Error("downloadSegmentRetry failed due to timeout");
            }

            return result;
        } catch (err) {
            if (failures >= retries) {
                throw err;
            }

            failures++;
        }
    }
}

async function downloadSegment(
    httpClient: HttpClient,
    archiveLocation: string,
    offset: number,
    count: number
): Promise<DownloadSegment> {
    const partRes = await retryHttpClientResponse(
        "downloadCachePart",
        async () =>
            await httpClient.get(archiveLocation, {
                Range: `bytes=${offset}-${offset + count - 1}`
            })
    );

    if (!partRes.readBodyBuffer) {
        throw new Error(
            "Expected HttpClientResponse to implement readBodyBuffer"
        );
    }

    return {
        offset,
        count,
        buffer: await partRes.readBodyBuffer()
    };
}

declare class DownloadSegment {
    offset: number;
    count: number;
    buffer: Buffer;
}

const promiseWithTimeout = async <T>(
    timeoutMs: number,
    promise: Promise<T>
): Promise<T | string> => {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<string>(resolve => {
        timeoutHandle = setTimeout(() => resolve("timeout"), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).then(result => {
        clearTimeout(timeoutHandle);
        return result;
    });
};
