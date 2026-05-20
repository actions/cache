import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";

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
const { Events, RefKey } = await import("../src/constants");
const { restoreOnlyRun } = await import("../src/restoreImpl");
const testUtils = await import("../src/utils/testUtils");

beforeEach(() => {
    jest.clearAllMocks();
    (core.getInput as jest.Mock).mockImplementation(
        (name: string, options?: { required?: boolean }) => {
            const val =
                process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] ||
                "";
            if (options && options.required && !val) {
                throw new Error(`Input required and not supplied: ${name}`);
            }
            return val.trim();
        }
    );
    (cache.isFeatureAvailable as jest.Mock).mockReturnValue(true);
    process.env[Events.Key] = Events.Push;
    process.env[RefKey] = "refs/heads/feature-branch";
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

    (cache.restoreCache as jest.Mock).mockResolvedValue(undefined);

    await restoreOnlyRun();

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

    expect(core.setOutput).toHaveBeenCalledWith("cache-primary-key", key);
    expect(core.setOutput).toHaveBeenCalledTimes(1);
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

    await restoreOnlyRun();

    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("cache-primary-key", key);
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

    await restoreOnlyRun();

    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("cache-primary-key", key);
    expect(core.setOutput).toHaveBeenCalledWith("cache-hit", "true");
    expect(core.setOutput).toHaveBeenCalledWith("cache-matched-key", key);
    expect(core.setOutput).toHaveBeenCalledTimes(3);
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

    await restoreOnlyRun();

    expect(cache.restoreCache).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("cache-primary-key", key);
    expect(core.setOutput).toHaveBeenCalledWith("cache-hit", "false");
    expect(core.setOutput).toHaveBeenCalledWith(
        "cache-matched-key",
        restoreKey
    );
    expect(core.setOutput).toHaveBeenCalledTimes(3);
    expect(core.info).toHaveBeenCalledWith(
        `Cache restored from key: ${restoreKey}`
    );
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});
