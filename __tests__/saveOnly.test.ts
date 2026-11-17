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
const { Events, Inputs, RefKey } = await import("../src/constants");
const { saveOnlyRun } = await import("../src/saveImpl");
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

test("save with valid inputs uploads a cache", async () => {
    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Key, primaryKey);
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = 4;
    (cache.saveCache as jest.Mock).mockResolvedValue(cacheId);

    await saveOnlyRun();

    expect(cache.saveCache).toHaveBeenCalledTimes(1);
    expect(cache.saveCache).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        {
            uploadChunkSize: 4000000
        },
        false
    );

    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("save failing logs the debug message", async () => {
    const debugMock = jest.spyOn(core, "debug");
    const warningMock = jest.spyOn(core, "warning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Key, primaryKey);
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    // A read-only / write-denied save surfaces to the action as saveCache resolving
    // to -1; the toolkit has already logged the underlying reason. The action
    // must not fail the job or emit its own warning.
    const cacheId = -1;
    (cache.saveCache as jest.Mock).mockResolvedValue(cacheId);

    await saveOnlyRun();

    expect(cache.saveCache).toHaveBeenCalledTimes(1);
    expect(cache.saveCache).toHaveBeenCalledWith(
        [inputPath],
        primaryKey,
        {
            uploadChunkSize: 4000000
        },
        false
    );

    expect(debugMock).toHaveBeenCalledWith("Cache was not saved.");
    expect(warningMock).not.toHaveBeenCalled();
    expect(failedMock).not.toHaveBeenCalled();
});
