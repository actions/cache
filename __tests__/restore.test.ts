import * as core from "@actions/core";
import * as path from "path";

import * as cacheHttpClient from "../src/cacheHttpClient";
import {
    CacheFilename,
    CompressionMethod,
    Events,
    Inputs,
    RefKeys
} from "../src/constants";
import { ArtifactCacheEntry } from "../src/contracts";
import run from "../src/restore";
import * as tar from "../src/tar";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("../src/cacheHttpClient");
jest.mock("../src/tar");
jest.mock("../src/utils/actionUtils");

beforeAll(() => {
    jest.spyOn(actionUtils, "isExactKeyMatch").mockImplementation(
        (key, cacheResult) => {
            const actualUtils = jest.requireActual("../src/utils/actionUtils");
            return actualUtils.isExactKeyMatch(key, cacheResult);
        }
    );

    jest.spyOn(actionUtils, "isValidEvent").mockImplementation(() => {
        const actualUtils = jest.requireActual("../src/utils/actionUtils");
        return actualUtils.isValidEvent();
    });

    jest.spyOn(actionUtils, "getCacheFileName").mockImplementation(cm => {
        const actualUtils = jest.requireActual("../src/utils/actionUtils");
        return actualUtils.getCacheFileName(cm);
    });
});

beforeEach(() => {
    process.env[Events.Key] = Events.Push;
});

afterEach(() => {
    testUtils.clearInputs();
    delete process.env[Events.Key];

    RefKeys.forEach(refKey => delete process.env[refKey]);
});

const refKeySet = RefKeys.map(refKey => {
    return [refKey, `refs/heads/feature/${refKey.toLowerCase()}`];
});

