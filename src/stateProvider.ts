import * as core from "@actions/core";

import { State } from "./constants";

export interface IStateProvider {
    setState(key: string, value: string, outputKey?: string): void;
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
    setState = (key: string, value: string, outputKey?: string) => {};

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getState = (key: string) => "";
}

export class StateProvider extends StateProviderBase {
    setState = core.saveState;
    getState = core.getState;
}

export class NullStateProvider extends StateProviderBase {
    setState = (key: string, value: string, outputKey?: string) => {
        if (outputKey) {
            core.setOutput(outputKey, value);
        }
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getState = (key: string) => "";
}
