import * as core from "@actions/core";

import { Inputs } from "./constants";
import run from "./restore";

async function runRestoreAction(): Promise<void> {
    if (core.getInput(Inputs.SaveOnAnyFailure) != "") {
        core.info(
            `Input ${Inputs.SaveOnAnyFailure} value is passed in the input, this input will be ignored as you are using restore-only action`
        );
    }
    if (core.getInput(Inputs.UploadChunkSize) != "") {
        core.info(
            `Input ${Inputs.UploadChunkSize} value is passed in the input, this input will be ignored as you are using restore-only action`
        );
    }
    await run();
}

runRestoreAction();

export default runRestoreAction;
