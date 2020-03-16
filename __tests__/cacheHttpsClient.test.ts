import * as testUtils from "../src/utils/testUtils";
import { getCacheVersion } from "../src/cacheHttpClient";

afterEach(() => {
    testUtils.clearInputs();
});

test("getCacheVersion with no restore keys returns version", async () => {
    testUtils.setInputs({
        path: "node-test",
        key: "node_modules"
    });

    const result = getCacheVersion();

    expect(result).toEqual(
        "ee9d5dc2e8e2df8e32f62c367796abefc134790584015d8e1207523c9085e87e"
    );
});

test("getCacheVersion with restore keys returns version", async () => {
    testUtils.setInputs({
        path: "node-test",
        key: "node_modules",
        restoreKeys: ["node-", "node"]
    });

    const result = getCacheVersion();

    expect(result).toEqual(
        "b8596b1e42c34a25be7b43c7b91892ed3ba81cba1e075365f408b35dbfabb61b"
    );
});

test("getCacheVersion with no input throws", async () => {
    expect(() => getCacheVersion()).toThrow();
});
