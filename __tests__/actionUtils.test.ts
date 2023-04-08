import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { RequestError } from "@octokit/request-error";
import nock from "nock";

import { Events, RefKey } from "../src/constants";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("@actions/cache");

let pristineEnv: NodeJS.ProcessEnv;

beforeAll(() => {
    pristineEnv = process.env;
    nock.disableNetConnect();
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });
    testUtils.mockServer.listen({
        onUnhandledRequest: "warn"
    });
});

beforeEach(() => {
    jest.resetModules();
    process.env = pristineEnv;
    delete process.env[Events.Key];
    delete process.env[RefKey];
    delete process.env["GITHUB_REPOSITORY"];
    delete process.env["GITHUB_TOKEN"];
    delete process.env["GITHUB_ACTION"];
});

afterAll(() => {
    process.env = pristineEnv;
    testUtils.mockServer.close();
    nock.enableNetConnect();
});

test("isGhes returns true if server url is not github.com", () => {
    try {
        process.env["GITHUB_SERVER_URL"] = "http://example.com";
        expect(actionUtils.isGhes()).toBe(true);
    } finally {
        process.env["GITHUB_SERVER_URL"] = undefined;
    }
});

test("isGhes returns false when server url is github.com", () => {
    try {
        process.env["GITHUB_SERVER_URL"] = "http://github.com";
        expect(actionUtils.isGhes()).toBe(false);
    } finally {
        process.env["GITHUB_SERVER_URL"] = undefined;
    }
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

test("getInputAsArray removes spaces after ! at the beginning", () => {
    testUtils.setInput(
        "foo",
        "!   bar\n!  baz\n! qux\n!quux\ncorge\ngrault! garply\n!\r\t waldo"
    );
    expect(actionUtils.getInputAsArray("foo")).toEqual([
        "!bar",
        "!baz",
        "!qux",
        "!quux",
        "corge",
        "grault! garply",
        "!waldo"
    ]);
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

test("getInputAsBool returns false if input not set", () => {
    expect(actionUtils.getInputAsBool("undefined")).toBe(false);
});

test("getInputAsBool returns value if input is valid", () => {
    testUtils.setInput("foo", "true");
    expect(actionUtils.getInputAsBool("foo")).toBe(true);
});

test("getInputAsBool returns false if input is invalid or NaN", () => {
    testUtils.setInput("foo", "bar");
    expect(actionUtils.getInputAsBool("foo")).toBe(false);
});

test("getInputAsBool throws if required and value missing", () => {
    expect(() =>
        actionUtils.getInputAsBool("undefined2", { required: true })
    ).toThrowError();
});

test("deleteCacheByKey returns 'HttpError: 404' when cache is not found.", async () => {
    const event = Events.Push;

    process.env["GITHUB_REPOSITORY"] = "owner/repo";
    process.env["GITHUB_TOKEN"] =
        "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";
    process.env["GITHUB_ACTION"] = "__owner___run-repo";
    process.env[Events.Key] = event;
    process.env[RefKey] = "ref/heads/feature";
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const response = await actionUtils.deleteCacheByKey(
        testUtils.failureCacheKey,
        "owner",
        "repo"
    );
    expect(logWarningMock).toHaveBeenCalledWith(
        expect.stringMatching(/404: Not Found/i)
    );
    expect(response).toBeInstanceOf(RequestError);
    expect(response).toMatchObject({
        name: "HttpError",
        status: 404
    });
});

test("deleteCacheByKey returns 'HttpError: 401' on an invalid non-mocked request.", async () => {
    const event = Events.Push;

    process.env["GITHUB_REPOSITORY"] = "owner/repo";
    process.env["GITHUB_TOKEN"] =
        "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";
    process.env["GITHUB_ACTION"] = "__owner___run-repo";
    process.env[Events.Key] = event;
    process.env[RefKey] = "ref/heads/feature";
    await nock.enableNetConnect();
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const response = await actionUtils.deleteCacheByKey(
        testUtils.passThroughCacheKey,
        "owner",
        "repo"
    );
    expect(logWarningMock).toHaveBeenCalledWith(
        expect.stringMatching(/401: Bad Credentials/i)
    );
    expect(response).toBeInstanceOf(RequestError);
    expect(response).toMatchObject({
        name: "HttpError",
        status: 401
    });
    nock.disableNetConnect();
});

test("deleteCacheByKey returns matched cache data when successful.", async () => {
    const event = Events.Push;

    process.env["GITHUB_REPOSITORY"] = "owner/repo";
    process.env["GITHUB_TOKEN"] =
        "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";
    process.env["GITHUB_ACTION"] = "__owner___run-repo";
    process.env[Events.Key] = event;
    process.env[RefKey] = "ref/heads/feature";

    const expectedResponse = {
        id: expect.any(Number),
        ref: expect.any(String),
        key: expect.any(String),
        version: expect.any(String),
        last_accessed_at: expect.any(String),
        created_at: expect.any(String),
        size_in_bytes: expect.any(Number)
    };
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const response = await actionUtils.deleteCacheByKey(
        testUtils.successCacheKey,
        "owner",
        "repo"
    );
    expect(response).toMatchObject({
        data: expect.objectContaining({
            total_count: expect.any(Number),
            actions_caches: expect.arrayContaining([
                expect.objectContaining(expectedResponse)
            ])
        })
    });
    expect(logWarningMock).toHaveBeenCalledTimes(0);
});

test("isCacheFeatureAvailable for ac enabled", () => {
    jest.spyOn(cache, "isFeatureAvailable").mockImplementation(() => true);

    expect(actionUtils.isCacheFeatureAvailable()).toBe(true);
});

test("isCacheFeatureAvailable for ac disabled on GHES", () => {
    jest.spyOn(cache, "isFeatureAvailable").mockImplementation(() => false);

    const message = `Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.
Otherwise please upgrade to GHES version >= 3.5 and If you are also using Github Connect, please unretire the actions/cache namespace before upgrade (see https://docs.github.com/en/enterprise-server@3.5/admin/github-actions/managing-access-to-actions-from-githubcom/enabling-automatic-access-to-githubcom-actions-using-github-connect#automatic-retirement-of-namespaces-for-actions-accessed-on-githubcom)`;
    const infoMock = jest.spyOn(core, "info");

    try {
        process.env["GITHUB_SERVER_URL"] = "http://example.com";
        expect(actionUtils.isCacheFeatureAvailable()).toBe(false);
        expect(infoMock).toHaveBeenCalledWith(`[warning]${message}`);
    } finally {
        delete process.env["GITHUB_SERVER_URL"];
    }
});

test("isCacheFeatureAvailable for ac disabled on dotcom", () => {
    jest.spyOn(cache, "isFeatureAvailable").mockImplementation(() => false);

    const message =
        "An internal error has occurred in cache backend. Please check https://www.githubstatus.com/ for any ongoing issue in actions.";
    const infoMock = jest.spyOn(core, "info");

    try {
        process.env["GITHUB_SERVER_URL"] = "http://github.com";
        expect(actionUtils.isCacheFeatureAvailable()).toBe(false);
        expect(infoMock).toHaveBeenCalledWith(`[warning]${message}`);
    } finally {
        delete process.env["GITHUB_SERVER_URL"];
    }
});

test("isGhes returns false when the GITHUB_SERVER_URL environment variable is not defined", async () => {
    delete process.env["GITHUB_SERVER_URL"];
    expect(actionUtils.isGhes()).toBeFalsy();
});

test("isGhes returns false when the GITHUB_SERVER_URL environment variable is set to github.com", async () => {
    process.env["GITHUB_SERVER_URL"] = "https://github.com";
    expect(actionUtils.isGhes()).toBeFalsy();
});

test("isGhes returns false when the GITHUB_SERVER_URL environment variable is set to a GitHub Enterprise Cloud-style URL", async () => {
    process.env["GITHUB_SERVER_URL"] = "https://contoso.ghe.com";
    expect(actionUtils.isGhes()).toBeFalsy();
});

test("isGhes returns false when the GITHUB_SERVER_URL environment variable has a .localhost suffix", async () => {
    process.env["GITHUB_SERVER_URL"] = "https://mock-github.localhost";
    expect(actionUtils.isGhes()).toBeFalsy();
});

test("isGhes returns true when the GITHUB_SERVER_URL environment variable is set to some other URL", async () => {
    process.env["GITHUB_SERVER_URL"] = "https://src.onpremise.fabrikam.com";
    expect(actionUtils.isGhes()).toBeTruthy();
});
