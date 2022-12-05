import { StateOutputSetter } from "./outputSetter";
import run from "./restoreImpl";

async function restore(): Promise<void> {
    await run(new StateOutputSetter());
}

export default restore;
