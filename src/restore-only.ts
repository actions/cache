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
    core.info("before run");
    await run();
    core.info("after run");
}

core.info("before runRestoreAction");
runRestoreAction();
core.info("after runRestoreAction");

export default runRestoreAction;

core.info("after export default runRestoreAction");
