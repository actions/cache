import { Inputs } from "../constants";

// See: https://github.com/actions/toolkit/blob/master/packages/core/src/core.ts#L67
function getInputName(name: string): string {
    return `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
}

export function setInput(name: string, value: string): void {
    process.env[getInputName(name)] = value;
}

interface CacheInput {
    path: string;
    key: string;
    restoreKeys?: string[];
    failOnCacheMiss?: boolean;
    saveOnAnyFailure?: boolean;
}

export function setInputs(input: CacheInput): void {
    setInput(Inputs.Path, input.path);
    setInput(Inputs.Key, input.key);
    setInput(Inputs.SaveOnAnyFailure, "false");
    setInput(Inputs.FailOnCacheMiss, "false");
    input.restoreKeys &&
        setInput(Inputs.RestoreKeys, input.restoreKeys.join("\n"));
    input.failOnCacheMiss &&
        setInput(Inputs.FailOnCacheMiss, String(input.failOnCacheMiss));
    input.saveOnAnyFailure &&
        setInput(Inputs.SaveOnAnyFailure, String(input.saveOnAnyFailure));
}

export function clearInputs(): void {
    delete process.env[getInputName(Inputs.Path)];
    delete process.env[getInputName(Inputs.Key)];
    delete process.env[getInputName(Inputs.RestoreKeys)];
    delete process.env[getInputName(Inputs.FailOnCacheMiss)];
    delete process.env[getInputName(Inputs.SaveOnAnyFailure)];
    delete process.env[getInputName(Inputs.UploadChunkSize)];
}
