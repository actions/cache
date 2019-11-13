export enum Inputs {
    Key = "key",
    Path = "path",
    RestoreKeys = "restore-keys"
}

export enum Outputs {
    CacheHit = "cache-hit"
}

export enum State {
    CacheKey = "CACHE_KEY",
    CacheResult = "CACHE_RESULT"
}

export namespace Events {
    export const Key = "GITHUB_EVENT_NAME";
    export const Push = "push";
    export const PullRequest = "pull_request";
}
