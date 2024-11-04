import * as core from "@actions/core";

import { Inputs } from "./constants";
import { saveRun } from "./saveImpl";

const doSave = core.getInput(Inputs.Save);
if (doSave) {
    saveRun(true);
}
