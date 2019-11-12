import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";

import * as path from "path";

import * as cacheHttpClient from "../src/cacheHttpClient";
import { Events, Inputs } from "../src/constants";
import { ArtifactCacheEntry } from "../src/contracts";
import run from "../src/restore";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/exec");
jest.mock("@actions/io");
jest.mock("../src/utils/actionUtils");
jest.mock("../src/cacheHttpClient");

beforeAll(() => {
    jest.spyOn(actionUtils, "resolvePath").mockImplementation(filePath => {
        return path.resolve(filePath);
    });

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

    jest.spyOn(actionUtils, "getSupportedEvents").mockImplementation(() => {
        const actualUtils = jest.requireActual("../src/utils/actionUtils");
        return actualUtils.getSupportedEvents();
    });

    jest.spyOn(io, "which").mockImplementation(tool => {
        return Promise.resolve(tool);
    });
});

beforeEach(() => {
    process.env[Events.Key] = Events.Push;
});

afterEach(() => {
    testUtils.clearInputs();
    delete process.env[Events.Key];
});

test("restore with invalid event", async () => {
    const failedMock = jest.spyOn(core, "setFailed");
    const invalidEvent = "commit_comment";
    process.env[Events.Key] = invalidEvent;
    await run();
    expect(failedMock).toHaveBeenCalledWith(
        `Event Validation Error: The event type ${invalidEvent} is not supported. Only push, pull_request events are supported at this time.`
    );
});

test("restore with no path should fail", async () => {
    const failedMock = jest.spyOn(core, "setFailed");
    await run();
    expect(failedMock).toHaveBeenCalledWith(
        "Input required and not supplied: path"
    );
});

test("restore with no key", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");
    const failedMock = jest.spyOn(core, "setFailed");
    await run();
    expect(failedMock).toHaveBeenCalledWith(
        "Input required and not supplied: key"
    );
});

test("restore with too many keys should fail", async () => {
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
});

test("restore with large key should fail", async () => {
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
});

test("restore with invalid key should fail", async () => {
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
});

