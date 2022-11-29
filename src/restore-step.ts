import restore from "./restore";

async function runRestoreStep(): Promise<void> {
    await restore();
}

runRestoreStep();
