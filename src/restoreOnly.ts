import restoreImpl from "./restoreImpl";
import { NullStateProvider } from "./stateProvider";

async function run(earlyExit?: boolean | undefined): Promise<void> {
    try {
        await restoreImpl(new NullStateProvider());
    } catch (err) {
        console.error(err);
        if (earlyExit) {
            process.exit(1);
        }
    }

    // node will stay alive if any promises are not resolved,
    // which is a possibility if HTTP requests are dangling
    // due to retries or timeouts. We know that if we got here
    // that all promises that we care about have successfully
    // resolved, so simply exit with success.
    if (earlyExit) {
        process.exit(0);
    }
}

run(true);

export default run;
