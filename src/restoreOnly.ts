import { NonStateOuputSetter } from "./outputSetter";
import run from "./restoreImpl";

async function restoreOnly(): Promise<void> {
    await run(new NonStateOuputSetter());
}

export default restoreOnly;
