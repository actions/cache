import * as core from "@actions/core";

import { Inputs } from "./constants";
import save from "./save";
import * as utils from "./utils/actionUtils";

async function runSaveAction(): Promise<void> {
    if (!core.getInput(Inputs.Key)) {
        utils.logWarning(`Error retrieving key from inputs.`);
        return;
    }
    saveOnly = true;

    await save();
}

runSaveAction();

export default runSaveAction;
export let saveOnly: boolean;
