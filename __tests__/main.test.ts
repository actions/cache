import * as core from "@actions/core";

import { Inputs } from "../src/constants";
import run from "../src/restore";
import * as testUtils from "../src/utils/testUtils";

test("restore with no path", async () => {
    const failedMock = jest.spyOn(core, "setFailed");
    await run();
    expect(failedMock).toHaveBeenCalledWith(
        "Input required and not supplied: path"
    );
});

test("restore with no key", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");
    const failedMock = jest.spyOn(core, "setFailed");
    await run();
    expect(failedMock).toHaveBeenCalledWith(
        "Input required and not supplied: key"
    );
});