test("restore with invalid event outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");
    const invalidEvent = "commit_comment";
    process.env[Events.Key] = invalidEvent;
    await run();
    expect(logWarningMock).toHaveBeenCalledWith(
        `Event Validation Error: The event type ${invalidEvent} is not supported because it's not tied to a branch or tag ref.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test.each(refKeySet)(
    "restore with no path should fail",
    async (refKey, ref) => {
        process.env[refKey] = ref;

        const failedMock = jest.spyOn(core, "setFailed");
        await run();
        // this input isn't necessary for restore b/c tarball contains entries relative to workspace
        expect(failedMock).not.toHaveBeenCalledWith(
            "Input required and not supplied: path"
        );
    }
);

test.each(refKeySet)("restore with no key", async (refKey, ref) => {
    process.env[refKey] = ref;

    testUtils.setInput(Inputs.Path, "node_modules");
    const failedMock = jest.spyOn(core, "setFailed");
    await run();
    expect(failedMock).toHaveBeenCalledWith(
        "Input required and not supplied: key"
    );
});

test.each(refKeySet)(
    "restore with too many keys should fail",
    async (refKey, ref) => {
        process.env[refKey] = ref;

        const key = "node-test";
        const restoreKeys = [...Array(20).keys()].map(x => x.toString());
        testUtils.setInputs({
            path: "node_modules",
            key,
            restoreKeys
        });
        const failedMock = jest.spyOn(core, "setFailed");
        await run();
        expect(failedMock).toHaveBeenCalledWith(
            `Key Validation Error: Keys are limited to a maximum of 10.`
        );
    }
);

test.each(refKeySet)(
    "restore with large key should fail",
    async (refKey, ref) => {
        process.env[refKey] = ref;

        const key = "foo".repeat(512); // Over the 512 character limit
        testUtils.setInputs({
            path: "node_modules",
            key
        });
        const failedMock = jest.spyOn(core, "setFailed");
        await run();
        expect(failedMock).toHaveBeenCalledWith(
            `Key Validation Error: ${key} cannot be larger than 512 characters.`
        );
    }
);

test.each(refKeySet)(
    "restore with invalid key should fail",
    async (refKey, ref) => {
        process.env[refKey] = ref;

        const key = "comma,comma";
        testUtils.setInputs({
            path: "node_modules",
            key
        });
        const failedMock = jest.spyOn(core, "setFailed");
        await run();
        expect(failedMock).toHaveBeenCalledWith(
            `Key Validation Error: ${key} cannot contain commas.`
        );
    }
);

test.each(refKeySet)("restore with no cache found", async (refKey, ref) => {
    process.env[refKey] = ref;

    const key = "node-test";
    testUtils.setInputs({
        path: "node_modules",
        key
    });

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");

    const clientMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
    clientMock.mockImplementation(() => {
        return Promise.resolve(null);
    });

    await run();

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(failedMock).toHaveBeenCalledTimes(0);

    expect(infoMock).toHaveBeenCalledWith(
        `Cache not found for input keys: ${key}`
    );
});

test.each(refKeySet)(
    "restore with server error should fail",
    async (refKey, ref) => {
        process.env[refKey] = ref;

        const key = "node-test";
        testUtils.setInputs({
            path: "node_modules",
            key
        });

        const logWarningMock = jest.spyOn(actionUtils, "logWarning");
        const failedMock = jest.spyOn(core, "setFailed");
        const stateMock = jest.spyOn(core, "saveState");

        const clientMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
        clientMock.mockImplementation(() => {
            throw new Error("HTTP Error Occurred");
        });

        const setCacheHitOutputMock = jest.spyOn(
            actionUtils,
            "setCacheHitOutput"
        );

        await run();

        expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);

        expect(logWarningMock).toHaveBeenCalledTimes(1);
        expect(logWarningMock).toHaveBeenCalledWith("HTTP Error Occurred");

        expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
        expect(setCacheHitOutputMock).toHaveBeenCalledWith(false);

        expect(failedMock).toHaveBeenCalledTimes(0);
    }
);

test.each(refKeySet)(
    "restore with restore keys and no cache found",
    async (refKey, ref) => {
        process.env[refKey] = ref;

        const key = "node-test";
        const restoreKey = "node-";
        testUtils.setInputs({
            path: "node_modules",
            key,
            restoreKeys: [restoreKey]
        });

        const infoMock = jest.spyOn(core, "info");
        const failedMock = jest.spyOn(core, "setFailed");
        const stateMock = jest.spyOn(core, "saveState");

        const clientMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
        clientMock.mockImplementation(() => {
            return Promise.resolve(null);
        });

        await run();

        expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
        expect(failedMock).toHaveBeenCalledTimes(0);

        expect(infoMock).toHaveBeenCalledWith(
            `Cache not found for input keys: ${key}, ${restoreKey}`
        );
    }
);

test.each(refKeySet)(
    "restore with gzip compressed cache found",
    async (refKey, ref) => {
        process.env[refKey] = ref;

        const key = "node-test";
        testUtils.setInputs({
            path: "node_modules",
            key
        });

        const infoMock = jest.spyOn(core, "info");
        const failedMock = jest.spyOn(core, "setFailed");
        const stateMock = jest.spyOn(core, "saveState");

        const cacheEntry: ArtifactCacheEntry = {
            cacheKey: key,
            scope: "refs/heads/master",
            archiveLocation: "www.actionscache.test/download"
        };
        const getCacheMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
        getCacheMock.mockImplementation(() => {
            return Promise.resolve(cacheEntry);
        });
        const tempPath = "/foo/bar";

        const createTempDirectoryMock = jest.spyOn(
            actionUtils,
            "createTempDirectory"
        );
        createTempDirectoryMock.mockImplementation(() => {
            return Promise.resolve(tempPath);
        });

        const archivePath = path.join(tempPath, CacheFilename.Gzip);
        const setCacheStateMock = jest.spyOn(actionUtils, "setCacheState");
        const downloadCacheMock = jest.spyOn(cacheHttpClient, "downloadCache");

        const fileSize = 142;
        const getArchiveFileSizeMock = jest
            .spyOn(actionUtils, "getArchiveFileSize")
            .mockReturnValue(fileSize);

        const extractTarMock = jest.spyOn(tar, "extractTar");
        const unlinkFileMock = jest.spyOn(actionUtils, "unlinkFile");
        const setCacheHitOutputMock = jest.spyOn(
            actionUtils,
            "setCacheHitOutput"
        );

        const compression = CompressionMethod.Gzip;
        const getCompressionMock = jest
            .spyOn(actionUtils, "getCompressionMethod")
            .mockReturnValue(Promise.resolve(compression));

        await run();

        expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
        expect(getCacheMock).toHaveBeenCalledWith([key], {
            compressionMethod: compression
        });
        expect(setCacheStateMock).toHaveBeenCalledWith(cacheEntry);
        expect(createTempDirectoryMock).toHaveBeenCalledTimes(1);
        expect(downloadCacheMock).toHaveBeenCalledWith(
            cacheEntry.archiveLocation,
            archivePath
        );
        expect(getArchiveFileSizeMock).toHaveBeenCalledWith(archivePath);

        expect(extractTarMock).toHaveBeenCalledTimes(1);
        expect(extractTarMock).toHaveBeenCalledWith(archivePath, compression);

        expect(unlinkFileMock).toHaveBeenCalledTimes(1);
        expect(unlinkFileMock).toHaveBeenCalledWith(archivePath);

        expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
        expect(setCacheHitOutputMock).toHaveBeenCalledWith(true);

        expect(infoMock).toHaveBeenCalledWith(
            `Cache restored from key: ${key}`
        );
        expect(failedMock).toHaveBeenCalledTimes(0);
        expect(getCompressionMock).toHaveBeenCalledTimes(1);
    }
);

test.each(refKeySet)(
    "restore with a pull request event and zstd compressed cache found",
    async (refKey, ref) => {
        process.env[refKey] = ref;

        const key = "node-test";
        testUtils.setInputs({
            path: "node_modules",
            key
        });

        process.env[Events.Key] = Events.PullRequest;

        const infoMock = jest.spyOn(core, "info");
        const failedMock = jest.spyOn(core, "setFailed");
        const stateMock = jest.spyOn(core, "saveState");

        const cacheEntry: ArtifactCacheEntry = {
            cacheKey: key,
            scope: "refs/heads/master",
            archiveLocation: "www.actionscache.test/download"
        };
        const getCacheMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
        getCacheMock.mockImplementation(() => {
            return Promise.resolve(cacheEntry);
        });
        const tempPath = "/foo/bar";

        const createTempDirectoryMock = jest.spyOn(
            actionUtils,
            "createTempDirectory"
        );
        createTempDirectoryMock.mockImplementation(() => {
            return Promise.resolve(tempPath);
        });

        const archivePath = path.join(tempPath, CacheFilename.Zstd);
        const setCacheStateMock = jest.spyOn(actionUtils, "setCacheState");
        const downloadCacheMock = jest.spyOn(cacheHttpClient, "downloadCache");

        const fileSize = 62915000;
        const getArchiveFileSizeMock = jest
            .spyOn(actionUtils, "getArchiveFileSize")
            .mockReturnValue(fileSize);

        const extractTarMock = jest.spyOn(tar, "extractTar");
        const setCacheHitOutputMock = jest.spyOn(
            actionUtils,
            "setCacheHitOutput"
        );
        const compression = CompressionMethod.Zstd;
        const getCompressionMock = jest
            .spyOn(actionUtils, "getCompressionMethod")
            .mockReturnValue(Promise.resolve(compression));

        await run();

        expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
        expect(getCacheMock).toHaveBeenCalledWith([key], {
            compressionMethod: compression
        });
        expect(setCacheStateMock).toHaveBeenCalledWith(cacheEntry);
        expect(createTempDirectoryMock).toHaveBeenCalledTimes(1);
        expect(downloadCacheMock).toHaveBeenCalledWith(
            cacheEntry.archiveLocation,
            archivePath
        );
        expect(getArchiveFileSizeMock).toHaveBeenCalledWith(archivePath);
        expect(infoMock).toHaveBeenCalledWith(
            `Cache Size: ~60 MB (62915000 B)`
        );

        expect(extractTarMock).toHaveBeenCalledTimes(1);
        expect(extractTarMock).toHaveBeenCalledWith(archivePath, compression);

        expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
        expect(setCacheHitOutputMock).toHaveBeenCalledWith(true);

        expect(infoMock).toHaveBeenCalledWith(
            `Cache restored from key: ${key}`
        );
        expect(failedMock).toHaveBeenCalledTimes(0);
        expect(getCompressionMock).toHaveBeenCalledTimes(1);
    }
);

test.each(refKeySet)(
    "restore with cache found for restore key",
    async (refKey, ref) => {
        process.env[refKey] = ref;

        const key = "node-test";
        const restoreKey = "node-";
        testUtils.setInputs({
            path: "node_modules",
            key,
            restoreKeys: [restoreKey]
        });

        const infoMock = jest.spyOn(core, "info");
        const failedMock = jest.spyOn(core, "setFailed");
        const stateMock = jest.spyOn(core, "saveState");

        const cacheEntry: ArtifactCacheEntry = {
            cacheKey: restoreKey,
            scope: "refs/heads/master",
            archiveLocation: "www.actionscache.test/download"
        };
        const getCacheMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
        getCacheMock.mockImplementation(() => {
            return Promise.resolve(cacheEntry);
        });
        const tempPath = "/foo/bar";

        const createTempDirectoryMock = jest.spyOn(
            actionUtils,
            "createTempDirectory"
        );
        createTempDirectoryMock.mockImplementation(() => {
            return Promise.resolve(tempPath);
        });

        const archivePath = path.join(tempPath, CacheFilename.Zstd);
        const setCacheStateMock = jest.spyOn(actionUtils, "setCacheState");
        const downloadCacheMock = jest.spyOn(cacheHttpClient, "downloadCache");

        const fileSize = 142;
        const getArchiveFileSizeMock = jest
            .spyOn(actionUtils, "getArchiveFileSize")
            .mockReturnValue(fileSize);

        const extractTarMock = jest.spyOn(tar, "extractTar");
        const setCacheHitOutputMock = jest.spyOn(
            actionUtils,
            "setCacheHitOutput"
        );
        const compression = CompressionMethod.Zstd;
        const getCompressionMock = jest
            .spyOn(actionUtils, "getCompressionMethod")
            .mockReturnValue(Promise.resolve(compression));

        await run();

        expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
        expect(getCacheMock).toHaveBeenCalledWith([key, restoreKey], {
            compressionMethod: compression
        });
        expect(setCacheStateMock).toHaveBeenCalledWith(cacheEntry);
        expect(createTempDirectoryMock).toHaveBeenCalledTimes(1);
        expect(downloadCacheMock).toHaveBeenCalledWith(
            cacheEntry.archiveLocation,
            archivePath
        );
        expect(getArchiveFileSizeMock).toHaveBeenCalledWith(archivePath);
        expect(infoMock).toHaveBeenCalledWith(`Cache Size: ~0 MB (142 B)`);

        expect(extractTarMock).toHaveBeenCalledTimes(1);
        expect(extractTarMock).toHaveBeenCalledWith(archivePath, compression);

        expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
        expect(setCacheHitOutputMock).toHaveBeenCalledWith(false);

        expect(infoMock).toHaveBeenCalledWith(
            `Cache restored from key: ${restoreKey}`
        );
        expect(failedMock).toHaveBeenCalledTimes(0);
        expect(getCompressionMock).toHaveBeenCalledTimes(1);
    }
);
