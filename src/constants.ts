export enum Inputs {
    Key = "key",
    Path = "path",
    RestoreKeys = "restore-keys",
    UploadChunkSize = "upload-chunk-size",
    FailOnCacheMiss = "fail-on-cache-miss",
    SaveOnAnyFailure = "save-on-any-failure"
}

export enum Outputs {
    CacheHit = "cache-hit"
}

export enum State {
    CachePrimaryKey = "CACHE_KEY",
    CacheMatchedKey = "CACHE_RESULT"
}

export enum Events {
    Key = "GITHUB_EVENT_NAME",
    Push = "push",
    PullRequest = "pull_request"
}

export enum Variables {
    SaveCacheOnAnyFailure = "SAVE_CACHE_ON_ANY_FAILURE"
}

export const RefKey = "GITHUB_REF";
