export enum Inputs {
    Key = "key", // Input from cache, restore, save action
    Path = "path", // Input from cache, restore, save action
    RestoreKeys = "restore-keys", // Input from cache, restore action
    UploadChunkSize = "upload-chunk-size", // Input from cache, save action
    RestoredKey = "restored-key" // Input from save action
}

export enum Outputs {
    CacheHit = "cache-hit", // Output from cache, restore action
    InputtedKey = "inputted-key", // Output from restore action
    MatchedKey = "matched-key" // Output from restore action
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

export const RefKey = "GITHUB_REF";
