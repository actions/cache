import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, Inputs, RefKey } from "../src/constants";
import { restoreImpl } from "../src/restoreImpl";
import { StateProvider } from "../src/stateProvider";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("../src/utils/actionUtils");

beforeAll(() => {
    jest.spyOn(actionUtils, "isExactKeyMatch").mockImplementation(
        (key, cacheResult) => {
            const actualUtils = jest.requireActual("../src/utils/actionUtils");
            return actualUtils.isExactKeyMatch(key, cacheResult);
        }
    );

    jest.spyOn(actionUtils, "isValidEvent").mockImplementation(() => {
        const actualUtils = jest.requireActual("../src/utils/actionUtils");
        return actualUtils.isValidEvent();
    });

    jest.spyOn(actionUtils, "getInputAsArray").mockImplementation(
        (name, options) => {
            const actualUtils = jest.requireActual("../src/utils/actionUtils");
            return actualUtils.getInputAsArray(name, options);
        }
    );

    jest.spyOn(actionUtils, "getInputAsBool").mockImplementation(
        (name, options) => {
            const actualUtils = jest.requireActual("../src/utils/actionUtils");
            return actualUtils.getInputAsBool(name, options);
        }
    );

    jest.spyOn(actionUtils, "getPathValidationInput").mockImplementation(() => {
        const actualUtils = jest.requireActual("../src/utils/actionUtils");
        return actualUtils.getPathValidationInput();
    });

    jest.spyOn(actionUtils, "logWarning").mockImplementation(message => {
        const actualUtils = jest.requireActual("../src/utils/actionUtils");
        return actualUtils.logWarning(message);
    });
});

beforeEach(() => {
    jest.restoreAllMocks();
    process.env[Events.Key] = Events.Push;
    process.env[RefKey] = "refs/heads/feature-branch";

    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => false);
    jest.spyOn(actionUtils, "isCacheFeatureAvailable").mockImplementation(
        () => true
    );
});

afterEach(() => {
    testUtils.clearInputs();
    delete process.env[Events.Key];
    delete process.env[RefKey];
});

