import * as core from "@actions/core";

import { Events, Outputs, RefKey, State } from "../src/constants";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");

beforeAll(() => {
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });
});

afterEach(() => {
    delete process.env[Events.Key];
    delete process.env[RefKey];
});

test("isExactKeyMatch with undefined cache key returns false", () => {
    const key = "linux-rust";
    const cacheKey = undefined;

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(false);
});

test("isExactKeyMatch with empty cache key returns false", () => {
    const key = "linux-rust";
    const cacheKey = "";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(false);
});

test("isExactKeyMatch with different keys returns false", () => {
    const key = "linux-rust";
    const cacheKey = "linux-";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(false);
});

test("isExactKeyMatch with different key accents returns false", () => {
    const key = "linux-áccent";
    const cacheKey = "linux-accent";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(false);
});

test("isExactKeyMatch with same key returns true", () => {
    const key = "linux-rust";
    const cacheKey = "linux-rust";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(true);
});

test("isExactKeyMatch with same key and different casing returns true", () => {
    const key = "linux-rust";
    const cacheKey = "LINUX-RUST";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(true);
});

test("setOutputAndState with undefined entry to set cache-hit output", () => {
    const key = "linux-rust";
    const cacheKey = undefined;

    const setOutputMock = jest.spyOn(core, "setOutput");
    const saveStateMock = jest.spyOn(core, "saveState");

    actionUtils.setOutputAndState(key, cacheKey);

    expect(setOutputMock).toHaveBeenCalledWith(Outputs.CacheHit, "false");
    expect(setOutputMock).toHaveBeenCalledTimes(1);

    expect(saveStateMock).toHaveBeenCalledTimes(0);
});

test("setOutputAndState with exact match to set cache-hit output and state", () => {
    const key = "linux-rust";
    const cacheKey = "linux-rust";

    const setOutputMock = jest.spyOn(core, "setOutput");
    const saveStateMock = jest.spyOn(core, "saveState");

    actionUtils.setOutputAndState(key, cacheKey);

    expect(setOutputMock).toHaveBeenCalledWith(Outputs.CacheHit, "true");
    expect(setOutputMock).toHaveBeenCalledTimes(1);

    expect(saveStateMock).toHaveBeenCalledWith(State.CacheMatchedKey, cacheKey);
    expect(saveStateMock).toHaveBeenCalledTimes(1);
});

test("setOutputAndState with no exact match to set cache-hit output and state", () => {
    const key = "linux-rust";
    const cacheKey = "linux-rust-bb828da54c148048dd17899ba9fda624811cfb43";

    const setOutputMock = jest.spyOn(core, "setOutput");
    const saveStateMock = jest.spyOn(core, "saveState");

    actionUtils.setOutputAndState(key, cacheKey);

    expect(setOutputMock).toHaveBeenCalledWith(Outputs.CacheHit, "false");
    expect(setOutputMock).toHaveBeenCalledTimes(1);

    expect(saveStateMock).toHaveBeenCalledWith(State.CacheMatchedKey, cacheKey);
    expect(saveStateMock).toHaveBeenCalledTimes(1);
});

test("getCacheState with no state returns undefined", () => {
    const getStateMock = jest.spyOn(core, "getState");
    getStateMock.mockImplementation(() => {
        return "";
    });

    const state = actionUtils.getCacheState();

    expect(state).toBe(undefined);

    expect(getStateMock).toHaveBeenCalledWith(State.CacheMatchedKey);
    expect(getStateMock).toHaveBeenCalledTimes(1);
});

test("getCacheState with valid state", () => {
    const cacheKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";

    const getStateMock = jest.spyOn(core, "getState");
    getStateMock.mockImplementation(() => {
        return cacheKey;
    });

    const state = actionUtils.getCacheState();

    expect(state).toEqual(cacheKey);

    expect(getStateMock).toHaveBeenCalledWith(State.CacheMatchedKey);
    expect(getStateMock).toHaveBeenCalledTimes(1);
});

test("logWarning logs a message with a warning prefix", () => {
    const message = "A warning occurred.";

    const infoMock = jest.spyOn(core, "info");

    actionUtils.logWarning(message);

    expect(infoMock).toHaveBeenCalledWith(`[warning]${message}`);
});

test("isValidEvent returns false for event that does not have a branch or tag", () => {
    const event = "foo";
    process.env[Events.Key] = event;

    const isValidEvent = actionUtils.isValidEvent();

    expect(isValidEvent).toBe(false);
});

test("isValidEvent returns true for event that has a ref", () => {
    const event = Events.Push;
    process.env[Events.Key] = event;
    process.env[RefKey] = "ref/heads/feature";

    const isValidEvent = actionUtils.isValidEvent();

    expect(isValidEvent).toBe(true);
});

test("getInputAsArray returns empty array if not required and missing", () => {
    expect(actionUtils.getInputAsArray("foo")).toEqual([]);
});

test("getInputAsArray throws error if required and missing", () => {
    expect(() =>
        actionUtils.getInputAsArray("foo", { required: true })
    ).toThrowError();
});

test("getInputAsArray handles single line correctly", () => {
    testUtils.setInput("foo", "bar");
    expect(actionUtils.getInputAsArray("foo")).toEqual(["bar"]);
});

test("getInputAsArray handles multiple lines correctly", () => {
    testUtils.setInput("foo", "bar\nbaz");
    expect(actionUtils.getInputAsArray("foo")).toEqual(["bar", "baz"]);
});

test("getInputAsArray handles different new lines correctly", () => {
    testUtils.setInput("foo", "bar\r\nbaz");
    expect(actionUtils.getInputAsArray("foo")).toEqual(["bar", "baz"]);
});

test("getInputAsArray handles empty lines correctly", () => {
    testUtils.setInput("foo", "\n\nbar\n\nbaz\n\n");
    expect(actionUtils.getInputAsArray("foo")).toEqual(["bar", "baz"]);
});

test("getInputAsInt returns undefined if input not set", () => {
    expect(actionUtils.getInputAsInt("undefined")).toBeUndefined();
});

test("getInputAsInt returns value if input is valid", () => {
    testUtils.setInput("foo", "8");
    expect(actionUtils.getInputAsInt("foo")).toBe(8);
});

test("getInputAsInt returns undefined if input is invalid or NaN", () => {
    testUtils.setInput("foo", "bar");
    expect(actionUtils.getInputAsInt("foo")).toBeUndefined();
});

test("getInputAsInt throws if required and value missing", () => {
    expect(() =>
        actionUtils.getInputAsInt("undefined", { required: true })
    ).toThrowError();
});
