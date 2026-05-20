import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";

import type { IStateProvider } from "../src/stateProvider";

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

const core = await import("@actions/core");
const { Events, RefKey, State } = await import("../src/constants");
const { NullStateProvider, StateProvider } =
    await import("../src/stateProvider");

beforeEach(() => {
    jest.clearAllMocks();
    (core.getState as jest.Mock).mockReturnValue("");
});

afterEach(() => {
    delete process.env[Events.Key];
    delete process.env[RefKey];
});

test("StateProvider saves states", async () => {
    const states = new Map<string, string>();
    (core.getState as jest.Mock).mockImplementation(
        (key: string) => states.get(key) || ""
    );
    (core.saveState as jest.Mock).mockImplementation(
        (key: string, value: string) => {
            states.set(key, value);
        }
    );

    const cacheMatchedKey = "node-cache";

    const stateProvider: IStateProvider = new StateProvider();
    stateProvider.setState("stateKey", "stateValue");
    stateProvider.setState(State.CacheMatchedKey, cacheMatchedKey);
    const stateValue = stateProvider.getState("stateKey");
    const cacheStateValue = stateProvider.getCacheState();

    expect(stateValue).toBe("stateValue");
    expect(cacheStateValue).toBe(cacheMatchedKey);
    expect(core.getState).toHaveBeenCalledTimes(2);
    expect(core.saveState).toHaveBeenCalledTimes(2);
    expect(core.setOutput).toHaveBeenCalledTimes(0);
});

test("NullStateProvider saves outputs", async () => {
    const nullStateProvider: IStateProvider = new NullStateProvider();
    nullStateProvider.setState(State.CacheMatchedKey, "outputValue");
    nullStateProvider.setState(State.CachePrimaryKey, "node-cache");
    nullStateProvider.getState("outputKey");
    nullStateProvider.getCacheState();

    expect(core.getState).toHaveBeenCalledTimes(0);
    expect(core.setOutput).toHaveBeenCalledTimes(2);
    expect(core.saveState).toHaveBeenCalledTimes(0);
});
