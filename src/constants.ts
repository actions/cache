export enum Inputs {
    Key = "key", // Input for cache, restore, save action
    Path = "path", // Input for cache, restore, save action
    RestoreKeys = "restore-keys", // Input for cache, restore action
    UploadChunkSize = "upload-chunk-size", // Input for cache, save action
    EnableCrossOsArchive = "enableCrossOsArchive", // Input for cache, restore, save action
    FailOnCacheMiss = "fail-on-cache-miss", // Input for cache, restore action
    LookupOnly = "lookup-only", // Input for cache, restore action
    AWSS3Bucket = "aws-s3-bucket",
    AWSAccessKeyId = "aws-access-key-id",
    AWSSecretAccessKey = "aws-secret-access-key",
    AWSSessionToken = "aws-session-token",
    AWSRegion = "aws-region",
    AWSEndpoint = "aws-endpoint",
    AWSS3BucketEndpoint = "aws-s3-bucket-endpoint",
    AWSS3ForcePathStyle = "aws-s3-force-path-style"
}

export enum Outputs {
    CacheHit = "cache-hit", // Output from cache, restore action
    CachePrimaryKey = "cache-primary-key", // Output from restore action
    CacheMatchedKey = "cache-matched-key" // Output from restore action
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
