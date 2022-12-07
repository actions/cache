import { StateProvider } from "./stateProvider";
import restoreImpl from "./restoreImpl";

async function run(): Promise<void> {
    await restoreImpl(new StateProvider());
}

run();

export default run;
