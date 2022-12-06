import { NonStateOutputSetter } from "./outputSetter";
import run from "./restoreImpl";

async function restoreOnly(): Promise<void> {
    await run(new NonStateOutputSetter());
}

export default restoreOnly;
