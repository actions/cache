import { afterAll, beforeEach, expect, jest, test } from "@jest/globals";

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
const actionUtils = await import("../src/utils/actionUtils");
const testUtils = await import("../src/utils/testUtils");

let pristineEnv: NodeJS.ProcessEnv;

beforeEach(() => {
    pristineEnv = { ...process.env };
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
    delete process.env[Events.Key];
    delete process.env[RefKey];
});

afterAll(() => {
    process.env = pristineEnv;
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
    expect(actionUtils.isExactKeyMatch("linux-rust", undefined)).toBe(false);
});

test("isExactKeyMatch with empty cache key returns false", () => {
    expect(actionUtils.isExactKeyMatch("linux-rust", "")).toBe(false);
});

test("isExactKeyMatch with different keys returns false", () => {
    expect(actionUtils.isExactKeyMatch("linux-rust", "linux-")).toBe(false);
});

test("isExactKeyMatch with different key accents returns false", () => {
    expect(actionUtils.isExactKeyMatch("linux-áccent", "linux-accent")).toBe(
        false
    );
});

test("isExactKeyMatch with same key returns true", () => {
    expect(actionUtils.isExactKeyMatch("linux-rust", "linux-rust")).toBe(true);
});

test("isExactKeyMatch with same key and different casing returns true", () => {
    expect(actionUtils.isExactKeyMatch("linux-rust", "LINUX-RUST")).toBe(true);
});

test("logWarning logs a message with a warning prefix", () => {
    const message = "A warning occurred.";
    actionUtils.logWarning(message);
    expect(core.info).toHaveBeenCalledWith(`[warning]${message}`);
});

test("isValidEvent returns false for event that does not have a branch or tag", () => {
    process.env[Events.Key] = "foo";
    expect(actionUtils.isValidEvent()).toBe(false);
});

test("isValidEvent returns true for event that has a ref", () => {
    process.env[Events.Key] = Events.Push;
    process.env[RefKey] = "ref/heads/feature";
    expect(actionUtils.isValidEvent()).toBe(true);
});

test("getInputAsArray returns empty array if not required and missing", () => {
    expect(actionUtils.getInputAsArray("foo")).toEqual([]);
});

test("getInputAsArray throws error if required and missing", () => {
    expect(() =>
        actionUtils.getInputAsArray("foo", { required: true })
    ).toThrow();
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
    ).toThrow();
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
    ).toThrow();
});

test("isCacheFeatureAvailable for ac enabled", () => {
    (cache.isFeatureAvailable as jest.Mock).mockReturnValue(true);
    expect(actionUtils.isCacheFeatureAvailable()).toBe(true);
});

test("isCacheFeatureAvailable for ac disabled on GHES", () => {
    (cache.isFeatureAvailable as jest.Mock).mockReturnValue(false);

    const message = `Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.
Otherwise please upgrade to GHES version >= 3.5 and If you are also using Github Connect, please unretire the actions/cache namespace before upgrade (see https://docs.github.com/en/enterprise-server@3.5/admin/github-actions/managing-access-to-actions-from-githubcom/enabling-automatic-access-to-githubcom-actions-using-github-connect#automatic-retirement-of-namespaces-for-actions-accessed-on-githubcom)`;

    try {
        process.env["GITHUB_SERVER_URL"] = "http://example.com";
        expect(actionUtils.isCacheFeatureAvailable()).toBe(false);
        expect(core.info).toHaveBeenCalledWith(`[warning]${message}`);
    } finally {
        delete process.env["GITHUB_SERVER_URL"];
    }
});

test("isCacheFeatureAvailable for ac disabled on dotcom", () => {
    (cache.isFeatureAvailable as jest.Mock).mockReturnValue(false);

    const message =
        "An internal error has occurred in cache backend. Please check https://www.githubstatus.com/ for any ongoing issue in actions.";

    try {
        process.env["GITHUB_SERVER_URL"] = "http://github.com";
        expect(actionUtils.isCacheFeatureAvailable()).toBe(false);
        expect(core.info).toHaveBeenCalledWith(`[warning]${message}`);
    } finally {
        delete process.env["GITHUB_SERVER_URL"];
    }
});

test("isGhes returns false when the GITHUB_SERVER_URL environment variable is not defined", () => {
    delete process.env["GITHUB_SERVER_URL"];
    expect(actionUtils.isGhes()).toBeFalsy();
});

test("isGhes returns false when the GITHUB_SERVER_URL environment variable is set to github.com", () => {
    process.env["GITHUB_SERVER_URL"] = "https://github.com";
    expect(actionUtils.isGhes()).toBeFalsy();
});

test("isGhes returns false when the GITHUB_SERVER_URL environment variable is set to a GitHub Enterprise Cloud-style URL", () => {
    process.env["GITHUB_SERVER_URL"] = "https://contoso.ghe.com";
    expect(actionUtils.isGhes()).toBeFalsy();
});

test("isGhes returns false when the GITHUB_SERVER_URL environment variable has a .localhost suffix", () => {
    process.env["GITHUB_SERVER_URL"] = "https://mock-github.localhost";
    expect(actionUtils.isGhes()).toBeFalsy();
});

test("isGhes returns true when the GITHUB_SERVER_URL environment variable is set to some other URL", () => {
    process.env["GITHUB_SERVER_URL"] = "https://src.onpremise.fabrikam.com";
    expect(actionUtils.isGhes()).toBeTruthy();
});
