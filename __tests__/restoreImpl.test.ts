import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, Inputs, RefKey } from "../src/constants";
import run from "../src/restoreImpl";
import { StateProvider } from "../src/stateProvider";
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
            const actualUtils = jest.requireActual("../src/utils/actionUtils");
            return actualUtils.getInputAsBool(name, options);
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

test("restore with invalid event outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");
    const invalidEvent = "commit_comment";
    process.env[Events.Key] = invalidEvent;
    delete process.env[RefKey];
    await run(new StateProvider());
    expect(logWarningMock).toHaveBeenCalledWith(
        `Event Validation Error: The event type ${invalidEvent} is not supported because it's not tied to a branch or tag ref.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore without AC available should no-op", async () => {
    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => false);
    jest.spyOn(actionUtils, "isCacheFeatureAvailable").mockImplementation(
        () => false
    );

    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");

    await run(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "false");
});

test("restore on GHES without AC available should no-op", async () => {
    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => true);
    jest.spyOn(actionUtils, "isCacheFeatureAvailable").mockImplementation(
        () => false
    );

    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");

    await run(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "false");
});

test("restore on GHES with AC available ", async () => {
    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => true);
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path: path,
        key,
        enableCrossOsArchive: false
    });

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(key);
        });

    await run(new StateProvider());

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

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "true");

    expect(infoMock).toHaveBeenCalledWith(`Cache restored from key: ${key}`);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with no path should fail", async () => {
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await run(new StateProvider());
    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    // this input isn't necessary for restore b/c tarball contains entries relative to workspace
    expect(failedMock).not.toHaveBeenCalledWith(
        "Input required and not supplied: path"
    );
});

test("restore with no key", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await run(new StateProvider());
    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledWith(
        "Input required and not supplied: key"
    );
});

test("restore with too many keys should fail", async () => {
    const path = "node_modules";
    const key = "node-test";
    const restoreKeys = [...Array(20).keys()].map(x => x.toString());
    testUtils.setInputs({
        path: path,
        key,
        restoreKeys,
        enableCrossOsArchive: false
    });
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await run(new StateProvider());
    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        restoreKeys,
        {
            lookupOnly: false
        },
        false
    );
    expect(failedMock).toHaveBeenCalledWith(
        `Key Validation Error: Keys are limited to a maximum of 10.`
    );
});

test("restore with large key should fail", async () => {
    const path = "node_modules";
    const key = "foo".repeat(512); // Over the 512 character limit
    testUtils.setInputs({
        path: path,
        key,
        enableCrossOsArchive: false
    });
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await run(new StateProvider());
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
    expect(failedMock).toHaveBeenCalledWith(
        `Key Validation Error: ${key} cannot be larger than 512 characters.`
    );
});

test("restore with invalid key should fail", async () => {
    const path = "node_modules";
    const key = "comma,comma";
    testUtils.setInputs({
        path: path,
        key,
        enableCrossOsArchive: false
    });
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await run(new StateProvider());
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
    expect(failedMock).toHaveBeenCalledWith(
        `Key Validation Error: ${key} cannot contain commas.`
    );
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
    const stateMock = jest.spyOn(core, "saveState");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(undefined);
        });

    await run(new StateProvider());

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

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
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
    const stateMock = jest.spyOn(core, "saveState");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(undefined);
        });

    await run(new StateProvider());

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

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
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
    const stateMock = jest.spyOn(core, "saveState");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(key);
        });

    await run(new StateProvider());

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

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "true");

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
    const stateMock = jest.spyOn(core, "saveState");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(restoreKey);
        });

    await run(new StateProvider());

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

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "false");
    expect(infoMock).toHaveBeenCalledWith(
        `Cache restored from key: ${restoreKey}`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with lookup-only set", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path: path,
        key,
        lookupOnly: true
    });

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(key);
        });

    await run(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: true
        },
        false
    );

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(stateMock).toHaveBeenCalledWith("CACHE_RESULT", key);
    expect(stateMock).toHaveBeenCalledTimes(2);

    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "true");

    expect(infoMock).toHaveBeenCalledWith(
        `Cache found and can be restored from key: ${key}`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});
