export enum Inputs {
    Key = "key",
    Path = "path",
    Paths = "paths",
    RestoreKeys = "restore-keys"
}

export enum Outputs {
    CacheHit = "cache-hit"
}

export enum State {
    CacheKey = "CACHE_KEY",
    CacheResult = "CACHE_RESULT"
}

export enum Events {
    Key = "GITHUB_EVENT_NAME",
    Push = "push",
    PullRequest = "pull_request"
}
