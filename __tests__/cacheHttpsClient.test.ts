import { getCacheVersion } from "../src/cacheHttpClient";
import { Inputs } from "../src/constants";
import * as testUtils from "../src/utils/testUtils";

afterEach(() => {
    testUtils.clearInputs();
});

test("getCacheVersion with path input returns version", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");

    const result = getCacheVersion();

    expect(result).toEqual(
        "b3e0c6cb5ecf32614eeb2997d905b9c297046d7cbf69062698f25b14b4cb0985"
    );
});

test("getCacheVersion with no input throws", async () => {
    expect(() => getCacheVersion()).toThrow();
});
