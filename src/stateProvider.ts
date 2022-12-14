import * as core from "@actions/core";

import { Outputs, State } from "./constants";

export interface IStateProvider {
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
    setState = core.saveState;
    getState = core.getState;
}

export class NullStateProvider extends StateProviderBase {
    stateToOutputMap = new Map<string, string>([
        [State.CacheMatchedKey, Outputs.CacheMatchedKey],
        [State.CachePrimaryKey, Outputs.CachePrimaryKey]
    ]);

    setState = (key: string, value: string) => {
        core.setOutput(this.stateToOutputMap.get(key) as string, value);
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getState = (key: string) => "";
}
