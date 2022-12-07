import * as core from "@actions/core";

import { State } from "./constants";

export interface IStateProvider {
    //setOutput(key: string, value: string): void;
    setState(key: string, value: string): void;
    getState(key: string): string;

    getCacheState(): string | undefined;
}

class StateProviderBase implements IStateProvider {
    getCacheState(): string | undefined {
        const cacheKey = this.getState(State.CacheMatchedKey);
        if (cacheKey) {
            core.debug(`Cache state/key: ${cacheKey}`);
            return cacheKey;
        }

        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    setState = (key: string, value: string) => {};

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getState = (key: string) => "";
}

export class StateProvider extends StateProviderBase {
    //setOutput = core.setOutput;
    setState = core.saveState;
    getState = core.getState;
}

export class NullStateProvider extends StateProviderBase {
    //setOutput = core.setOutput;
    setState = core.setOutput;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getState = (key: string) => "";
}