test("restore with invalid event outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");
    const invalidEvent = "commit_comment";
    process.env[Events.Key] = invalidEvent;
    delete process.env[RefKey];
    await restoreImpl(new StateProvider());
    expect(logWarningMock).toHaveBeenCalledWith(
        `Event Validation Error: The event type ${invalidEvent} is not supported because it's not tied to a branch or tag ref.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore without AC available should no-op", async () => {
    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => false);
    jest.spyOn(actionUtils, "isCacheFeatureAvailable").mockImplementation(
        () => false
    );

    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "false");
});

test("restore on GHES without AC available should no-op", async () => {
    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => true);
    jest.spyOn(actionUtils, "isCacheFeatureAvailable").mockImplementation(
        () => false
    );

    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "false");
});

test("restore on GHES with AC available ", async () => {
    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => true);
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path: path,
        key,
        enableCrossOsArchive: false
    });

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(key);
        });

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: false,
            pathValidation: "warn"
        },
        false
    );

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "true");

    expect(infoMock).toHaveBeenCalledWith(`Cache restored from key: ${key}`);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with no path should fail", async () => {
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await restoreImpl(new StateProvider());
    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    // this input isn't necessary for restore b/c tarball contains entries relative to workspace
    expect(failedMock).not.toHaveBeenCalledWith(
        "Input required and not supplied: path"
    );
});

test("restore with no key", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await restoreImpl(new StateProvider());
    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledWith(
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
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await restoreImpl(new StateProvider());
    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        restoreKeys,
        {
            lookupOnly: false,
            pathValidation: "warn"
        },
        false
    );
    expect(failedMock).toHaveBeenCalledWith(
        `Key Validation Error: Keys are limited to a maximum of 10.`
    );
});

test("restore with large key should fail", async () => {
    const path = "node_modules";
    const key = "foo".repeat(512); // Over the 512 character limit
    testUtils.setInputs({
        path: path,
        key,
        enableCrossOsArchive: false
    });
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await restoreImpl(new StateProvider());
    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: false,
            pathValidation: "warn"
        },
        false
    );
    expect(failedMock).toHaveBeenCalledWith(
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
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    await restoreImpl(new StateProvider());
    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: false,
            pathValidation: "warn"
        },
        false
    );
    expect(failedMock).toHaveBeenCalledWith(
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

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(undefined);
        });

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: false,
            pathValidation: "warn"
        },
        false
    );

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(failedMock).toHaveBeenCalledTimes(0);

    expect(infoMock).toHaveBeenCalledWith(
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

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(undefined);
        });

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [restoreKey],
        {
            lookupOnly: false,
            pathValidation: "warn"
        },
        false
    );

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(failedMock).toHaveBeenCalledTimes(0);

    expect(infoMock).toHaveBeenCalledWith(
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

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(key);
        });

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: false,
            pathValidation: "warn"
        },
        false
    );

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "true");

    expect(infoMock).toHaveBeenCalledWith(`Cache restored from key: ${key}`);
    expect(failedMock).toHaveBeenCalledTimes(0);
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

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(restoreKey);
        });

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [restoreKey],
        {
            lookupOnly: false,
            pathValidation: "warn"
        },
        false
    );

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "false");
    expect(infoMock).toHaveBeenCalledWith(
        `Cache restored from key: ${restoreKey}`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with lookup-only set", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path: path,
        key,
        lookupOnly: true
    });

    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");
    const stateMock = jest.spyOn(core, "saveState");
    const setCacheHitOutputMock = jest.spyOn(core, "setOutput");
    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(key);
        });

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        {
            lookupOnly: true,
            pathValidation: "warn"
        },
        false
    );

    expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
    expect(stateMock).toHaveBeenCalledWith("CACHE_RESULT", key);
    expect(stateMock).toHaveBeenCalledTimes(2);

    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith("cache-hit", "true");

    expect(infoMock).toHaveBeenCalledWith(
        `Cache found and can be restored from key: ${key}`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore failure with earlyExit should call process exit", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");
    const failedMock = jest.spyOn(core, "setFailed");
    const restoreCacheMock = jest.spyOn(cache, "restoreCache");
    const processExitMock = jest.spyOn(process, "exit").mockImplementation();

    // call restoreImpl with `earlyExit` set to true
    await restoreImpl(new StateProvider(), true);

    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledWith(
        "Input required and not supplied: key"
    );
    expect(processExitMock).toHaveBeenCalledWith(1);
});

// ---------------------------------------------------------------------------
// Path validation tests
//
// These tests verify that the action correctly forwards the `strict-paths`
// input to the @actions/cache toolkit and handles `CacheIntegrityError`
// rejections according to the `fail-on-cache-invalid` input.
// ---------------------------------------------------------------------------

test("restore defaults strict-paths to 'warn' and forwards it to restoreCache", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({ path, key });

    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockResolvedValueOnce(key);

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        { lookupOnly: false, pathValidation: "warn" },
        false
    );
});

test.each(["off", "warn", "error"])(
    "restore forwards strict-paths value '%s' to restoreCache",
    async value => {
        const path = "node_modules";
        const key = "node-test";
        testUtils.setInputs({ path, key, strictPaths: value });

        const restoreCacheMock = jest
            .spyOn(cache, "restoreCache")
            .mockResolvedValueOnce(key);

        await restoreImpl(new StateProvider());

        expect(restoreCacheMock).toHaveBeenCalledTimes(1);
        expect(restoreCacheMock).toHaveBeenCalledWith(
            [path],
            key,
            [],
            { lookupOnly: false, pathValidation: value },
            false
        );
    }
);

test("restore falls back to 'warn' when strict-paths input is unrecognized", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({ path, key, strictPaths: "STRICT" });

    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockResolvedValueOnce(key);
    // getPathValidationInput()'s call to logWarning() is intra-module so a
    // spy on actionUtils.logWarning would not intercept it. Spy on core.info
    // (the underlying transport for logWarning) and suppress the real
    // implementation so the warning does not print into the Jest log.
    const infoMock = jest
        .spyOn(core, "info")
        .mockImplementation(() => undefined);

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledWith(
        [path],
        key,
        [],
        { lookupOnly: false, pathValidation: "warn" },
        false
    );
    expect(infoMock).toHaveBeenCalledWith(
        expect.stringContaining("Unrecognized value for strict-paths")
    );
});

test("restore treats CacheIntegrityError as a cache miss by default", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({ path, key, strictPaths: "error" });

    const integrityError = new Error("entries escape declared paths");
    integrityError.name = "CacheIntegrityError";
    (integrityError as Error & { code?: string }).code = "PATH_VIOLATION";

    const restoreCacheMock = jest
        .spyOn(cache, "restoreCache")
        .mockRejectedValueOnce(integrityError);
    const setOutputMock = jest.spyOn(core, "setOutput");
    const failedMock = jest.spyOn(core, "setFailed");
    // Suppress the real logWarning so the discarded-cache warning does not
    // pollute test output. beforeEach's jest.restoreAllMocks() handles
    // cross-test cleanup.
    const logWarningMock = jest
        .spyOn(actionUtils, "logWarning")
        .mockImplementation(() => undefined);

    await restoreImpl(new StateProvider());

    expect(restoreCacheMock).toHaveBeenCalledTimes(1);
    // Intentionally NOT set: a discarded cache must look identical to a
    // regular cache miss to downstream `if:` checks (see issue #1466).
    const cacheHitCalls = setOutputMock.mock.calls.filter(
        c => c[0] === "cache-hit"
    );
    expect(cacheHitCalls).toHaveLength(0);
    expect(failedMock).not.toHaveBeenCalled();
    expect(logWarningMock).toHaveBeenCalledWith(
        expect.stringContaining("PATH_VIOLATION")
    );
});

test("restore fails when CacheIntegrityError is raised and fail-on-cache-invalid is true", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path,
        key,
        strictPaths: "error",
        failOnCacheInvalid: true
    });

    const integrityError = new Error("entry escapes workspace");
    integrityError.name = "CacheIntegrityError";
    (integrityError as Error & { code?: string }).code = "PATH_VIOLATION";

    jest.spyOn(cache, "restoreCache").mockRejectedValueOnce(integrityError);
    const failedMock = jest.spyOn(core, "setFailed");

    await restoreImpl(new StateProvider());

    expect(failedMock).toHaveBeenCalledTimes(1);
    expect(failedMock.mock.calls[0][0]).toContain("integrity validation");
    expect(failedMock.mock.calls[0][0]).toContain("PATH_VIOLATION");
});

test("restore propagates non-integrity errors normally", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({ path, key });

    const networkError = new Error("Network timeout");
    jest.spyOn(cache, "restoreCache").mockRejectedValueOnce(networkError);
    const failedMock = jest.spyOn(core, "setFailed");
    const logWarningMock = jest
        .spyOn(actionUtils, "logWarning")
        .mockImplementation(() => undefined);

    await restoreImpl(new StateProvider());

    expect(failedMock).toHaveBeenCalledWith("Network timeout");
    expect(logWarningMock).not.toHaveBeenCalledWith(
        expect.stringContaining("integrity")
    );
});

test("restore parse-error integrity failure also treated as miss by default", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({ path, key, strictPaths: "error" });

    const parseError = new Error("malformed gzip header");
    parseError.name = "CacheIntegrityError";
    (parseError as Error & { code?: string }).code = "PARSE_ERROR";

    jest.spyOn(cache, "restoreCache").mockRejectedValueOnce(parseError);
    const setOutputMock = jest.spyOn(core, "setOutput");
    const failedMock = jest.spyOn(core, "setFailed");
    const logWarningMock = jest
        .spyOn(actionUtils, "logWarning")
        .mockImplementation(() => undefined);

    await restoreImpl(new StateProvider());

    const cacheHitCalls = setOutputMock.mock.calls.filter(
        c => c[0] === "cache-hit"
    );
    expect(cacheHitCalls).toHaveLength(0);
    expect(failedMock).not.toHaveBeenCalled();
    expect(logWarningMock).toHaveBeenCalledWith(
        expect.stringContaining("PARSE_ERROR")
    );
});

test("restore tolerates CacheIntegrityError without explicit code", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({ path, key, strictPaths: "error" });

    const integrityError = new Error("bad archive");
    integrityError.name = "CacheIntegrityError";
    // intentionally no .code property

    jest.spyOn(cache, "restoreCache").mockRejectedValueOnce(integrityError);
    const setOutputMock = jest.spyOn(core, "setOutput");
    const logWarningMock = jest
        .spyOn(actionUtils, "logWarning")
        .mockImplementation(() => undefined);

    await restoreImpl(new StateProvider());

    const cacheHitCalls = setOutputMock.mock.calls.filter(
        c => c[0] === "cache-hit"
    );
    expect(cacheHitCalls).toHaveLength(0);
    expect(logWarningMock).toHaveBeenCalledWith(
        expect.stringContaining("unknown")
    );
});

test("restore does not set cache-hit output when integrity error is rethrown", async () => {
    const path = "node_modules";
    const key = "node-test";
    testUtils.setInputs({
        path,
        key,
        strictPaths: "error",
        failOnCacheInvalid: true
    });

    const integrityError = new Error("rejected");
    integrityError.name = "CacheIntegrityError";
    (integrityError as Error & { code?: string }).code = "PATH_VIOLATION";

    jest.spyOn(cache, "restoreCache").mockRejectedValueOnce(integrityError);
    const setOutputMock = jest.spyOn(core, "setOutput");

    await restoreImpl(new StateProvider());

    // setOutput should NOT have been called with cache-hit at all in this path
    const cacheHitCalls = setOutputMock.mock.calls.filter(
        c => c[0] === "cache-hit"
    );
    expect(cacheHitCalls).toHaveLength(0);
});
