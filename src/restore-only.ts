import * as core from "@actions/core";

import { Inputs } from "./constants";
import run from "./restore";

async function runRestoreAction(): Promise<void> {
    if (core.getInput(Inputs.SaveOnAnyFailure) != "") {
        core.warning(
            `${Inputs.SaveOnAnyFailure} value is passed in the input, this input is invalid for the restore-only action and hence will be ignored`
        );
    }
    if (core.getInput(Inputs.UploadChunkSize) != "") {
        core.warning(
            `${Inputs.UploadChunkSize} value is passed in the input, this input is invalid for the restore-only action and hence will be ignored`
        );
    }
    await run();
}

runRestoreAction();

export default runRestoreAction;
