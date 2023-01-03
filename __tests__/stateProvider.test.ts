import * as core from "@actions/core";

import { Events, Inputs, RefKey, State } from "../src/constants";
import {
    IStateProvider,
    NullStateProvider,
    StateProvider
} from "../src/stateProvider";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");

beforeAll(() => {
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });

    jest.spyOn(core, "setOutput").mockImplementation((key, value) => {
        return jest.requireActual("@actions/core").setOutput(key, value);
    });
});

afterEach(() => {
    delete process.env[Events.Key];
    delete process.env[RefKey];
});

test("StateProvider saves states", async () => {
    const states = new Map<string, string>();
    const getStateMock = jest
        .spyOn(core, "getState")
        .mockImplementation(key => states.get(key) || "");

    const saveStateMock = jest
        .spyOn(core, "saveState")
        .mockImplementation((key, value) => {
            states.set(key, value);
        });

    const setOutputMock = jest
        .spyOn(core, "setOutput")
        .mockImplementation((key, value) => {
            return jest.requireActual("@actions/core").setOutput(key, value);
        });

    const cacheMatchedKey = "node-cache";

    const stateProvider: IStateProvider = new StateProvider();
    stateProvider.setState("stateKey", "stateValue");
    stateProvider.setState(State.CacheMatchedKey, cacheMatchedKey);
    const stateValue = stateProvider.getState("stateKey");
    const cacheStateValue = stateProvider.getCacheState();

    expect(stateValue).toBe("stateValue");
    expect(cacheStateValue).toBe(cacheMatchedKey);
    expect(getStateMock).toHaveBeenCalledTimes(2);
    expect(saveStateMock).toHaveBeenCalledTimes(2);
    expect(setOutputMock).toHaveBeenCalledTimes(0);
});

test("NullStateProvider saves outputs", async () => {
    const states = new Map<string, string>();

    const getInputMock = jest
        .spyOn(core, "getInput")
        .mockImplementation(key => testUtils.getInput(key));

    const getStateMock = jest
        .spyOn(core, "getState")
        .mockImplementation(key => {
            return jest.requireActual("@actions/core").getState(key);
        });

    const setOutputMock = jest
        .spyOn(core, "setOutput")
        .mockImplementation((key, value) => {
            states.set(key, value);
        });

    const saveStateMock = jest
        .spyOn(core, "saveState")
        .mockImplementation((key, value) => {
            states.set(key, value);
        });

    const cacheMatchedKey = "node-cache";
    const cachePrimaryKey = "primary-key";
    const nullStateProvider: IStateProvider = new NullStateProvider();
    testUtils.setInput(Inputs.Key, cachePrimaryKey);
    nullStateProvider.setState(State.CachePrimaryKey, cachePrimaryKey);
    nullStateProvider.setState(State.CacheMatchedKey, cacheMatchedKey);
    const output1 = nullStateProvider.getState(State.CachePrimaryKey);
    const output2 = nullStateProvider.getCacheState();

    expect(getStateMock).toHaveBeenCalledTimes(0);
    expect(getInputMock).toHaveBeenCalledTimes(1);
    expect(output1).toBe("primary-key");
    expect(output2).toBe(undefined);
    expect(setOutputMock).toHaveBeenCalledTimes(2);
    expect(saveStateMock).toHaveBeenCalledTimes(0);
});
