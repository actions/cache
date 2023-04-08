import * as cache from "@actions/cache";
import * as core from "@actions/core";
import nock from "nock";

import { Events, Inputs, RefKey } from "../src/constants";
import { saveImpl } from "../src/saveImpl";
import { NullStateProvider, StateProvider } from "../src/stateProvider";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("@actions/cache");
jest.mock("../src/utils/actionUtils");

beforeAll(() => {
    nock.disableNetConnect();
    testUtils.mockServer.listen({
        onUnhandledRequest: "warn"
    });

    jest.spyOn(actionUtils, "deleteCacheByKey").mockImplementation(
        (key: string, owner: string, repo: string) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .deleteCacheByKey(key, owner, repo);
        }
    );

    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });

    jest.spyOn(actionUtils, "getInputAsArray").mockImplementation(
        (name, options) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .getInputAsArray(name, options);
        }
    );

    jest.spyOn(actionUtils, "getInputAsInt").mockImplementation(
        (name, options) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .getInputAsInt(name, options);
        }
    );

    jest.spyOn(actionUtils, "getInputAsBool").mockImplementation(
        (name, options) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .getInputAsBool(name, options);
        }
    );

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

    jest.spyOn(actionUtils, "logWarning").mockImplementation(
        (message: string) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .logWarning(message);
        }
    );
});

beforeEach(() => {
    jest.restoreAllMocks();
    process.env[Events.Key] = Events.Push;
    process.env[RefKey] = "refs/heads/feature-branch";

    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => false);
    jest.spyOn(actionUtils, "isCacheFeatureAvailable").mockImplementation(
        () => true
    );
});

afterEach(() => {
    testUtils.clearInputs();
    delete process.env[Events.Key];
    delete process.env[RefKey];
    delete process.env["GITHUB_TOKEN"];
    delete process.env["GITHUB_REPOSITORY"];
});

afterAll(() => {
    testUtils.mockServer.close();
    nock.enableNetConnect();
});

test("save with invalid event outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");
    const invalidEvent = "commit_comment";
    process.env[Events.Key] = invalidEvent;
    delete process.env[RefKey];
    await saveImpl(new StateProvider());
    expect(logWarningMock).toHaveBeenCalledWith(
        `Event Validation Error: The event type ${invalidEvent} is not supported because it's not tied to a branch or tag ref.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with no primary key in state outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const savedCacheKey = testUtils.successCacheKey;
    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return "";
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        });
    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(logWarningMock).toHaveBeenCalledWith(`Key is not specified.`);
    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save without AC available should no-op", async () => {
    jest.spyOn(actionUtils, "isCacheFeatureAvailable").mockImplementation(
        () => false
    );

    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
});

test("save on ghes without AC available should no-op", async () => {
    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => true);
    jest.spyOn(actionUtils, "isCacheFeatureAvailable").mockImplementation(
        () => false
    );

    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
});

test("save on GHES with AC available", async () => {
    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => true);
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = testUtils.successCacheKey;
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        {
            uploadChunkSize: 4000000
        },
        false
    );

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with exact match returns early", async () => {
    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    testUtils.setInput(Inputs.RefreshCache, "false");

    const primaryKey = testUtils.successCacheKey;

    const savedCacheKey = primaryKey;

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });
    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(infoMock).toHaveBeenCalledWith(
        `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with missing input outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = testUtils.successCacheKey;
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });
    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(logWarningMock).toHaveBeenCalledWith(
        "Input required and not supplied: path"
    );
    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with large cache outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = testUtils.successCacheKey;
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);

    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            throw new Error(
                "Cache size of ~6144 MB (6442450944 B) is over the 5GB limit, not saving cache."
            );
        });

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        expect.anything(),
        false
    );

    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(logWarningMock).toHaveBeenCalledWith(
        "Cache size of ~6144 MB (6442450944 B) is over the 5GB limit, not saving cache."
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with reserve cache failure outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = testUtils.successCacheKey;
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);

    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            const actualCache = jest.requireActual("@actions/cache");
            const error = new actualCache.ReserveCacheError(
                `Unable to reserve cache with key ${primaryKey}, another job may be creating this cache.`
            );
            throw error;
        });

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        expect.anything(),
        false
    );

    expect(logWarningMock).toHaveBeenCalledWith(
        `Unable to reserve cache with key ${primaryKey}, another job may be creating this cache.`
    );
    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with server error outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = testUtils.successCacheKey;
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);

    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            throw new Error("HTTP Error Occurred");
        });

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        expect.anything(),
        false
    );

    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(logWarningMock).toHaveBeenCalledWith("HTTP Error Occurred");

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with valid inputs uploads a cache", async () => {
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = testUtils.successCacheKey;
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        {
            uploadChunkSize: 4000000
        },
        false
    );

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with cache hit and refresh-cache will try to delete and re-create entry", async () => {
    process.env["GITHUB_REPOSITORY"] = "owner/repo";
    process.env["GITHUB_TOKEN"] =
        "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";
    process.env["GITHUB_ACTION"] = "__owner___run-repo";

    const infoMock = jest.spyOn(core, "info");
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = testUtils.successCacheKey;
    const savedCacheKey = primaryKey;

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.RefreshCache, "true");
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });
    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        {
            uploadChunkSize: 4000000
        },
        false
    );

    expect(logWarningMock).toHaveBeenCalledTimes(0);
    expect(infoMock).toHaveBeenCalledTimes(3);

    expect(infoMock).toHaveBeenNthCalledWith(
        1,
        `Cache hit occurred on the primary key ${primaryKey}, attempting to refresh the contents of the cache.`
    );
    expect(infoMock).toHaveBeenNthCalledWith(
        2,
        `Succesfully deleted cache with key: ${primaryKey}`
    );
    expect(infoMock).toHaveBeenNthCalledWith(
        3,
        `Cache saved with key: ${primaryKey}`
    );

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("Granular save will use lookup to determine if cache needs to be updated or (not) saved.", async () => {
    process.env["GITHUB_REPOSITORY"] = "owner/repo";
    process.env["GITHUB_TOKEN"] =
        "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";
    process.env["GITHUB_ACTION"] = "__owner___run-repo";

    const infoMock = jest.spyOn(core, "info");
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = testUtils.successCacheKey;

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Key, primaryKey);
    testUtils.setInput(Inputs.RefreshCache, "true");
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementation(() => {
            return Promise.resolve(primaryKey);
        });

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await saveImpl(new NullStateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        [],
        {
            lookupOnly: true
        },
        false
    );

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        {
            uploadChunkSize: 4000000
        },
        false
    );

    expect(logWarningMock).toHaveBeenCalledTimes(0);
    expect(infoMock).toHaveBeenCalledTimes(3);

    expect(infoMock).toHaveBeenNthCalledWith(
        1,
        `Cache hit occurred on the primary key ${primaryKey}, attempting to refresh the contents of the cache.`
    );
    expect(infoMock).toHaveBeenNthCalledWith(
        2,
        `Succesfully deleted cache with key: ${primaryKey}`
    );
    expect(infoMock).toHaveBeenNthCalledWith(
        3,
        `Cache saved with key: ${primaryKey}`
    );

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with cache hit and refresh-cache will throw a warning if there's no GITHUB_TOKEN", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = testUtils.successCacheKey;
    const savedCacheKey = primaryKey;

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.RefreshCache, "true");

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const saveCacheMock = jest.spyOn(cache, "saveCache");
    await saveImpl(new StateProvider());

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(logWarningMock).toHaveBeenCalledWith(
        `Can't refresh cache, either the repository info or a valid token are missing.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});
