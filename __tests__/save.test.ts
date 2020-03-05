import * as core from "@actions/core";
import * as path from "path";
import * as cacheHttpClient from "../src/cacheHttpClient";
import { Events, Inputs } from "../src/constants";
import { ArtifactCacheEntry } from "../src/contracts";
import run from "../src/save";
import * as tar from "../src/tar";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("../src/cacheHttpClient");
jest.mock("../src/tar");
jest.mock("../src/utils/actionUtils");

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

    jest.spyOn(actionUtils, "resolvePaths").mockImplementation(
        async filePaths => {
            return filePaths.map(x => path.resolve(x));
        }
    );

    jest.spyOn(actionUtils, "createTempDirectory").mockImplementation(() => {
        return Promise.resolve("/foo/bar");
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

    const createTarMock = jest.spyOn(tar, "createTar");

    await run();

    expect(infoMock).toHaveBeenCalledWith(
        `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );

    expect(createTarMock).toHaveBeenCalledTimes(0);

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

    // TODO: this shouldn't be necessary if tarball contains entries relative to workspace
    expect(logWarningMock).not.toHaveBeenCalledWith(
        "Input required and not supplied: path"
    );
    expect(logWarningMock).toHaveBeenCalledTimes(0);
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
    const cachePaths = [path.resolve(inputPath)];
    testUtils.setInput(Inputs.Path, inputPath);

    const createTarMock = jest.spyOn(tar, "createTar");

    const cacheSize = 6 * 1024 * 1024 * 1024; //~6GB, over the 5GB limit
    jest.spyOn(actionUtils, "getArchiveFileSize").mockImplementationOnce(() => {
        return cacheSize;
    });

    await run();

    const archivePath = path.join("/foo/bar", "cache.tgz");

    expect(createTarMock).toHaveBeenCalledTimes(1);
    expect(createTarMock).toHaveBeenCalledWith(archivePath, cachePaths);

    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(logWarningMock).toHaveBeenCalledWith(
        "Cache size of ~6144 MB (6442450944 B) is over the 5GB limit, not saving cache."
    );

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with reserve cache failure outputs warning", async () => {
    const infoMock = jest.spyOn(core, "info");
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
    testUtils.setInput(Inputs.Path, inputPath);

    const reserveCacheMock = jest
        .spyOn(cacheHttpClient, "reserveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(-1);
        });

    const createTarMock = jest.spyOn(tar, "createTar");

    const saveCacheMock = jest.spyOn(cacheHttpClient, "saveCache");

    await run();

    expect(reserveCacheMock).toHaveBeenCalledTimes(1);
    expect(reserveCacheMock).toHaveBeenCalledWith(primaryKey);

    expect(infoMock).toHaveBeenCalledWith(
        `Unable to reserve cache with key ${primaryKey}, another job may be creating this cache.`
    );

    expect(createTarMock).toHaveBeenCalledTimes(0);
    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(logWarningMock).toHaveBeenCalledTimes(0);
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
    const cachePaths = [path.resolve(inputPath)];
    testUtils.setInput(Inputs.Path, inputPath);

    const cacheId = 4;
    const reserveCacheMock = jest
        .spyOn(cacheHttpClient, "reserveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    const createTarMock = jest.spyOn(tar, "createTar");

    const saveCacheMock = jest
        .spyOn(cacheHttpClient, "saveCache")
        .mockImplementationOnce(() => {
            throw new Error("HTTP Error Occurred");
        });

    await run();

    expect(reserveCacheMock).toHaveBeenCalledTimes(1);
    expect(reserveCacheMock).toHaveBeenCalledWith(primaryKey);

    const archivePath = path.join("/foo/bar", "cache.tgz");

    expect(createTarMock).toHaveBeenCalledTimes(1);
    expect(createTarMock).toHaveBeenCalledWith(archivePath, cachePaths);

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
    const cachePaths = [path.resolve(inputPath)];
    testUtils.setInput(Inputs.Path, inputPath);

    const cacheId = 4;
    const reserveCacheMock = jest
        .spyOn(cacheHttpClient, "reserveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    const createTarMock = jest.spyOn(tar, "createTar");

    const saveCacheMock = jest.spyOn(cacheHttpClient, "saveCache");

    await run();

    expect(reserveCacheMock).toHaveBeenCalledTimes(1);
    expect(reserveCacheMock).toHaveBeenCalledWith(primaryKey);

    const archivePath = path.join("/foo/bar", "cache.tgz");

    expect(createTarMock).toHaveBeenCalledTimes(1);
    expect(createTarMock).toHaveBeenCalledWith(archivePath, cachePaths);

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(cacheId, archivePath);

    expect(failedMock).toHaveBeenCalledTimes(0);
});