test("restore with no cache found", async () => {
    const key = "node-test";
    testUtils.setInputs({
        path: "node_modules",
        key
    });

    const infoMock = jest.spyOn(core, "info");
    const warningMock = jest.spyOn(core, "warning");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");

    const clientMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
    clientMock.mockImplementation(_ => {
        return Promise.resolve(null);
    });

    await run();

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(warningMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledTimes(0);

    expect(infoMock).toHaveBeenCalledWith(
        `Cache not found for input keys: ${key}.`
    );
});

test("restore with server error should fail", async () => {
    const key = "node-test";
    testUtils.setInputs({
        path: "node_modules",
        key
    });

    const warningMock = jest.spyOn(core, "warning");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");

    const clientMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
    clientMock.mockImplementation(_ => {
        throw new Error("HTTP Error Occurred");
    });

    const setCacheHitOutputMock = jest.spyOn(actionUtils, "setCacheHitOutput");

    await run();

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);

    expect(warningMock).toHaveBeenCalledTimes(1);
    expect(warningMock).toHaveBeenCalledWith("HTTP Error Occurred");

    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith(false);

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with restore keys and no cache found", async () => {
    const key = "node-test";
    const restoreKey = "node-";
    testUtils.setInputs({
        path: "node_modules",
        key,
        restoreKeys: [restoreKey]
    });

    const infoMock = jest.spyOn(core, "info");
    const warningMock = jest.spyOn(core, "warning");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");

    const clientMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
    clientMock.mockImplementation(_ => {
        return Promise.resolve(null);
    });

    await run();

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(warningMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledTimes(0);

    expect(infoMock).toHaveBeenCalledWith(
        `Cache not found for input keys: ${key}, ${restoreKey}.`
    );
});

test("restore with cache found", async () => {
    const key = "node-test";
    const cachePath = path.resolve("node_modules");
    testUtils.setInputs({
        path: "node_modules",
        key
    });

    const infoMock = jest.spyOn(core, "info");
    const warningMock = jest.spyOn(core, "warning");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");

    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: key,
        scope: "refs/heads/master",
        archiveLocation: "www.actionscache.test/download"
    };
    const getCacheMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
    getCacheMock.mockImplementation(_ => {
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

    const archivePath = path.join(tempPath, "cache.tgz");
    const setCacheStateMock = jest.spyOn(actionUtils, "setCacheState");
    const downloadCacheMock = jest.spyOn(cacheHttpClient, "downloadCache");

    const fileSize = 142;
    const getArchiveFileSizeMock = jest
        .spyOn(actionUtils, "getArchiveFileSize")
        .mockReturnValue(fileSize);

    const mkdirMock = jest.spyOn(io, "mkdirP");
    const execMock = jest.spyOn(exec, "exec");
    const setCacheHitOutputMock = jest.spyOn(actionUtils, "setCacheHitOutput");

    await run();

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(getCacheMock).toHaveBeenCalledWith([key]);
    expect(setCacheStateMock).toHaveBeenCalledWith(cacheEntry);
    expect(createTempDirectoryMock).toHaveBeenCalledTimes(1);
    expect(downloadCacheMock).toHaveBeenCalledWith(cacheEntry, archivePath);
    expect(getArchiveFileSizeMock).toHaveBeenCalledWith(archivePath);
    expect(mkdirMock).toHaveBeenCalledWith(cachePath);

    const IS_WINDOWS = process.platform === "win32";
    const tarArchivePath = IS_WINDOWS
        ? archivePath.replace(/\\/g, "/")
        : archivePath;
    const tarCachePath = IS_WINDOWS ? cachePath.replace(/\\/g, "/") : cachePath;
    const args = IS_WINDOWS ? ["-xz", "--force-local"] : ["-xz"];
    args.push(...["-f", tarArchivePath, "-C", tarCachePath]);

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"tar"`, args);

    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith(true);

    expect(infoMock).toHaveBeenCalledWith(`Cache restored from key: ${key}`);
    expect(warningMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with a pull request event and cache found", async () => {
    const key = "node-test";
    const cachePath = path.resolve("node_modules");
    testUtils.setInputs({
        path: "node_modules",
        key
    });

    process.env[Events.Key] = Events.PullRequest;

    const infoMock = jest.spyOn(core, "info");
    const warningMock = jest.spyOn(core, "warning");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");

    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: key,
        scope: "refs/heads/master",
        archiveLocation: "https://www.example.com/download"
    };
    const getCacheMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
    getCacheMock.mockImplementation(_ => {
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

    const archivePath = path.join(tempPath, "cache.tgz");
    const setCacheStateMock = jest.spyOn(actionUtils, "setCacheState");
    const downloadCacheMock = jest.spyOn(cacheHttpClient, "downloadCache");

    const fileSize = 142;
    const getArchiveFileSizeMock = jest
        .spyOn(actionUtils, "getArchiveFileSize")
        .mockReturnValue(fileSize);

    const mkdirMock = jest.spyOn(io, "mkdirP");
    const execMock = jest.spyOn(exec, "exec");
    const setCacheHitOutputMock = jest.spyOn(actionUtils, "setCacheHitOutput");

    await run();

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(getCacheMock).toHaveBeenCalledWith([key]);
    expect(setCacheStateMock).toHaveBeenCalledWith(cacheEntry);
    expect(createTempDirectoryMock).toHaveBeenCalledTimes(1);
    expect(downloadCacheMock).toHaveBeenCalledWith(cacheEntry, archivePath);
    expect(getArchiveFileSizeMock).toHaveBeenCalledWith(archivePath);
    expect(mkdirMock).toHaveBeenCalledWith(cachePath);

    const IS_WINDOWS = process.platform === "win32";
    const tarArchivePath = IS_WINDOWS
        ? archivePath.replace(/\\/g, "/")
        : archivePath;
    const tarCachePath = IS_WINDOWS ? cachePath.replace(/\\/g, "/") : cachePath;
    const args = IS_WINDOWS ? ["-xz", "--force-local"] : ["-xz"];
    args.push(...["-f", tarArchivePath, "-C", tarCachePath]);

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"tar"`, args);

    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith(true);

    expect(infoMock).toHaveBeenCalledWith(`Cache restored from key: ${key}`);
    expect(warningMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with cache found for restore key", async () => {
    const key = "node-test";
    const restoreKey = "node-";
    const cachePath = path.resolve("node_modules");
    testUtils.setInputs({
        path: "node_modules",
        key,
        restoreKeys: [restoreKey]
    });

    const infoMock = jest.spyOn(core, "info");
    const warningMock = jest.spyOn(core, "warning");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");

    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: restoreKey,
        scope: "refs/heads/master",
        archiveLocation: "www.actionscache.test/download"
    };
    const getCacheMock = jest.spyOn(cacheHttpClient, "getCacheEntry");
    getCacheMock.mockImplementation(_ => {
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

    const archivePath = path.join(tempPath, "cache.tgz");
    const setCacheStateMock = jest.spyOn(actionUtils, "setCacheState");
    const downloadCacheMock = jest.spyOn(cacheHttpClient, "downloadCache");

    const fileSize = 142;
    const getArchiveFileSizeMock = jest
        .spyOn(actionUtils, "getArchiveFileSize")
        .mockReturnValue(fileSize);

    const mkdirMock = jest.spyOn(io, "mkdirP");
    const execMock = jest.spyOn(exec, "exec");
    const setCacheHitOutputMock = jest.spyOn(actionUtils, "setCacheHitOutput");

    await run();

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(getCacheMock).toHaveBeenCalledWith([key, restoreKey]);
    expect(setCacheStateMock).toHaveBeenCalledWith(cacheEntry);
    expect(createTempDirectoryMock).toHaveBeenCalledTimes(1);
    expect(downloadCacheMock).toHaveBeenCalledWith(cacheEntry, archivePath);
    expect(getArchiveFileSizeMock).toHaveBeenCalledWith(archivePath);
    expect(mkdirMock).toHaveBeenCalledWith(cachePath);

    const IS_WINDOWS = process.platform === "win32";
    const tarArchivePath = IS_WINDOWS
        ? archivePath.replace(/\\/g, "/")
        : archivePath;
    const tarCachePath = IS_WINDOWS ? cachePath.replace(/\\/g, "/") : cachePath;
    const args = IS_WINDOWS ? ["-xz", "--force-local"] : ["-xz"];
    args.push(...["-f", tarArchivePath, "-C", tarCachePath]);

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"tar"`, args);

    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith(false);

    expect(infoMock).toHaveBeenCalledWith(
        `Cache restored from key: ${restoreKey}`
    );
    expect(warningMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledTimes(0);
});
