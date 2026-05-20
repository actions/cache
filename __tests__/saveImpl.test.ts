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
const { saveImpl } = await import("../src/saveImpl");
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

test("save with invalid event outputs warning", async () => {
    const invalidEvent = "commit_comment";
    process.env[Events.Key] = invalidEvent;
    delete process.env[RefKey];
    await saveImpl(new StateProvider());
    expect(core.info).toHaveBeenCalledWith(
        `[warning]Event Validation Error: The event type ${invalidEvent} is not supported because it's not tied to a branch or tag ref.`
    );
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("save with no primary key in state outputs warning", async () => {
    (core.getState as jest.Mock).mockReturnValue("");

    await saveImpl(new StateProvider());

    expect(cache.saveCache).toHaveBeenCalledTimes(0);
    expect(core.info).toHaveBeenCalledWith(`[warning]Key is not specified.`);
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("save without AC available should no-op", async () => {
    (cache.isFeatureAvailable as jest.Mock).mockReturnValue(false);

    await saveImpl(new StateProvider());

    expect(cache.saveCache).toHaveBeenCalledTimes(0);
});

test("save on ghes without AC available should no-op", async () => {
    (cache.isFeatureAvailable as jest.Mock).mockReturnValue(false);

    await saveImpl(new StateProvider());

    expect(cache.saveCache).toHaveBeenCalledTimes(0);
});

test("save on GHES with AC available", async () => {
    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    (core.getState as jest.Mock)
        .mockReturnValueOnce(primaryKey)
        .mockReturnValueOnce(savedCacheKey);

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = 4;
    (cache.saveCache as jest.Mock).mockResolvedValue(cacheId);

    await saveImpl(new StateProvider());

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

test("save with exact match returns early", async () => {
    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";

    (core.getState as jest.Mock)
        .mockReturnValueOnce(primaryKey)
        .mockReturnValueOnce(primaryKey);

    await saveImpl(new StateProvider());

    expect(cache.saveCache).toHaveBeenCalledTimes(0);
    expect(core.info).toHaveBeenCalledWith(
        `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("save with missing input outputs warning", async () => {
    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    (core.getState as jest.Mock)
        .mockReturnValueOnce(savedCacheKey)
        .mockReturnValueOnce(primaryKey);

    await saveImpl(new StateProvider());

    expect(cache.saveCache).toHaveBeenCalledTimes(0);
    expect(core.info).toHaveBeenCalledWith(
        "[warning]Input required and not supplied: path"
    );
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("save with large cache outputs warning", async () => {
    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    (core.getState as jest.Mock)
        .mockReturnValueOnce(savedCacheKey)
        .mockReturnValueOnce(primaryKey);

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);

    (cache.saveCache as jest.Mock).mockRejectedValue(
        new Error(
            "Cache size of ~6144 MB (6442450944 B) is over the 5GB limit, not saving cache."
        )
    );

    await saveImpl(new StateProvider());

    expect(cache.saveCache).toHaveBeenCalledTimes(1);
    expect(core.info).toHaveBeenCalledWith(
        "[warning]Cache size of ~6144 MB (6442450944 B) is over the 5GB limit, not saving cache."
    );
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("save with reserve cache failure outputs warning", async () => {
    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    (core.getState as jest.Mock)
        .mockReturnValueOnce(savedCacheKey)
        .mockReturnValueOnce(primaryKey);

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);

    (cache.saveCache as jest.Mock).mockRejectedValue(
        new Error(
            `Unable to reserve cache with key ${primaryKey}, another job may be creating this cache.`
        )
    );

    await saveImpl(new StateProvider());

    expect(cache.saveCache).toHaveBeenCalledTimes(1);
    expect(core.info).toHaveBeenCalledWith(
        `[warning]Unable to reserve cache with key ${primaryKey}, another job may be creating this cache.`
    );
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("save with server error outputs warning", async () => {
    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    (core.getState as jest.Mock)
        .mockReturnValueOnce(savedCacheKey)
        .mockReturnValueOnce(primaryKey);

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);

    (cache.saveCache as jest.Mock).mockRejectedValue(
        new Error("HTTP Error Occurred")
    );

    await saveImpl(new StateProvider());

    expect(cache.saveCache).toHaveBeenCalledTimes(1);
    expect(core.info).toHaveBeenCalledWith("[warning]HTTP Error Occurred");
    expect(core.setFailed).toHaveBeenCalledTimes(0);
});

test("save with valid inputs uploads a cache", async () => {
    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    (core.getState as jest.Mock)
        .mockReturnValueOnce(primaryKey)
        .mockReturnValueOnce(savedCacheKey);

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);
    testUtils.setInput(Inputs.UploadChunkSize, "4000000");

    const cacheId = 4;
    (cache.saveCache as jest.Mock).mockResolvedValue(cacheId);

    await saveImpl(new StateProvider());

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
