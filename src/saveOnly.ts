import saveImpl from "./saveImpl";
import { NullStateProvider } from "./stateProvider";
import * as utils from "./utils/actionUtils";

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logWarning(e.message));

async function run(): Promise<void> {
    try {
        await saveImpl(new NullStateProvider());
    } catch (error: unknown) {
        utils.logWarning((error as Error).message);
    }
}

run();

export default run;
