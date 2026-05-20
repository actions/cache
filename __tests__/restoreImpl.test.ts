import { jest, test, expect, beforeEach, afterEach } from "@jest/globals";

// Mock @actions/core
jest.unstable_mockModule("@actions/core", () => ({
    getInput: jest.fn((name: string, options?: { required?: boolean }) => {
        const val =
            process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] || "";
        if (options && options.required && !val) {
            throw new Error(`Input required and not supplied: ${name}`);
        }
        return val.trim();
    }),
    setOutput: jest.fn(),
    setFailed: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    saveState: jest.fn(),
    getState: jest.fn(() => ""),
    isDebug: jest.fn(() => false),
    exportVariable: jest.fn(),
    addPath: jest.fn(),
    group: jest.fn((name: string, fn: () => Promise<unknown>) => fn()),
    startGroup: jest.fn(),
    endGroup: jest.fn()
}));

// Mock @actions/cache
jest.unstable_mockModule("@actions/cache", () => ({
    restoreCache: jest.fn(),
    saveCache: jest.fn(),
    isFeatureAvailable: jest.fn(() => true),
    ReserveCacheError: class ReserveCacheError extends Error {
        constructor(message: string) {
            super(message);
            this.name = "ReserveCacheError";
        }
    }
}));

const core = await import("@actions/core");
const cache = await import("@actions/cache");
const { Events, Inputs, RefKey } = await import("../src/constants");
const { restoreImpl } = await import("../src/restoreImpl");
const { StateProvider } = await import("../src/stateProvider");
const testUtils = await import("../src/utils/testUtils");

beforeEach(() => {
    jest.clearAllMocks();
    (core.getInput as jest.Mock).mockImplementation(
        (name: string, options?: { required?: boolean }) => {
            const val =
                process.env[
                    `INPUT_${name.replace(/ /g, "_").toUpperCase()}`
                ] || "";
            if (options && options.required && !val) {
                throw new Error(
                    `Input required and not supplied: ${name}`
                );
            }
            return val.trim();
        }
    );
    (core.getState as jest.Mock).mockReturnValue("");
    (cache.isFeatureAvailable as jest.Mock).mockReturnValue(true);
    process.env[Events.Key] = Events.Push;
    process.env[RefKey] = "refs/heads/feature-branch";
});

afterEach(() => {
    testUtils.clearInputs();
    delete process.env[Events.Key];
    delete process.env[RefKey];
});

test("restore with invalid event outputs warning", async () => {
    const invalidEvent = "commit_comment";
    process.env[Events.Key] = invalidEvent;
    delete process.env[RefKey];
    await restoreImpl(new StateProvider());
    expect(core.info).toHaveBeenCalledWith(
        `[warning]Event Validation Error: The event type ${invalidEvent} is not supported because it's not tied to a branch or tag ref.`
    );
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("restore without AC available should no-op", async () => {
    (cache.isFeatureAvailable as jest.Mock).mockReturnValue(false);

    await restoreImpl(new StateProvider());

    expect(cache.restoreCache).toHaveBeenCalledTimes(0);
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("cache-hit", "false");
});

test("restore on GHES without AC available should no-op", async () => {
    (cache.isFeatureAvailable as jest.Mock).mockReturnValue(false);

    await restoreImpl(new StateProvider());

    expect(cache.restoreCache).toHaveBeenCalledTimes(0);
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("cache-hit", "false");
});

test("restore on GHES with AC available ", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path: path,
        key,
        enableCrossOsArchive: false
    });

    (cache.restoreCache as jest.Mock).mockResolvedValue(key);

    await restoreImpl(new StateProvider());

    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(cache.restoreCache).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: false
        },
        false
    );

    expect(core.saveState).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("cache-hit", "true");
    expect(core.info).toHaveBeenCalledWith(`Cache restored from key: ${key}`);
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("restore with no path should fail", async () => {
    await restoreImpl(new StateProvider());
    expect(cache.restoreCache).toHaveBeenCalledTimes(0);
    expect(core.setFailed).not.toHaveBeenCalledWith(
        "Input required and not supplied: path"
    );
});

test("restore with no key", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");
    await restoreImpl(new StateProvider());
    expect(cache.restoreCache).toHaveBeenCalledTimes(0);
    expect(core.setFailed).toHaveBeenCalledWith(
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
    (cache.restoreCache as jest.Mock).mockRejectedValue(
        new Error("Key Validation Error: Keys are limited to a maximum of 10.")
    );
    await restoreImpl(new StateProvider());
    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenCalledWith(
        `Key Validation Error: Keys are limited to a maximum of 10.`
    );
});

test("restore with large key should fail", async () => {
    const path = "node_modules";
    const key = "foo".repeat(512);
    testUtils.setInputs({
        path: path,
        key,
        enableCrossOsArchive: false
    });
    (cache.restoreCache as jest.Mock).mockRejectedValue(
        new Error(`Key Validation Error: ${key} cannot be larger than 512 characters.`)
    );
    await restoreImpl(new StateProvider());
    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenCalledWith(
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
    (cache.restoreCache as jest.Mock).mockRejectedValue(
        new Error(`Key Validation Error: ${key} cannot contain commas.`)
    );
    await restoreImpl(new StateProvider());
    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenCalledWith(
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

    (cache.restoreCache as jest.Mock).mockResolvedValue(undefined);

    await restoreImpl(new StateProvider());

    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.saveState).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(core.setFailed).toHaveBeenCalledTimes(0);
    expect(core.info).toHaveBeenCalledWith(
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

    (cache.restoreCache as jest.Mock).mockResolvedValue(undefined);

    await restoreImpl(new StateProvider());

    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.saveState).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(core.setFailed).toHaveBeenCalledTimes(0);
    expect(core.info).toHaveBeenCalledWith(
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

    (cache.restoreCache as jest.Mock).mockResolvedValue(key);

    await restoreImpl(new StateProvider());

    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.saveState).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("cache-hit", "true");
    expect(core.info).toHaveBeenCalledWith(`Cache restored from key: ${key}`);
    expect(core.setFailed).toHaveBeenCalledTimes(0);
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

    (cache.restoreCache as jest.Mock).mockResolvedValue(restoreKey);

    await restoreImpl(new StateProvider());

    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.saveState).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("cache-hit", "false");
    expect(core.info).toHaveBeenCalledWith(
        `Cache restored from key: ${restoreKey}`
    );
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("restore with lookup-only set", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path: path,
        key,
        lookupOnly: true
    });

    (cache.restoreCache as jest.Mock).mockResolvedValue(key);

    await restoreImpl(new StateProvider());

    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(cache.restoreCache).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: true
        },
        false
    );

    expect(core.saveState).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(core.saveState).toHaveBeenCalledWith("CACHE_RESULT", key);
    expect(core.saveState).toHaveBeenCalledTimes(2);
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("cache-hit", "true");
    expect(core.info).toHaveBeenCalledWith(
        `Cache found and can be restored from key: ${key}`
    );
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("restore failure with earlyExit should call process exit", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");
    const processExitMock = jest.spyOn(process, "exit").mockImplementation((() => {}) as any);

    await restoreImpl(new StateProvider(), true);

    expect(cache.restoreCache).toHaveBeenCalledTimes(0);
    expect(core.setFailed).toHaveBeenCalledWith(
        "Input required and not supplied: key"
    );
    expect(processExitMock).toHaveBeenCalledWith(1);
    processExitMock.mockRestore();
});
