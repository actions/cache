import * as core from "@actions/core";
import * as fs from "fs";
import nock from "nock";
import * as path from "path";

import { DownloadValidationError, restoreCache } from "../src/custom/cache";
import { downloadCacheHttpClientConcurrent } from "../src/custom/downloadUtils";

// Mock the core module
jest.mock("@actions/core");

// Mock fs for file size checks
jest.mock("fs", () => ({
    ...jest.requireActual("fs"),
    promises: {
        ...jest.requireActual("fs").promises,
        open: jest.fn()
    }
}));

describe("Download Validation", () => {
    const testArchivePath = "/tmp/test-cache.tar.gz";
    const testUrl = "https://example.com/cache.tar.gz";

    beforeEach(() => {
        jest.clearAllMocks();
        nock.cleanAll();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe("downloadCacheHttpClientConcurrent", () => {
        it("should validate downloaded size matches expected content-length", async () => {
            const expectedSize = 1024;
            const mockFileDescriptor = {
                write: jest.fn().mockResolvedValue(undefined),
                close: jest.fn().mockResolvedValue(undefined)
            };

            (fs.promises.open as jest.Mock).mockResolvedValue(
                mockFileDescriptor
            );

            // Mock the initial range request to get content length
            nock("https://example.com")
                .get("/cache.tar.gz")
                .reply(206, "partial content", {
                    "content-range": `bytes 0-1/${expectedSize}`
                });

            // Mock the actual content download with wrong size
            nock("https://example.com")
                .get("/cache.tar.gz")
                .reply(206, Buffer.alloc(512), {
                    // Return only 512 bytes instead of 1024
                    "content-range": "bytes 0-511/1024"
                });

            await expect(
                downloadCacheHttpClientConcurrent(testUrl, testArchivePath, {
                    timeoutInMs: 30000,
                    partSize: 1024
                })
            ).rejects.toThrow(
                "Download validation failed: Expected 1024 bytes but downloaded 512 bytes"
            );
        });

        it("should succeed when downloaded size matches expected", async () => {
            const expectedSize = 1024;
            const testContent = Buffer.alloc(expectedSize);
            const mockFileDescriptor = {
                write: jest.fn().mockResolvedValue(undefined),
                close: jest.fn().mockResolvedValue(undefined)
            };

            (fs.promises.open as jest.Mock).mockResolvedValue(
                mockFileDescriptor
            );

            // Mock the initial range request
            nock("https://example.com")
                .get("/cache.tar.gz")
                .reply(206, "partial content", {
                    "content-range": `bytes 0-1/${expectedSize}`
                });

            // Mock the actual content download with correct size
            nock("https://example.com")
                .get("/cache.tar.gz")
                .reply(206, testContent, {
                    "content-range": `bytes 0-${
                        expectedSize - 1
                    }/${expectedSize}`
                });

            await expect(
                downloadCacheHttpClientConcurrent(testUrl, testArchivePath, {
                    timeoutInMs: 30000,
                    partSize: expectedSize
                })
            ).resolves.not.toThrow();
        });
    });

    describe("restoreCache validation", () => {
        beforeEach(() => {
            // Mock environment variables for S3 backend
            process.env.RUNS_ON_S3_BUCKET_CACHE = "test-bucket";
            process.env.RUNS_ON_AWS_REGION = "us-east-1";
        });

        afterEach(() => {
            delete process.env.RUNS_ON_S3_BUCKET_CACHE;
            delete process.env.RUNS_ON_AWS_REGION;
        });

        it("should throw DownloadValidationError for empty files", async () => {
            // Mock the cache lookup to return a valid cache entry
            const mockCacheHttpClient = require("../src/custom/backend");
            jest.spyOn(mockCacheHttpClient, "getCacheEntry").mockResolvedValue({
                cacheKey: "test-key",
                archiveLocation: "https://s3.example.com/cache.tar.gz"
            });

            // Mock the download to succeed
            jest.spyOn(mockCacheHttpClient, "downloadCache").mockResolvedValue(
                undefined
            );

            // Mock utils to return 0 file size (empty file)
            const mockUtils = require("@actions/cache/lib/internal/cacheUtils");
            jest.spyOn(mockUtils, "getArchiveFileSizeInBytes").mockReturnValue(
                0
            );
            jest.spyOn(mockUtils, "createTempDirectory").mockResolvedValue(
                "/tmp"
            );
            jest.spyOn(mockUtils, "getCacheFileName").mockReturnValue(
                "cache.tar.gz"
            );

            const coreSpy = jest.spyOn(core, "warning");

            const result = await restoreCache(["/test/path"], "test-key");

            expect(result).toBeUndefined(); // Should return undefined on validation failure
            expect(coreSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Cache download validation failed: Downloaded cache archive is empty"
                )
            );
        });

        it("should throw DownloadValidationError for files too small", async () => {
            // Mock the cache lookup to return a valid cache entry
            const mockCacheHttpClient = require("../src/custom/backend");
            jest.spyOn(mockCacheHttpClient, "getCacheEntry").mockResolvedValue({
                cacheKey: "test-key",
                archiveLocation: "https://s3.example.com/cache.tar.gz"
            });

            // Mock the download to succeed
            jest.spyOn(mockCacheHttpClient, "downloadCache").mockResolvedValue(
                undefined
            );

            // Mock utils to return small file size (less than 512 bytes)
            const mockUtils = require("@actions/cache/lib/internal/cacheUtils");
            jest.spyOn(mockUtils, "getArchiveFileSizeInBytes").mockReturnValue(
                100
            );
            jest.spyOn(mockUtils, "createTempDirectory").mockResolvedValue(
                "/tmp"
            );
            jest.spyOn(mockUtils, "getCacheFileName").mockReturnValue(
                "cache.tar.gz"
            );

            const coreSpy = jest.spyOn(core, "warning");

            const result = await restoreCache(["/test/path"], "test-key");

            expect(result).toBeUndefined(); // Should return undefined on validation failure
            expect(coreSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Cache download validation failed: Downloaded cache archive is too small (100 bytes)"
                )
            );
        });

        it("should succeed with valid file size", async () => {
            // Mock the cache lookup to return a valid cache entry
            const mockCacheHttpClient = require("../src/custom/backend");
            jest.spyOn(mockCacheHttpClient, "getCacheEntry").mockResolvedValue({
                cacheKey: "test-key",
                archiveLocation: "https://s3.example.com/cache.tar.gz"
            });

            // Mock the download to succeed
            jest.spyOn(mockCacheHttpClient, "downloadCache").mockResolvedValue(
                undefined
            );

            // Mock utils to return valid file size (>= 512 bytes)
            const mockUtils = require("@actions/cache/lib/internal/cacheUtils");
            jest.spyOn(mockUtils, "getArchiveFileSizeInBytes").mockReturnValue(
                1024
            );
            jest.spyOn(mockUtils, "createTempDirectory").mockResolvedValue(
                "/tmp"
            );
            jest.spyOn(mockUtils, "getCacheFileName").mockReturnValue(
                "cache.tar.gz"
            );
            jest.spyOn(mockUtils, "getCompressionMethod").mockResolvedValue(
                "gzip"
            );

            // Mock tar operations
            const mockTar = require("@actions/cache/lib/internal/tar");
            jest.spyOn(mockTar, "extractTar").mockResolvedValue(undefined);
            jest.spyOn(mockTar, "listTar").mockResolvedValue(undefined);

            const result = await restoreCache(["/test/path"], "test-key");

            expect(result).toBe("test-key"); // Should return the cache key on success
        });
    });
});
