import restoreImpl from "./restoreImpl";
import { NullStateProvider } from "./stateProvider";

async function run(): Promise<void> {
    await restoreImpl(new NullStateProvider(), { lookupOnly: true });
}

run();

export default run;
