import restoreImpl from "./restoreImpl";
import { StateProvider } from "./stateProvider";

async function run(): Promise<void> {
    await restoreImpl(new StateProvider());
}

run();

export default run;
