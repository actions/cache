import restore from "./restoreImpl";

async function runRestoreStep(): Promise<void> {
    await restore();
}

runRestoreStep();
