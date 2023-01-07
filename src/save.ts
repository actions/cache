import saveImpl from "./saveImpl";
import { StateProvider } from "./stateProvider";

async function run(): Promise<void> {
    await saveImpl(new StateProvider());
}

run();

export default run;
