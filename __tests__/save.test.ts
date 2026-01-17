import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, Inputs, RefKey } from "../src/constants";
import { saveRun } from "../src/saveImpl";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("@actions/cache");
jest.mock("../src/utils/actionUtils");

beforeAll(() => {
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });

    jest.spyOn(core, "getState").mockImplementation(name => {
        return jest.requireActual("@actions/core").getState(name);
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

    jest.spyOn(actionUtils, "getCompressionLevel").mockImplementation(
        (name, options) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .getCompressionLevel(name, options);
        }
    );

    jest.spyOn(actionUtils, "setCompressionLevel").mockImplementation(
        compressionLevel => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .setCompressionLevel(compressionLevel);
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
});

beforeEach(() => {
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
    delete process.env["ZSTD_CLEVEL"];
    delete process.env["GZIP"];
});

test("save with valid inputs uploads a cache", async () => {
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return primaryKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");
    testUtils.setInput(Inputs.CompressionLevel, "8");

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await saveRun();

    expect(process.env["ZSTD_CLEVEL"]).toBe("8");
    expect(process.env["GZIP"]).toBe("-8");

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

test("negative compression level leaves env unset in combined flow", async () => {
    const failedMock = jest.spyOn(core, "setFailed");
    const setCompressionLevelMock = jest.spyOn(
        actionUtils,
        "setCompressionLevel"
    );

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return primaryKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");
    testUtils.setInput(Inputs.CompressionLevel, "-5");

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await saveRun();

    expect(process.env["ZSTD_CLEVEL"]).toBeUndefined();
    expect(process.env["GZIP"]).toBeUndefined();
    expect(setCompressionLevelMock).not.toHaveBeenCalled();

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
