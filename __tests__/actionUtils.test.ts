import * as core from "@actions/core";
import * as glob from "@actions/glob";
import * as os from "os";
import * as path from "path";

import { Events, Outputs, State } from "../src/constants";
import { ArtifactCacheEntry } from "../src/contracts";
import * as actionUtils from "../src/utils/actionUtils";

jest.mock("@actions/core");
jest.mock("os");

afterEach(() => {
    delete process.env[Events.Key];
});

test("getArchiveFileSize returns file size", () => {
    const filePath = path.join(__dirname, "__fixtures__", "helloWorld.txt");

    const size = actionUtils.getArchiveFileSize(filePath);

    expect(size).toBe(11);
});

test("isExactKeyMatch with undefined cache entry returns false", () => {
    const key = "linux-rust";
    const cacheEntry = undefined;

    expect(actionUtils.isExactKeyMatch(key, cacheEntry)).toBe(false);
});

test("isExactKeyMatch with empty cache entry returns false", () => {
    const key = "linux-rust";
    const cacheEntry: ArtifactCacheEntry = {};

    expect(actionUtils.isExactKeyMatch(key, cacheEntry)).toBe(false);
});

test("isExactKeyMatch with different keys returns false", () => {
    const key = "linux-rust";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "linux-"
    };

    expect(actionUtils.isExactKeyMatch(key, cacheEntry)).toBe(false);
});

test("isExactKeyMatch with different key accents returns false", () => {
    const key = "linux-áccent";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "linux-accent"
    };

    expect(actionUtils.isExactKeyMatch(key, cacheEntry)).toBe(false);
});

test("isExactKeyMatch with same key returns true", () => {
    const key = "linux-rust";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "linux-rust"
    };

    expect(actionUtils.isExactKeyMatch(key, cacheEntry)).toBe(true);
});

test("isExactKeyMatch with same key and different casing returns true", () => {
    const key = "linux-rust";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "LINUX-RUST"
    };

    expect(actionUtils.isExactKeyMatch(key, cacheEntry)).toBe(true);
});

test("setOutputAndState with undefined entry to set cache-hit output", () => {
    const key = "linux-rust";
    const cacheEntry = undefined;

    const setOutputMock = jest.spyOn(core, "setOutput");
    const saveStateMock = jest.spyOn(core, "saveState");

    actionUtils.setOutputAndState(key, cacheEntry);

    expect(setOutputMock).toHaveBeenCalledWith(Outputs.CacheHit, "false");
    expect(setOutputMock).toHaveBeenCalledTimes(1);

    expect(saveStateMock).toHaveBeenCalledTimes(0);
});

test("setOutputAndState with exact match to set cache-hit output and state", () => {
    const key = "linux-rust";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "linux-rust"
    };

    const setOutputMock = jest.spyOn(core, "setOutput");
    const saveStateMock = jest.spyOn(core, "saveState");

    actionUtils.setOutputAndState(key, cacheEntry);

    expect(setOutputMock).toHaveBeenCalledWith(Outputs.CacheHit, "true");
    expect(setOutputMock).toHaveBeenCalledTimes(1);

    expect(saveStateMock).toHaveBeenCalledWith(
        State.CacheResult,
        JSON.stringify(cacheEntry)
    );
    expect(saveStateMock).toHaveBeenCalledTimes(1);
});

test("setOutputAndState with no exact match to set cache-hit output and state", () => {
    const key = "linux-rust";
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "linux-rust-bb828da54c148048dd17899ba9fda624811cfb43"
    };

    const setOutputMock = jest.spyOn(core, "setOutput");
    const saveStateMock = jest.spyOn(core, "saveState");

    actionUtils.setOutputAndState(key, cacheEntry);

    expect(setOutputMock).toHaveBeenCalledWith(Outputs.CacheHit, "false");
    expect(setOutputMock).toHaveBeenCalledTimes(1);

    expect(saveStateMock).toHaveBeenCalledWith(
        State.CacheResult,
        JSON.stringify(cacheEntry)
    );
    expect(saveStateMock).toHaveBeenCalledTimes(1);
});

test("getCacheState with no state returns undefined", () => {
    const getStateMock = jest.spyOn(core, "getState");
    getStateMock.mockImplementation(() => {
        return "";
    });

    const state = actionUtils.getCacheState();

    expect(state).toBe(undefined);

    expect(getStateMock).toHaveBeenCalledWith(State.CacheResult);
    expect(getStateMock).toHaveBeenCalledTimes(1);
});

test("getCacheState with valid state", () => {
    const cacheEntry: ArtifactCacheEntry = {
        cacheKey: "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43",
        scope: "refs/heads/master",
        creationTime: "2019-11-13T19:18:02+00:00",
        archiveLocation: "www.actionscache.test/download"
    };
    const getStateMock = jest.spyOn(core, "getState");
    getStateMock.mockImplementation(() => {
        return JSON.stringify(cacheEntry);
    });

    const state = actionUtils.getCacheState();

    expect(state).toEqual(cacheEntry);

    expect(getStateMock).toHaveBeenCalledWith(State.CacheResult);
    expect(getStateMock).toHaveBeenCalledTimes(1);
});

test("logWarning logs a message with a warning prefix", () => {
    const message = "A warning occurred.";

    const infoMock = jest.spyOn(core, "info");

    actionUtils.logWarning(message);

    expect(infoMock).toHaveBeenCalledWith(`[warning]${message}`);
});

test("isValidEvent returns false for unknown event", () => {
    const event = "foo";
    process.env[Events.Key] = event;

    const isValidEvent = actionUtils.isValidEvent();

    expect(isValidEvent).toBe(false);
});

test("resolvePaths with no ~ in path", async () => {
    // TODO: these test paths will need to exist
    const filePath = ".cache/yarn";

    const resolvedPath = await actionUtils.resolvePaths([filePath]);

    const expectedPath = [path.resolve(filePath)];
    expect(resolvedPath).toStrictEqual(expectedPath);
});

test("resolvePaths with ~ in path", async () => {
    const filePath = "~/.cache/yarn";

    const homedir = jest.requireActual("os").homedir();
    const homedirMock = jest.spyOn(os, "homedir");
    homedirMock.mockImplementation(() => {
        return homedir;
    });

    const resolvedPath = await actionUtils.resolvePaths([filePath]);

    const expectedPath = [path.join(homedir, ".cache/yarn")];
    expect(resolvedPath).toStrictEqual(expectedPath);
});

test("resolvePaths with home not found", () => {
    const filePath = "~/.cache/yarn";
    const homedirMock = jest.spyOn(os, "homedir");
    homedirMock.mockImplementation(() => {
        return "";
    });
    // const globMock = jest.spyOn(glob, "homedir");
    // globMock.mockImplementation(() => "");

    expect(async () => await actionUtils.resolvePaths([filePath])).toThrow(
        "Unable to resolve `~` to HOME"
    );
});

test("isValidEvent returns true for push event", () => {
    const event = Events.Push;
    process.env[Events.Key] = event;

    const isValidEvent = actionUtils.isValidEvent();

    expect(isValidEvent).toBe(true);
});

test("isValidEvent returns true for pull request event", () => {
    const event = Events.PullRequest;
    process.env[Events.Key] = event;

    const isValidEvent = actionUtils.isValidEvent();

    expect(isValidEvent).toBe(true);
});
