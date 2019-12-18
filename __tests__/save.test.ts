import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as path from "path";
import * as cacheHttpClient from "../src/cacheHttpClient";
import { Events, Inputs } from "../src/constants";
import { ArtifactCacheEntry } from "../src/contracts";
import run from "../src/save";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("@actions/exec");
jest.mock("@actions/io");
jest.mock("../src/utils/actionUtils");
jest.mock("../src/cacheHttpClient");

beforeAll(() => {
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });

    jest.spyOn(actionUtils, "getCacheState").mockImplementation(() => {
        return jest.requireActual("../src/utils/actionUtils").getCacheState();
    });

    jest.spyOn(actionUtils, "isExactKeyMatch").mockImplementation(
        (key, cacheResult) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .isExactKeyMatch(key, cacheResult);
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

    jest.spyOn(actionUtils, "resolvePath").mockImplementation(filePath => {
        return path.resolve(filePath);
    });

    jest.spyOn(actionUtils, "createTempDirectory").mockImplementation(() => {
        return Promise.resolve("/foo/bar");
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

test("save with invalid event outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");
    const invalidEvent = "commit_comment";
    process.env[Events.Key] = invalidEvent;
    await run();
    expect(logWarningMock).toHaveBeenCalledWith(
        `Event Validation Error: The event type ${invalidEvent} is not supported. Only push, pull_request events are supported at this time.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with no primary key in state outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43",
        scope: "refs/heads/master",
        creationTime: "2019-11-13T19:18:02+00:00",
        archiveLocation: "www.actionscache.test/download"
    };

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return JSON.stringify(cacheEntry);
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return "";
        });

    await run();

    expect(logWarningMock).toHaveBeenCalledWith(
        `Error retrieving key from state.`
    );
    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with exact match returns early", async () => {
    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: primaryKey,
        scope: "refs/heads/master",
        creationTime: "2019-11-13T19:18:02+00:00",
        archiveLocation: "www.actionscache.test/download"
    };

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return JSON.stringify(cacheEntry);
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const execMock = jest.spyOn(exec, "exec");

    await run();

    expect(infoMock).toHaveBeenCalledWith(
        `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );

    expect(execMock).toHaveBeenCalledTimes(0);

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with missing input outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "Linux-node-",
        scope: "refs/heads/master",
        creationTime: "2019-11-13T19:18:02+00:00",
        archiveLocation: "www.actionscache.test/download"
    };

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return JSON.stringify(cacheEntry);
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    await run();

    expect(logWarningMock).toHaveBeenCalledWith(
        "Input required and not supplied: path"
    );
    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with large cache outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "Linux-node-",
        scope: "refs/heads/master",
        creationTime: "2019-11-13T19:18:02+00:00",
        archiveLocation: "www.actionscache.test/download"
    };

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return JSON.stringify(cacheEntry);
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    const cachePath = path.resolve(inputPath);
    testUtils.setInput(Inputs.Path, inputPath);

    const execMock = jest.spyOn(exec, "exec");

    const cacheSize = 4 * 1024 * 1024 * 1024; //~4GB, over the 2GB limit
    jest.spyOn(actionUtils, "getArchiveFileSize").mockImplementationOnce(() => {
        return cacheSize;
    });

    await run();

    const archivePath = path.join("/foo/bar", "cache.tgz");

    const IS_WINDOWS = process.platform === "win32";
    const args = IS_WINDOWS
        ? [
            "-cz",
            "--force-local",
            "-f",
            archivePath.replace(/\\/g, "/"),
            "-C",
            cachePath.replace(/\\/g, "/"),
            "."
        ]
        : ["-cz", "-f", archivePath, "-C", cachePath, "."];

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"tar"`, args);

    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(logWarningMock).toHaveBeenCalledWith(
        "Cache size of ~4 GB (4294967296 B) is over the 2GB limit, not saving cache."
    );

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with server error outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "Linux-node-",
        scope: "refs/heads/master",
        creationTime: "2019-11-13T19:18:02+00:00",
        archiveLocation: "www.actionscache.test/download"
    };

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return JSON.stringify(cacheEntry);
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    const cachePath = path.resolve(inputPath);
    testUtils.setInput(Inputs.Path, inputPath);

    const cacheId = 4;
    const reserveCacheMock = jest.spyOn(cacheHttpClient, "reserveCache").mockImplementationOnce(() => {
        return Promise.resolve(cacheId);
    });

    const execMock = jest.spyOn(exec, "exec");

    const saveCacheMock = jest
        .spyOn(cacheHttpClient, "saveCache")
        .mockImplementationOnce(() => {
            throw new Error("HTTP Error Occurred");
        });

    await run();

    expect(reserveCacheMock).toHaveBeenCalledTimes(1);
    expect(reserveCacheMock).toHaveBeenCalledWith(primaryKey);

    const archivePath = path.join("/foo/bar", "cache.tgz");

    const IS_WINDOWS = process.platform === "win32";
    const args = IS_WINDOWS
        ? [
            "-cz",
            "--force-local",
            "-f",
            archivePath.replace(/\\/g, "/"),
            "-C",
            cachePath.replace(/\\/g, "/"),
            "."
        ]
        : ["-cz", "-f", archivePath, "-C", cachePath, "."];

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"tar"`, args);

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(cacheId, archivePath);

    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(logWarningMock).toHaveBeenCalledWith("HTTP Error Occurred");

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with valid inputs uploads a cache", async () => {
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "Linux-node-",
        scope: "refs/heads/master",
        creationTime: "2019-11-13T19:18:02+00:00",
        archiveLocation: "www.actionscache.test/download"
    };

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return JSON.stringify(cacheEntry);
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    const cachePath = path.resolve(inputPath);
    testUtils.setInput(Inputs.Path, inputPath);

    const cacheId = 4;
    const reserveCacheMock = jest.spyOn(cacheHttpClient, "reserveCache").mockImplementationOnce(() => {
        return Promise.resolve(cacheId);
    });

    const execMock = jest.spyOn(exec, "exec");

    const saveCacheMock = jest.spyOn(cacheHttpClient, "saveCache");

    await run();

    expect(reserveCacheMock).toHaveBeenCalledTimes(1);
    expect(reserveCacheMock).toHaveBeenCalledWith(primaryKey);

    const archivePath = path.join("/foo/bar", "cache.tgz");

    const IS_WINDOWS = process.platform === "win32";
    const args = IS_WINDOWS
        ? [
            "-cz",
            "--force-local",
            "-f",
            archivePath.replace(/\\/g, "/"),
            "-C",
            cachePath.replace(/\\/g, "/"),
            "."
        ]
        : ["-cz", "-f", archivePath, "-C", cachePath, "."];

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"tar"`, args);

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(cacheId, archivePath);

    expect(failedMock).toHaveBeenCalledTimes(0);
});
