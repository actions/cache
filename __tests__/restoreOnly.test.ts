import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, RefKey } from "../src/constants";
import { restoreOnlyRun } from "../src/restoreImpl";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

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

    jest.spyOn(actionUtils, "getInputAsArray").mockImplementation(
        (name, options) => {
            const actualUtils = jest.requireActual("../src/utils/actionUtils");
            return actualUtils.getInputAsArray(name, options);
        }
    );

    jest.spyOn(actionUtils, "getInputAsBool").mockImplementation(
        (name, options) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .getInputAsBool(name, options);
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
});

test("restore with no cache found", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path: path,
        key,
        enableCrossOsArchive: false
    });

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const outputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(undefined);
        });

    await restoreOnlyRun();

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: false
        },
        false
    );

    expect(outputMock).toHaveBeenCalledWith("cache-primary-key", key);
    expect(outputMock).toHaveBeenCalledWith("cache-hit", "false");
    expect(outputMock).toHaveBeenCalledTimes(2);
    expect(failedMock).toHaveBeenCalledTimes(0);

    expect(infoMock).toHaveBeenCalledWith(
        `Cache not found for input keys: ${key}`
    );
});

test("restore with restore keys and no cache found", async () => {
    const path = "node_modules";
    const key = "node-test";
    const restoreKey = "node-";
    testUtils.setInputs({
        path: path,
        key,
        restoreKeys: [restoreKey],
        enableCrossOsArchive: false
    });

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const outputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(undefined);
        });

    await restoreOnlyRun();

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [restoreKey],
        {
            lookupOnly: false
        },
        false
    );

    expect(outputMock).toHaveBeenCalledWith("cache-primary-key", key);
    expect(failedMock).toHaveBeenCalledTimes(0);

    expect(infoMock).toHaveBeenCalledWith(
        `Cache not found for input keys: ${key}, ${restoreKey}`
    );
});

test("restore with cache found for key", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path: path,
        key,
        enableCrossOsArchive: false
    });

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const outputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(key);
        });

    await restoreOnlyRun();

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: false
        },
        false
    );

    expect(outputMock).toHaveBeenCalledWith("cache-primary-key", key);
    expect(outputMock).toHaveBeenCalledWith("cache-hit", "true");
    expect(outputMock).toHaveBeenCalledWith("cache-matched-key", key);

    expect(outputMock).toHaveBeenCalledTimes(3);

    expect(infoMock).toHaveBeenCalledWith(`Cache restored from key: ${key}`);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with cache found for restore key", async () => {
    const path = "node_modules";
    const key = "node-test";
    const restoreKey = "node-";
    testUtils.setInputs({
        path: path,
        key,
        restoreKeys: [restoreKey],
        enableCrossOsArchive: false
    });

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const outputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(restoreKey);
        });

    await restoreOnlyRun();

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [restoreKey],
        {
            lookupOnly: false
        },
        false
    );

    expect(outputMock).toHaveBeenCalledWith("cache-primary-key", key);
    expect(outputMock).toHaveBeenCalledWith("cache-hit", "false");
    expect(outputMock).toHaveBeenCalledWith("cache-matched-key", restoreKey);

    expect(outputMock).toHaveBeenCalledTimes(3);

    expect(infoMock).toHaveBeenCalledWith(
        `Cache restored from key: ${restoreKey}`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});
