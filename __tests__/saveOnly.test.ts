import * as cache from "@actions/cache";
import * as core from "@actions/core";
import nock from "nock";

import { Events, Inputs, RefKey } from "../src/constants";
import { saveOnlyRun } from "../src/saveImpl";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("@actions/cache");
jest.mock("../src/utils/actionUtils");

beforeAll(() => {
    nock.disableNetConnect();
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });

    jest.spyOn(core, "setOutput").mockImplementation((key, value) => {
        return jest.requireActual("@actions/core").getInput(key, value);
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
});

afterAll(() => {
    nock.enableNetConnect();
});

test("save with valid inputs uploads a cache", async () => {
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Key, primaryKey);
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await saveOnlyRun();

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

test("Granular save with refreshCache is able to save cache", async () => {
    process.env["GITHUB_REPOSITORY"] = "owner/repo";
    process.env["GITHUB_TOKEN"] =
        "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";
    process.env["GITHUB_ACTION"] = "__owner___run-repo";
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";

    const inputPath = "node_modules";
    process.env.CACHE_RESTORE_ONLY_MATCHED_KEY = primaryKey;
    testUtils.setInput(Inputs.Key, primaryKey);
    testUtils.setInput(Inputs.RefreshCache, "true");
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = 4;

    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await saveOnlyRun();

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

test("save failing logs the warning message", async () => {
    const warningMock = jest.spyOn(core, "warning");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Key, primaryKey);
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = -1;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await saveOnlyRun();

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        {
            uploadChunkSize: 4000000
        },
        false
    );

    expect(warningMock).toHaveBeenCalledTimes(1);
    expect(warningMock).toHaveBeenCalledWith("Cache save failed.");
});
