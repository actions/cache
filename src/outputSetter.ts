import * as core from "@actions/core";

export interface IOutputSetter {
    setOutput(key: string, value: string): void;
    setState(key: string, value: string): void;
}

export class StateOutputSetter implements IOutputSetter {
    setOutput = core.setOutput;
    setState = core.saveState;
}

export class NonStateOutputSetter implements IOutputSetter {
    setOutput = core.setOutput;
    setState = core.setOutput;
}
